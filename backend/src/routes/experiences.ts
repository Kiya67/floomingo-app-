import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, desc, lt, countDistinct } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

interface CreateExperienceBody {
  video_url: string;
  thumbnail_url?: string;
  title: string;
  description?: string;
  linked_moment_id?: string;
  places?: Array<{ place_id: string; place_name: string; place_address?: string }>;
}

interface ExperiencePlace {
  id: string;
  place_id: string;
  place_name: string;
  place_address: string | null;
}

interface LinkedMoment {
  id: string;
  video_url: string;
  thumbnail_url: string | null;
  caption: string | null;
}

interface ExperienceResponse {
  id: string;
  user_id: string;
  video_url: string;
  thumbnail_url: string | null;
  title: string;
  description: string | null;
  linked_moment_id: string | null;
  linked_moment: LinkedMoment | null;
  likes_count: number;
  bookmarks_count: number;
  is_liked: boolean;
  is_bookmarked: boolean;
  places: ExperiencePlace[];
  user: { id: string; username: string; avatar_url: string | null };
  created_at: string;
}

export function registerExperienceRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // GET /api/experiences - List experiences with cursor pagination
  app.fastify.get('/api/experiences', {
    schema: {
      description: 'List experiences with cursor pagination',
      tags: ['experiences'],
      querystring: {
        type: 'object',
        properties: {
          cursor: { type: 'string', description: 'Base64-encoded ISO timestamp for cursor pagination' },
          limit: { type: 'integer', default: 20, description: 'Number of results to return' },
          user_id: { type: 'string', description: 'Filter experiences by user ID' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            experiences: {
              type: 'array',
              items: { type: 'object' },
            },
            next_cursor: { type: ['string', 'null'] },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Querystring: { cursor?: string; limit?: string; user_id?: string } }>,
    reply: FastifyReply
  ): Promise<{ experiences: ExperienceResponse[]; next_cursor: string | null }> => {
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
        experience: schema.experiences,
        profile: schema.profiles,
        likeCount: countDistinct(schema.experienceLikes.id),
        bookmarkCount: countDistinct(schema.experienceBookmarks.id),
      })
      .from(schema.experiences)
      .leftJoin(schema.profiles, eq(schema.profiles.id, schema.experiences.userId))
      .leftJoin(schema.experienceLikes, eq(schema.experienceLikes.experienceId, schema.experiences.id))
      .leftJoin(schema.experienceBookmarks, eq(schema.experienceBookmarks.experienceId, schema.experiences.id));

    // Apply filters
    const conditions = [];
    if (cursorDate) {
      conditions.push(lt(schema.experiences.createdAt, cursorDate));
    }
    if (request.query.user_id) {
      conditions.push(eq(schema.experiences.userId, request.query.user_id));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const experiencesData = await query
      .groupBy(schema.experiences.id, schema.profiles.id)
      .orderBy(desc(schema.experiences.createdAt))
      .limit(limit + 1);

    app.logger.info(
      { count: experiencesData.length, limit, cursor: request.query.cursor, userId: request.query.user_id },
      'Fetched experiences'
    );

    const hasMore = experiencesData.length > limit;
    const experiences = experiencesData.slice(0, limit);

    // Get current user session if authenticated
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

    // Fetch full details for each experience
    const experienceResponses: ExperienceResponse[] = [];

    for (const e of experiences) {
      // Get places
      const places = await app.db
        .select()
        .from(schema.experiencePlaces)
        .where(eq(schema.experiencePlaces.experienceId, e.experience.id));

      // Get likes and bookmarks for current user if authenticated
      let isLiked = false;
      let isBookmarked = false;

      if (currentUserId) {
        const userLike = await app.db
          .select()
          .from(schema.experienceLikes)
          .where(and(eq(schema.experienceLikes.experienceId, e.experience.id), eq(schema.experienceLikes.userId, currentUserId)))
          .limit(1);

        const userBookmark = await app.db
          .select()
          .from(schema.experienceBookmarks)
          .where(and(eq(schema.experienceBookmarks.experienceId, e.experience.id), eq(schema.experienceBookmarks.userId, currentUserId)))
          .limit(1);

        isLiked = userLike.length > 0;
        isBookmarked = userBookmark.length > 0;
      }

      // Get linked moment
      let linkedMoment: LinkedMoment | null = null;
      if (e.experience.linkedMomentId) {
        const mom = await app.db
          .select({
            id: schema.moments.id,
            videoUrl: schema.moments.videoUrl,
            thumbnailUrl: schema.moments.thumbnailUrl,
            caption: schema.moments.caption,
          })
          .from(schema.moments)
          .where(eq(schema.moments.id, e.experience.linkedMomentId))
          .limit(1);

        if (mom.length > 0) {
          linkedMoment = {
            id: mom[0].id,
            video_url: mom[0].videoUrl,
            thumbnail_url: mom[0].thumbnailUrl,
            caption: mom[0].caption,
          };
        }
      }

      experienceResponses.push({
        id: e.experience.id,
        user_id: e.experience.userId,
        video_url: e.experience.videoUrl,
        thumbnail_url: e.experience.thumbnailUrl,
        title: e.experience.title,
        description: e.experience.description,
        linked_moment_id: e.experience.linkedMomentId,
        linked_moment: linkedMoment,
        likes_count: Number(e.likeCount) || 0,
        bookmarks_count: Number(e.bookmarkCount) || 0,
        is_liked: isLiked,
        is_bookmarked: isBookmarked,
        places: places.map((p) => ({
          id: p.id,
          place_id: p.placeId,
          place_name: p.placeName,
          place_address: p.placeAddress,
        })),
        user: {
          id: e.profile?.id || e.experience.userId,
          username: e.profile?.username || 'unknown',
          avatar_url: e.profile?.avatarUrl || null,
        },
        created_at: e.experience.createdAt.toISOString(),
      });
    }

    const nextCursor = hasMore ? Buffer.from(experiences[experiences.length - 1].experience.createdAt.toISOString()).toString('base64') : null;

    return {
      experiences: experienceResponses,
      next_cursor: nextCursor,
    };
  });

  // POST /api/experiences - Create experience (requires auth)
  app.fastify.post('/api/experiences', {
    schema: {
      description: 'Create a new experience',
      tags: ['experiences'],
      body: {
        type: 'object',
        required: ['video_url', 'title'],
        properties: {
          video_url: { type: 'string' },
          thumbnail_url: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          linked_moment_id: { type: 'string', format: 'uuid' },
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
    request: FastifyRequest<{ Body: CreateExperienceBody }>,
    reply: FastifyReply
  ): Promise<ExperienceResponse | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ body: request.body, userId: session.user.id }, 'Creating experience');

    try {
      const experienceResult = await app.db
        .insert(schema.experiences)
        .values({
          userId: session.user.id,
          videoUrl: request.body.video_url,
          thumbnailUrl: request.body.thumbnail_url,
          title: request.body.title,
          description: request.body.description,
          linkedMomentId: request.body.linked_moment_id ? (request.body.linked_moment_id as any) : undefined,
        })
        .returning();

      const experience = experienceResult[0]!;

      // Insert places if provided
      if (request.body.places && request.body.places.length > 0) {
        const placeValues = request.body.places.map((p) => ({
          experienceId: experience.id,
          placeId: p.place_id,
          placeName: p.place_name,
          placeAddress: p.place_address,
        }));
        await app.db.insert(schema.experiencePlaces).values(placeValues);
      }

      // Fetch the created experience with all details
      const result = await app.db
        .select()
        .from(schema.experiences)
        .where(eq(schema.experiences.id, experience.id))
        .limit(1);

      if (result.length === 0) {
        return reply.status(201).send({
          id: experience.id,
          user_id: experience.userId,
          video_url: experience.videoUrl,
          created_at: experience.createdAt,
        });
      }

      const e = result[0];
      const places = await app.db.select().from(schema.experiencePlaces).where(eq(schema.experiencePlaces.experienceId, e.id));

      const profile = await app.db.select().from(schema.profiles).where(eq(schema.profiles.id, e.userId)).limit(1);

      let linkedMoment: LinkedMoment | null = null;
      if (e.linkedMomentId) {
        const mom = await app.db
          .select({
            id: schema.moments.id,
            videoUrl: schema.moments.videoUrl,
            thumbnailUrl: schema.moments.thumbnailUrl,
            caption: schema.moments.caption,
          })
          .from(schema.moments)
          .where(eq(schema.moments.id, e.linkedMomentId))
          .limit(1);

        if (mom.length > 0) {
          linkedMoment = {
            id: mom[0].id,
            video_url: mom[0].videoUrl,
            thumbnail_url: mom[0].thumbnailUrl,
            caption: mom[0].caption,
          };
        }
      }

      app.logger.info({ experienceId: experience.id, userId: session.user.id }, 'Experience created successfully');

      reply.status(201);
      return {
        id: e.id,
        user_id: e.userId,
        video_url: e.videoUrl,
        thumbnail_url: e.thumbnailUrl,
        title: e.title,
        description: e.description,
        linked_moment_id: e.linkedMomentId,
        linked_moment: linkedMoment,
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
          id: profile[0]?.id || e.userId,
          username: profile[0]?.username || 'unknown',
          avatar_url: profile[0]?.avatarUrl || null,
        },
        created_at: e.createdAt.toISOString(),
      };
    } catch (error) {
      app.logger.error({ err: error, body: request.body, userId: session.user.id }, 'Failed to create experience');
      throw error;
    }
  });

  // GET /api/experiences/:id - Get single experience
  app.fastify.get('/api/experiences/:id', {
    schema: {
      description: 'Get an experience by ID',
      tags: ['experiences'],
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
  ): Promise<ExperienceResponse | void> => {
    app.logger.info({ experienceId: request.params.id }, 'Fetching experience');

    const experience = await app.db
      .select()
      .from(schema.experiences)
      .where(eq(schema.experiences.id, request.params.id as any))
      .limit(1);

    if (experience.length === 0) {
      app.logger.info({ experienceId: request.params.id }, 'Experience not found');
      return reply.status(404).send({ error: 'Experience not found' });
    }

    const e = experience[0];
    const places = await app.db.select().from(schema.experiencePlaces).where(eq(schema.experiencePlaces.experienceId, e.id));

    const profile = await app.db.select().from(schema.profiles).where(eq(schema.profiles.id, e.userId)).limit(1);

    const likesCount = await app.db
      .select({ count: countDistinct(schema.experienceLikes.id) })
      .from(schema.experienceLikes)
      .where(eq(schema.experienceLikes.experienceId, e.id));

    const bookmarksCount = await app.db
      .select({ count: countDistinct(schema.experienceBookmarks.id) })
      .from(schema.experienceBookmarks)
      .where(eq(schema.experienceBookmarks.experienceId, e.id));

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
        .from(schema.experienceLikes)
        .where(and(eq(schema.experienceLikes.experienceId, e.id), eq(schema.experienceLikes.userId, currentUserId)))
        .limit(1);

      const userBookmark = await app.db
        .select()
        .from(schema.experienceBookmarks)
        .where(and(eq(schema.experienceBookmarks.experienceId, e.id), eq(schema.experienceBookmarks.userId, currentUserId)))
        .limit(1);

      isLiked = userLike.length > 0;
      isBookmarked = userBookmark.length > 0;
    }

    let linkedMoment: LinkedMoment | null = null;
    if (e.linkedMomentId) {
      const mom = await app.db
        .select({
          id: schema.moments.id,
          videoUrl: schema.moments.videoUrl,
          thumbnailUrl: schema.moments.thumbnailUrl,
          caption: schema.moments.caption,
        })
        .from(schema.moments)
        .where(eq(schema.moments.id, e.linkedMomentId))
        .limit(1);

      if (mom.length > 0) {
        linkedMoment = {
          id: mom[0].id,
          video_url: mom[0].videoUrl,
          thumbnail_url: mom[0].thumbnailUrl,
          caption: mom[0].caption,
        };
      }
    }

    return {
      id: e.id,
      user_id: e.userId,
      video_url: e.videoUrl,
      thumbnail_url: e.thumbnailUrl,
      title: e.title,
      description: e.description,
      linked_moment_id: e.linkedMomentId,
      linked_moment: linkedMoment,
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
        id: profile[0]?.id || e.userId,
        username: profile[0]?.username || 'unknown',
        avatar_url: profile[0]?.avatarUrl || null,
      },
      created_at: e.createdAt.toISOString(),
    };
  });

  // DELETE /api/experiences/:id - Delete experience (requires auth)
  app.fastify.delete('/api/experiences/:id', {
    schema: {
      description: 'Delete an experience',
      tags: ['experiences'],
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

    app.logger.info({ experienceId: request.params.id, userId: session.user.id }, 'Deleting experience');

    const experience = await app.db
      .select()
      .from(schema.experiences)
      .where(eq(schema.experiences.id, request.params.id as any))
      .limit(1);

    if (experience.length === 0) {
      app.logger.info({ experienceId: request.params.id }, 'Experience not found');
      return reply.status(404).send({ error: 'Experience not found' });
    }

    if (experience[0].userId !== session.user.id) {
      app.logger.warn({ experienceId: request.params.id, userId: session.user.id, ownerId: experience[0].userId }, 'Unauthorized delete attempt');
      return reply.status(403).send({ error: 'Unauthorized' });
    }

    await app.db.delete(schema.experiences).where(eq(schema.experiences.id, request.params.id as any));

    app.logger.info({ experienceId: request.params.id, userId: session.user.id }, 'Experience deleted successfully');
    return { success: true };
  });

  // POST /api/experiences/:id/like - Toggle like (requires auth)
  app.fastify.post('/api/experiences/:id/like', {
    schema: {
      description: 'Toggle like on an experience',
      tags: ['experiences'],
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

    app.logger.info({ experienceId: request.params.id, userId: session.user.id }, 'Toggling experience like');

    // Check if experience exists
    const experience = await app.db
      .select()
      .from(schema.experiences)
      .where(eq(schema.experiences.id, request.params.id as any))
      .limit(1);

    if (experience.length === 0) {
      app.logger.info({ experienceId: request.params.id }, 'Experience not found');
      return reply.status(404).send({ error: 'Experience not found' });
    }

    // Check if already liked
    const existingLike = await app.db
      .select()
      .from(schema.experienceLikes)
      .where(and(eq(schema.experienceLikes.experienceId, request.params.id as any), eq(schema.experienceLikes.userId, session.user.id)))
      .limit(1);

    let liked = false;

    if (existingLike.length > 0) {
      // Delete like
      await app.db.delete(schema.experienceLikes).where(eq(schema.experienceLikes.id, existingLike[0].id));
      liked = false;
    } else {
      // Insert like
      await app.db.insert(schema.experienceLikes).values({
        experienceId: request.params.id as any,
        userId: session.user.id,
      });
      liked = true;
    }

    // Get current count
    const likesCount = await app.db
      .select({ count: countDistinct(schema.experienceLikes.id) })
      .from(schema.experienceLikes)
      .where(eq(schema.experienceLikes.experienceId, request.params.id as any));

    app.logger.info({ experienceId: request.params.id, userId: session.user.id, liked }, 'Experience like toggled');
    return {
      liked,
      likes_count: Number(likesCount[0]?.count) || 0,
    };
  });

  // POST /api/experiences/:id/bookmark - Toggle bookmark (requires auth)
  app.fastify.post('/api/experiences/:id/bookmark', {
    schema: {
      description: 'Toggle bookmark on an experience',
      tags: ['experiences'],
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

    app.logger.info({ experienceId: request.params.id, userId: session.user.id }, 'Toggling experience bookmark');

    // Check if experience exists
    const experience = await app.db
      .select()
      .from(schema.experiences)
      .where(eq(schema.experiences.id, request.params.id as any))
      .limit(1);

    if (experience.length === 0) {
      app.logger.info({ experienceId: request.params.id }, 'Experience not found');
      return reply.status(404).send({ error: 'Experience not found' });
    }

    // Check if already bookmarked
    const existingBookmark = await app.db
      .select()
      .from(schema.experienceBookmarks)
      .where(and(eq(schema.experienceBookmarks.experienceId, request.params.id as any), eq(schema.experienceBookmarks.userId, session.user.id)))
      .limit(1);

    let bookmarked = false;

    if (existingBookmark.length > 0) {
      // Delete bookmark
      await app.db.delete(schema.experienceBookmarks).where(eq(schema.experienceBookmarks.id, existingBookmark[0].id));
      bookmarked = false;
    } else {
      // Insert bookmark
      await app.db.insert(schema.experienceBookmarks).values({
        experienceId: request.params.id as any,
        userId: session.user.id,
      });
      bookmarked = true;
    }

    // Get current count
    const bookmarksCount = await app.db
      .select({ count: countDistinct(schema.experienceBookmarks.id) })
      .from(schema.experienceBookmarks)
      .where(eq(schema.experienceBookmarks.experienceId, request.params.id as any));

    app.logger.info({ experienceId: request.params.id, userId: session.user.id, bookmarked }, 'Experience bookmark toggled');
    return {
      bookmarked,
      bookmarks_count: Number(bookmarksCount[0]?.count) || 0,
    };
  });
}
