import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, desc, lt, and, sql } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

interface ExperienceData {
  id: string;
  user_id: string;
  video_url: string;
  thumbnail_url: string | null;
  title: string;
  description: string | null;
  linked_moment_id: string | null;
  created_at: string;
  user: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    username: string | null;
  };
  stats: {
    likes_count: number;
    comments_count: number;
    views_count: number;
  };
  is_liked: boolean;
  is_bookmarked: boolean;
}

export function registerExperienceRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // GET /api/experiences - List experiences with cursor pagination (requires auth)
  app.fastify.get('/api/experiences', {
    schema: {
      description: 'List experiences with cursor pagination (requires authentication)',
      tags: ['experiences'],
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', default: 20, description: 'Number of results to return' },
          cursor: { type: 'string', description: 'ISO timestamp for cursor-based pagination' },
          keywords: { type: 'string', description: 'Search keywords in title or description' },
        },
      },
      response: {
        200: {
          description: 'Experiences retrieved successfully',
          type: 'object',
          properties: {
            data: { type: 'array' },
            next_cursor: { type: ['string', 'null'] },
            has_more: { type: 'boolean' },
          },
        },
        401: {
          description: 'Unauthorized',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Querystring: { limit?: string; cursor?: string; keywords?: string } }>,
    reply: FastifyReply
  ): Promise<{ data: ExperienceData[]; next_cursor: string | null; has_more: boolean } | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const limit = Math.min(parseInt(request.query.limit || '20'), 100);
    let cursorDate: Date | null = null;

    if (request.query.cursor) {
      try {
        cursorDate = new Date(request.query.cursor);
      } catch {
        app.logger.warn({ cursor: request.query.cursor }, 'Invalid cursor');
      }
    }

    app.logger.info({ limit, cursor: request.query.cursor, keywords: request.query.keywords }, 'Fetching experiences');

    let query = app.db
      .select({
        experience: schema.experiences,
        profile: schema.profiles,
      })
      .from(schema.experiences)
      .leftJoin(schema.profiles, eq(schema.profiles.id, schema.experiences.userId));

    const conditions = [];
    if (cursorDate) {
      conditions.push(lt(schema.experiences.createdAt, cursorDate));
    }
    if (request.query.keywords) {
      conditions.push(
        sql`(${schema.experiences.title} ILIKE ${'%' + request.query.keywords + '%'} OR ${schema.experiences.description} ILIKE ${'%' + request.query.keywords + '%'})`
      );
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const experiencesData = await query
      .orderBy(desc(schema.experiences.createdAt))
      .limit(limit + 1);

    const hasMore = experiencesData.length > limit;
    const experiences = experiencesData.slice(0, limit);

    const data: ExperienceData[] = experiences.map((e) => ({
      id: e.experience.id,
      user_id: e.experience.userId,
      video_url: e.experience.videoUrl,
      thumbnail_url: e.experience.thumbnailUrl,
      title: e.experience.title,
      description: e.experience.description,
      linked_moment_id: e.experience.linkedMomentId,
      created_at: e.experience.createdAt.toISOString(),
      user: {
        id: e.profile?.id || e.experience.userId,
        display_name: e.profile?.displayName || null,
        avatar_url: e.profile?.avatarUrl || null,
        username: e.profile?.username || null,
      },
      stats: {
        likes_count: 0,
        comments_count: 0,
        views_count: 0,
      },
      is_liked: false,
      is_bookmarked: false,
    }));

    const nextCursor = hasMore ? experiences[experiences.length - 1].experience.createdAt.toISOString() : null;

    return {
      data,
      next_cursor: nextCursor,
      has_more: hasMore,
    };
  });

  // POST /api/experiences - Create an experience (requires auth)
  app.fastify.post('/api/experiences', {
    schema: {
      description: 'Create a new experience (requires authentication)',
      tags: ['experiences'],
      body: {
        type: 'object',
        required: ['video_url', 'title'],
        properties: {
          video_url: { type: 'string', description: 'Video URL' },
          title: { type: 'string', description: 'Experience title' },
          thumbnail_url: { type: 'string', description: 'Thumbnail URL (optional)' },
          description: { type: 'string', description: 'Experience description (optional)' },
          linked_moment_id: { type: 'string', format: 'uuid', description: 'Linked moment ID (optional)' },
        },
      },
      response: {
        201: {
          description: 'Experience created successfully',
          type: 'object',
        },
        400: {
          description: 'Bad request',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        401: {
          description: 'Unauthorized',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest<{
      Body: {
        video_url: string;
        title: string;
        thumbnail_url?: string;
        description?: string;
        linked_moment_id?: string;
      };
    }>,
    reply: FastifyReply
  ): Promise<ExperienceData | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { video_url, title, thumbnail_url, description, linked_moment_id } = request.body;

    app.logger.info({ userId: session.user.id, title }, 'Creating experience');

    try {
      const newExperienceResult = await app.db
        .insert(schema.experiences)
        .values({
          userId: session.user.id,
          videoUrl: video_url,
          title,
          thumbnailUrl: thumbnail_url || null,
          description: description || null,
          linkedMomentId: linked_moment_id ? (linked_moment_id as any) : null,
        })
        .returning() as any;

      const newExperience = (Array.isArray(newExperienceResult) ? newExperienceResult[0] : newExperienceResult) as typeof schema.experiences.$inferInsert & { id: string; createdAt: Date };

      const profile = await app.db
        .select()
        .from(schema.profiles)
        .where(eq(schema.profiles.id, session.user.id))
        .limit(1);

      app.logger.info({ userId: session.user.id, experienceId: newExperience.id }, 'Experience created successfully');

      reply.status(201);
      return {
        id: newExperience.id,
        user_id: newExperience.userId,
        video_url: newExperience.videoUrl,
        thumbnail_url: newExperience.thumbnailUrl,
        title: newExperience.title,
        description: newExperience.description,
        linked_moment_id: newExperience.linkedMomentId,
        created_at: newExperience.createdAt.toISOString(),
        user: {
          id: profile[0]?.id || session.user.id,
          display_name: profile[0]?.displayName || null,
          avatar_url: profile[0]?.avatarUrl || null,
          username: profile[0]?.username || null,
        },
        stats: {
          likes_count: 0,
          comments_count: 0,
          views_count: 0,
        },
        is_liked: false,
        is_bookmarked: false,
      };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to create experience');
      throw error;
    }
  });

  // GET /api/experiences/:id - Get a single experience (requires auth)
  app.fastify.get('/api/experiences/:id', {
    schema: {
      description: 'Get a single experience by ID (requires authentication)',
      tags: ['experiences'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid', description: 'Experience ID' },
        },
      },
      response: {
        200: {
          description: 'Experience retrieved successfully',
          type: 'object',
        },
        401: {
          description: 'Unauthorized',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        404: {
          description: 'Experience not found',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<ExperienceData | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ experienceId: request.params.id }, 'Fetching experience');

    try {
      const experienceRows = await app.db
        .select({
          experience: schema.experiences,
          profile: schema.profiles,
        })
        .from(schema.experiences)
        .leftJoin(schema.profiles, eq(schema.profiles.id, schema.experiences.userId))
        .where(eq(schema.experiences.id, request.params.id as any));

      if (!experienceRows || experienceRows.length === 0) {
        app.logger.info({ experienceId: request.params.id }, 'Experience not found');
        return reply.status(404).send({ error: 'Experience not found' });
      }

      const e = experienceRows[0];

      return {
        id: e.experience.id,
        user_id: e.experience.userId,
        video_url: e.experience.videoUrl,
        thumbnail_url: e.experience.thumbnailUrl,
        title: e.experience.title,
        description: e.experience.description,
        linked_moment_id: e.experience.linkedMomentId,
        created_at: e.experience.createdAt.toISOString(),
        user: {
          id: e.profile?.id || e.experience.userId,
          display_name: e.profile?.displayName || null,
          avatar_url: e.profile?.avatarUrl || null,
          username: e.profile?.username || null,
        },
        stats: {
          likes_count: 0,
          comments_count: 0,
          views_count: 0,
        },
        is_liked: false,
        is_bookmarked: false,
      };
    } catch (error) {
      app.logger.error({ err: error, experienceId: request.params.id }, 'Failed to fetch experience');
      throw error;
    }
  });
}
