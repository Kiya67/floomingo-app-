import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, desc, lt, countDistinct, sql } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

interface CreateMomentBody {
  video_url: string;
  thumbnail_url?: string;
  caption?: string;
  linked_experience_id?: string;
  places?: Array<{ place_id: string; place_name: string; place_address?: string }>;
}

interface MomentPlace {
  id: string;
  place_id: string;
  place_name: string;
  place_address: string | null;
}

interface LinkedExperience {
  id: string;
  video_url: string;
  thumbnail_url: string | null;
  title: string;
}

interface MomentResponse {
  id: string;
  user_id: string;
  video_url: string;
  thumbnail_url: string | null;
  caption: string | null;
  linked_experience_id: string | null;
  linked_experience: LinkedExperience | null;
  likes_count: number;
  bookmarks_count: number;
  is_liked: boolean;
  is_bookmarked: boolean;
  places: MomentPlace[];
  user: { id: string; username: string; avatar_url: string | null };
  created_at: string;
}

interface PostMomentResponse {
  id: string;
  user_id: string;
  video_url: string;
  thumbnail_url: string | null;
  caption: string;
  likes_count: number;
  bookmarks_count: number;
  is_liked: boolean;
  is_bookmarked: boolean;
  places: Array<{ id: string; place_id: string; place_name: string | null }>;
  user: { id: string; username: string; display_name: string | null; avatar_url: string | null };
  created_at: string;
}

export function registerMomentRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // GET /api/moments - List moments with cursor pagination
  app.fastify.get('/api/moments', {
    schema: {
      description: 'List moments with cursor pagination',
      tags: ['moments'],
      querystring: {
        type: 'object',
        properties: {
          cursor: { type: 'string', description: 'Base64-encoded ISO timestamp for cursor pagination' },
          limit: { type: 'integer', default: 20, description: 'Number of results to return' },
          place_id: { type: 'string', description: 'Filter moments by place ID' },
          keywords: { type: 'string', description: 'Search keywords in caption' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            moments: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  user_id: { type: 'string' },
                  video_url: { type: 'string' },
                  thumbnail_url: { type: ['string', 'null'] },
                  caption: { type: ['string', 'null'] },
                  likes_count: { type: 'integer' },
                  bookmarks_count: { type: 'integer' },
                  is_liked: { type: 'boolean' },
                  is_bookmarked: { type: 'boolean' },
                  places: { type: 'array' },
                  user: { type: 'object' },
                  created_at: { type: 'string', format: 'date-time' },
                },
              },
            },
            next_cursor: { type: ['string', 'null'] },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Querystring: { cursor?: string; limit?: string; place_id?: string; keywords?: string } }>,
    reply: FastifyReply
  ): Promise<{ moments: PostMomentResponse[]; next_cursor: string | null }> => {
    const limit = Math.min(parseInt(request.query.limit || '20'), 100);
    let cursorDate: Date | null = null;

    if (request.query.cursor) {
      try {
        const decoded = Buffer.from(request.query.cursor, 'base64').toString('utf-8');
        cursorDate = new Date(decoded);
      } catch {
        app.logger.warn({ cursor: request.query.cursor }, 'Invalid cursor');
      }
    }

    let query = app.db
      .select({
        post: schema.posts,
        profile: schema.profiles,
      })
      .from(schema.posts)
      .leftJoin(schema.profiles, eq(schema.profiles.id, schema.posts.userId));

    // Apply filters
    const conditions = [];
    if (cursorDate) {
      conditions.push(lt(schema.posts.createdAt, cursorDate));
    }
    if (request.query.place_id) {
      conditions.push(eq(schema.posts.placeId, request.query.place_id));
    }
    if (request.query.keywords) {
      conditions.push(sql`${schema.posts.caption} ILIKE ${'%' + request.query.keywords + '%'}`);
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const postsData = await query
      .orderBy(desc(schema.posts.createdAt))
      .limit(limit + 1);

    app.logger.info(
      { count: postsData.length, limit },
      'Fetched moments'
    );

    const hasMore = postsData.length > limit;
    const posts = postsData.slice(0, limit);

    // Build response
    const momentResponses: PostMomentResponse[] = posts.map((p) => {
      // Build places array from post's own place_id and place_name
      const places = p.post.placeId
        ? [
            {
              id: p.post.id,
              place_id: p.post.placeId,
              place_name: p.post.placeName,
            },
          ]
        : [];

      return {
        id: p.post.id,
        user_id: p.post.userId,
        video_url: p.post.videoUrl,
        thumbnail_url: p.post.thumbnailUrl,
        caption: p.post.caption,
        likes_count: 0,
        bookmarks_count: 0,
        is_liked: false,
        is_bookmarked: false,
        places,
        user: {
          id: p.profile?.id || p.post.userId,
          username: p.profile?.username || 'unknown',
          display_name: p.profile?.displayName || null,
          avatar_url: p.profile?.avatarUrl || null,
        },
        created_at: p.post.createdAt.toISOString(),
      };
    });

    const nextCursor = hasMore ? Buffer.from(posts[posts.length - 1].post.createdAt.toISOString()).toString('base64') : null;

    return {
      moments: momentResponses,
      next_cursor: nextCursor,
    };
  });

  // POST /api/moments - Create moment (requires auth)
  app.fastify.post('/api/moments', {
    schema: {
      description: 'Create a new moment',
      tags: ['moments'],
      body: {
        type: 'object',
        required: ['video_url'],
        properties: {
          video_url: { type: 'string' },
          thumbnail_url: { type: 'string' },
          caption: { type: 'string' },
          linked_experience_id: { type: 'string', format: 'uuid' },
          places: {
            type: 'array',
            items: {
              type: 'object',
              required: ['place_id', 'place_name'],
              properties: {
                place_id: { type: 'string' },
                place_name: { type: 'string' },
                place_address: { type: 'string' },
              },
            },
          },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            user_id: { type: 'string' },
            video_url: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Body: CreateMomentBody }>,
    reply: FastifyReply
  ): Promise<MomentResponse | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ body: request.body, userId: session.user.id }, 'Creating moment');

    try {
      const momentResult = await app.db
        .insert(schema.moments)
        .values({
          userId: session.user.id,
          videoUrl: request.body.video_url,
          thumbnailUrl: request.body.thumbnail_url,
          caption: request.body.caption,
          linkedExperienceId: request.body.linked_experience_id ? (request.body.linked_experience_id as any) : undefined,
        })
        .returning();

      const moment = momentResult[0]!;

      // Insert places if provided
      if (request.body.places && request.body.places.length > 0) {
        const placeValues = request.body.places.map((p) => ({
          momentId: moment.id,
          placeId: p.place_id,
          placeName: p.place_name,
          placeAddress: p.place_address,
        }));
        await app.db.insert(schema.momentPlaces).values(placeValues);
      }

      // Fetch the created moment with all details
      const result = await app.db
        .select()
        .from(schema.moments)
        .where(eq(schema.moments.id, moment.id))
        .limit(1);

      if (result.length === 0) {
        return reply.status(201).send({
          id: moment.id,
          user_id: moment.userId,
          video_url: moment.videoUrl,
          created_at: moment.createdAt,
        });
      }

      const m = result[0];
      const places = await app.db.select().from(schema.momentPlaces).where(eq(schema.momentPlaces.momentId, m.id));

      const profile = await app.db.select().from(schema.profiles).where(eq(schema.profiles.id, m.userId)).limit(1);

      let linkedExperience: LinkedExperience | null = null;
      if (m.linkedExperienceId) {
        const exp = await app.db
          .select({
            id: schema.experiences.id,
            videoUrl: schema.experiences.videoUrl,
            thumbnailUrl: schema.experiences.thumbnailUrl,
            title: schema.experiences.title,
          })
          .from(schema.experiences)
          .where(eq(schema.experiences.id, m.linkedExperienceId))
          .limit(1);

        if (exp.length > 0) {
          linkedExperience = {
            id: exp[0].id,
            video_url: exp[0].videoUrl,
            thumbnail_url: exp[0].thumbnailUrl,
            title: exp[0].title,
          };
        }
      }

      app.logger.info({ momentId: moment.id, userId: session.user.id }, 'Moment created successfully');

      reply.status(201);
      return {
        id: m.id,
        user_id: m.userId,
        video_url: m.videoUrl,
        thumbnail_url: m.thumbnailUrl,
        caption: m.caption,
        linked_experience_id: m.linkedExperienceId,
        linked_experience: linkedExperience,
        likes_count: 0,
        bookmarks_count: 0,
        is_liked: false,
        is_bookmarked: false,
        places: places.map((p) => ({
          id: p.id,
          place_id: p.placeId,
          place_name: p.placeName,
          place_address: p.placeAddress,
        })),
        user: {
          id: profile[0]?.id || m.userId,
          username: profile[0]?.username || 'unknown',
          avatar_url: profile[0]?.avatarUrl || null,
        },
        created_at: m.createdAt.toISOString(),
      };
    } catch (error) {
      app.logger.error({ err: error, body: request.body, userId: session.user.id }, 'Failed to create moment');
      throw error;
    }
  });

  // GET /api/moments/:id - Get single moment
  app.fastify.get('/api/moments/:id', {
    schema: {
      description: 'Get a moment by ID',
      tags: ['moments'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        200: { type: 'object' },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<MomentResponse | void> => {
    app.logger.info({ momentId: request.params.id }, 'Fetching moment');

    const moment = await app.db
      .select()
      .from(schema.moments)
      .where(eq(schema.moments.id, request.params.id as any))
      .limit(1);

    if (moment.length === 0) {
      app.logger.info({ momentId: request.params.id }, 'Moment not found');
      return reply.status(404).send({ error: 'Moment not found' });
    }

    const m = moment[0];
    const places = await app.db.select().from(schema.momentPlaces).where(eq(schema.momentPlaces.momentId, m.id));

    const profile = await app.db.select().from(schema.profiles).where(eq(schema.profiles.id, m.userId)).limit(1);

    const likesCount = await app.db.select({ count: countDistinct(schema.momentLikes.id) }).from(schema.momentLikes).where(eq(schema.momentLikes.momentId, m.id));

    const bookmarksCount = await app.db.select({ count: countDistinct(schema.momentBookmarks.id) }).from(schema.momentBookmarks).where(eq(schema.momentBookmarks.momentId, m.id));

    let isLiked = false;
    let isBookmarked = false;
    let currentUserId: string | null = null;

    try {
      const authApi = (app as any).auth?.api;
      if (authApi && request.headers.authorization) {
        const headers = new Headers();
        if (typeof request.headers.authorization === 'string') {
          headers.set('authorization', request.headers.authorization);
        }
        const session = await authApi.getSession({ headers });
        currentUserId = session?.user?.id || null;
      }
    } catch {
      currentUserId = null;
    }

    if (currentUserId) {
      const userLike = await app.db
        .select()
        .from(schema.momentLikes)
        .where(and(eq(schema.momentLikes.momentId, m.id), eq(schema.momentLikes.userId, currentUserId)))
        .limit(1);

      const userBookmark = await app.db
        .select()
        .from(schema.momentBookmarks)
        .where(and(eq(schema.momentBookmarks.momentId, m.id), eq(schema.momentBookmarks.userId, currentUserId)))
        .limit(1);

      isLiked = userLike.length > 0;
      isBookmarked = userBookmark.length > 0;
    }

    let linkedExperience: LinkedExperience | null = null;
    if (m.linkedExperienceId) {
      const exp = await app.db
        .select({
          id: schema.experiences.id,
          videoUrl: schema.experiences.videoUrl,
          thumbnailUrl: schema.experiences.thumbnailUrl,
          title: schema.experiences.title,
        })
        .from(schema.experiences)
        .where(eq(schema.experiences.id, m.linkedExperienceId))
        .limit(1);

      if (exp.length > 0) {
        linkedExperience = {
          id: exp[0].id,
          video_url: exp[0].videoUrl,
          thumbnail_url: exp[0].thumbnailUrl,
          title: exp[0].title,
        };
      }
    }

    return {
      id: m.id,
      user_id: m.userId,
      video_url: m.videoUrl,
      thumbnail_url: m.thumbnailUrl,
      caption: m.caption,
      linked_experience_id: m.linkedExperienceId,
      linked_experience: linkedExperience,
      likes_count: Number(likesCount[0]?.count) || 0,
      bookmarks_count: Number(bookmarksCount[0]?.count) || 0,
      is_liked: isLiked,
      is_bookmarked: isBookmarked,
      places: places.map((p) => ({
        id: p.id,
        place_id: p.placeId,
        place_name: p.placeName,
        place_address: p.placeAddress,
      })),
      user: {
        id: profile[0]?.id || m.userId,
        username: profile[0]?.username || 'unknown',
        avatar_url: profile[0]?.avatarUrl || null,
      },
      created_at: m.createdAt.toISOString(),
    };
  });

  // DELETE /api/moments/:id - Delete moment (requires auth)
  app.fastify.delete('/api/moments/:id', {
    schema: {
      description: 'Delete a moment',
      tags: ['moments'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        200: { type: 'object', properties: { success: { type: 'boolean' } } },
        403: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<{ success: boolean } | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ momentId: request.params.id, userId: session.user.id }, 'Deleting moment');

    const moment = await app.db
      .select()
      .from(schema.moments)
      .where(eq(schema.moments.id, request.params.id as any))
      .limit(1);

    if (moment.length === 0) {
      app.logger.info({ momentId: request.params.id }, 'Moment not found');
      return reply.status(404).send({ error: 'Moment not found' });
    }

    if (moment[0].userId !== session.user.id) {
      app.logger.warn({ momentId: request.params.id, userId: session.user.id, ownerId: moment[0].userId }, 'Unauthorized delete attempt');
      return reply.status(403).send({ error: 'Unauthorized' });
    }

    await app.db.delete(schema.moments).where(eq(schema.moments.id, request.params.id as any));

    app.logger.info({ momentId: request.params.id, userId: session.user.id }, 'Moment deleted successfully');
    return { success: true };
  });

  // POST /api/moments/:id/like - Toggle like (requires auth)
  app.fastify.post('/api/moments/:id/like', {
    schema: {
      description: 'Toggle like on a moment',
      tags: ['moments'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        200: { type: 'object', properties: { liked: { type: 'boolean' }, likes_count: { type: 'integer' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<{ liked: boolean; likes_count: number } | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ momentId: request.params.id, userId: session.user.id }, 'Toggling moment like');

    // Check if moment exists
    const moment = await app.db
      .select()
      .from(schema.moments)
      .where(eq(schema.moments.id, request.params.id as any))
      .limit(1);

    if (moment.length === 0) {
      app.logger.info({ momentId: request.params.id }, 'Moment not found');
      return reply.status(404).send({ error: 'Moment not found' });
    }

    // Check if already liked
    const existingLike = await app.db
      .select()
      .from(schema.momentLikes)
      .where(and(eq(schema.momentLikes.momentId, request.params.id as any), eq(schema.momentLikes.userId, session.user.id)))
      .limit(1);

    let liked = false;

    if (existingLike.length > 0) {
      // Delete like
      await app.db.delete(schema.momentLikes).where(eq(schema.momentLikes.id, existingLike[0].id));
      liked = false;
    } else {
      // Insert like
      await app.db.insert(schema.momentLikes).values({
        momentId: request.params.id as any,
        userId: session.user.id,
      });
      liked = true;
    }

    // Get current count
    const likesCount = await app.db.select({ count: countDistinct(schema.momentLikes.id) }).from(schema.momentLikes).where(eq(schema.momentLikes.momentId, request.params.id as any));

    app.logger.info({ momentId: request.params.id, userId: session.user.id, liked }, 'Moment like toggled');
    return {
      liked,
      likes_count: Number(likesCount[0]?.count) || 0,
    };
  });

  // POST /api/moments/:id/bookmark - Toggle bookmark (requires auth)
  app.fastify.post('/api/moments/:id/bookmark', {
    schema: {
      description: 'Toggle bookmark on a moment',
      tags: ['moments'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        200: { type: 'object', properties: { bookmarked: { type: 'boolean' }, bookmarks_count: { type: 'integer' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<{ bookmarked: boolean; bookmarks_count: number } | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ momentId: request.params.id, userId: session.user.id }, 'Toggling moment bookmark');

    // Check if moment exists
    const moment = await app.db
      .select()
      .from(schema.moments)
      .where(eq(schema.moments.id, request.params.id as any))
      .limit(1);

    if (moment.length === 0) {
      app.logger.info({ momentId: request.params.id }, 'Moment not found');
      return reply.status(404).send({ error: 'Moment not found' });
    }

    // Check if already bookmarked
    const existingBookmark = await app.db
      .select()
      .from(schema.momentBookmarks)
      .where(and(eq(schema.momentBookmarks.momentId, request.params.id as any), eq(schema.momentBookmarks.userId, session.user.id)))
      .limit(1);

    let bookmarked = false;

    if (existingBookmark.length > 0) {
      // Delete bookmark
      await app.db.delete(schema.momentBookmarks).where(eq(schema.momentBookmarks.id, existingBookmark[0].id));
      bookmarked = false;
    } else {
      // Insert bookmark
      await app.db.insert(schema.momentBookmarks).values({
        momentId: request.params.id as any,
        userId: session.user.id,
      });
      bookmarked = true;
    }

    // Get current count
    const bookmarksCount = await app.db
      .select({ count: countDistinct(schema.momentBookmarks.id) })
      .from(schema.momentBookmarks)
      .where(eq(schema.momentBookmarks.momentId, request.params.id as any));

    app.logger.info({ momentId: request.params.id, userId: session.user.id, bookmarked }, 'Moment bookmark toggled');
    return {
      bookmarked,
      bookmarks_count: Number(bookmarksCount[0]?.count) || 0,
    };
  });
}
