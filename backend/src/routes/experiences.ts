import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, desc, lt, and, sql } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';
import { randomBytes } from 'crypto';

interface ExperienceResponse {
  id: string;
  user_id: string;
  video_url: string;
  thumbnail_url: string | null;
  title: string;
  description: string | null;
  location: string | null;
  duration: number | null;
  view_count: number;
  created_at: string;
  user: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export function registerExperienceRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // POST /api/experiences - Create experience with multipart form data
  app.fastify.post('/api/experiences', {
    schema: {
      description: 'Create a new experience with video and optional thumbnail upload',
      tags: ['experiences'],
      consumes: ['multipart/form-data'],
      response: {
        201: {
          description: 'Experience created successfully',
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            user_id: { type: 'string' },
            video_url: { type: 'string' },
            thumbnail_url: { type: ['string', 'null'] },
            title: { type: 'string' },
            description: { type: ['string', 'null'] },
            location: { type: ['string', 'null'] },
            duration: { type: ['integer', 'null'] },
            view_count: { type: 'integer' },
            created_at: { type: 'string', format: 'date-time' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                username: { type: ['string', 'null'] },
                display_name: { type: ['string', 'null'] },
                avatar_url: { type: ['string', 'null'] },
              },
            },
          },
        },
        400: {
          description: 'Bad request',
          type: 'object',
          properties: { error: { type: 'string' } },
        },
        401: {
          description: 'Unauthorized',
          type: 'object',
          properties: { error: { type: 'string' } },
        },
        500: {
          description: 'Internal server error',
          type: 'object',
          properties: { error: { type: 'string' } },
        },
      },
    },
  }, async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<ExperienceResponse | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Creating experience with file upload');

    try {
      const fields: Record<string, string> = {};
      const files: Record<string, Buffer> = {};
      const fileMetadata: Record<string, { mimetype: string; filename: string }> = {};

      // Parse all multipart fields and files
      // @ts-ignore - request.parts() returns an async iterable
      for await (const part of request.parts()) {
        if (part.type === 'field') {
          fields[part.fieldname] = part.value as string;
        } else if (part.type === 'file') {
          const buffer = await part.toBuffer();
          files[part.fieldname] = buffer;
          fileMetadata[part.fieldname] = {
            mimetype: part.mimetype,
            filename: part.filename,
          };
        }
      }

      // Validate required fields
      if (!files.video) {
        app.logger.warn({ userId: session.user.id }, 'No video file provided');
        return reply.status(400).send({ error: 'No video file provided' });
      }

      const title = fields.title;
      if (!title) {
        app.logger.warn({ userId: session.user.id }, 'Title is required');
        return reply.status(400).send({ error: 'Title is required' });
      }

      const description = fields.description || null;
      const location = fields.location || null;
      const duration = fields.duration ? parseInt(fields.duration) : null;

      // Upload video file
      const videoExt = getFileExtension(fileMetadata.video.mimetype, fileMetadata.video.filename);
      const videoKey = `${session.user.id}/${generateUUID()}.${videoExt}`;

      app.logger.info({ userId: session.user.id, videoKey }, 'Uploading video');
      await app.storage.upload(videoKey, files.video);
      const { url: videoUrl } = await app.storage.getSignedUrl(videoKey);

      // Upload thumbnail if provided
      let thumbnailUrl: string | null = null;
      if (files.thumbnail) {
        try {
          const thumbExt = getFileExtension(fileMetadata.thumbnail.mimetype, fileMetadata.thumbnail.filename);
          const thumbKey = `thumbnails/${session.user.id}/${generateUUID()}.${thumbExt}`;

          app.logger.info({ userId: session.user.id, thumbKey }, 'Uploading thumbnail');
          await app.storage.upload(thumbKey, files.thumbnail);
          const { url: thumbUrl } = await app.storage.getSignedUrl(thumbKey);
          thumbnailUrl = thumbUrl;
        } catch (err) {
          app.logger.warn({ err, userId: session.user.id }, 'Failed to upload thumbnail');
          // Continue without thumbnail
        }
      }

      // Insert into database
      const result = await app.db
        .insert(schema.experiences)
        .values({
          userId: session.user.id,
          videoUrl,
          thumbnailUrl,
          title,
          description,
          location,
          duration,
          viewCount: 0,
        })
        .returning();

      const newExperience = (Array.isArray(result) ? result[0] : result) as typeof schema.experiences.$inferInsert & { id: string; createdAt: Date };

      // Fetch user profile
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
        location: newExperience.location,
        duration: newExperience.duration,
        view_count: newExperience.viewCount,
        created_at: newExperience.createdAt.toISOString(),
        user: {
          id: profile[0]?.id || session.user.id,
          username: profile[0]?.username || null,
          display_name: profile[0]?.displayName || null,
          avatar_url: profile[0]?.avatarUrl || null,
        },
      };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to create experience');
      return reply.status(500).send({ error: 'Failed to create experience' });
    }
  });

  // GET /api/experiences - List experiences with cursor pagination
  app.fastify.get('/api/experiences', {
    schema: {
      description: 'List experiences with cursor pagination',
      tags: ['experiences'],
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', default: 20, description: 'Number of results to return (max 50)' },
          cursor: { type: 'string', description: 'ISO timestamp for cursor-based pagination' },
        },
      },
      response: {
        200: {
          description: 'Experiences retrieved successfully',
          type: 'object',
          properties: {
            experiences: { type: 'array' },
            next_cursor: { type: ['string', 'null'] },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Querystring: { limit?: string; cursor?: string } }>,
    reply: FastifyReply
  ): Promise<{ experiences: ExperienceResponse[]; next_cursor: string | null }> => {
    const limit = Math.min(parseInt(request.query.limit || '20'), 50);
    let cursorDate: Date | null = null;

    if (request.query.cursor) {
      try {
        cursorDate = new Date(request.query.cursor);
      } catch {
        app.logger.warn({ cursor: request.query.cursor }, 'Invalid cursor');
      }
    }

    app.logger.info({ limit, cursor: request.query.cursor }, 'Fetching experiences');

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

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const experiencesData = await query
      .orderBy(desc(schema.experiences.createdAt))
      .limit(limit + 1);

    const hasMore = experiencesData.length > limit;
    const experiences = experiencesData.slice(0, limit);

    const result: ExperienceResponse[] = experiences.map((e) => ({
      id: e.experience.id,
      user_id: e.experience.userId,
      video_url: e.experience.videoUrl,
      thumbnail_url: e.experience.thumbnailUrl,
      title: e.experience.title,
      description: e.experience.description,
      location: e.experience.location,
      duration: e.experience.duration,
      view_count: e.experience.viewCount,
      created_at: e.experience.createdAt.toISOString(),
      user: {
        id: e.profile?.id || e.experience.userId,
        username: e.profile?.username || null,
        display_name: e.profile?.displayName || null,
        avatar_url: e.profile?.avatarUrl || null,
      },
    }));

    const nextCursor = hasMore ? experiences[experiences.length - 1].experience.createdAt.toISOString() : null;

    return {
      experiences: result,
      next_cursor: nextCursor,
    };
  });

  // GET /api/experiences/:id - Get single experience and increment view count
  app.fastify.get('/api/experiences/:id', {
    schema: {
      description: 'Get a single experience by ID',
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
          properties: {
            id: { type: 'string', format: 'uuid' },
            user_id: { type: 'string' },
            video_url: { type: 'string' },
            thumbnail_url: { type: ['string', 'null'] },
            title: { type: 'string' },
            description: { type: ['string', 'null'] },
            location: { type: ['string', 'null'] },
            duration: { type: ['integer', 'null'] },
            view_count: { type: 'integer' },
            created_at: { type: 'string', format: 'date-time' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                username: { type: ['string', 'null'] },
                display_name: { type: ['string', 'null'] },
                avatar_url: { type: ['string', 'null'] },
              },
            },
          },
        },
        404: {
          description: 'Experience not found',
          type: 'object',
          properties: { error: { type: 'string' } },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<ExperienceResponse | void> => {
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

      // Increment view count (fire and forget)
      app.db
        .update(schema.experiences)
        .set({ viewCount: e.experience.viewCount + 1 })
        .where(eq(schema.experiences.id, request.params.id as any))
        .catch((err) => {
          app.logger.warn({ err, experienceId: request.params.id }, 'Failed to increment view count');
        });

      app.logger.info({ experienceId: request.params.id, viewCount: e.experience.viewCount + 1 }, 'Experience fetched');

      return {
        id: e.experience.id,
        user_id: e.experience.userId,
        video_url: e.experience.videoUrl,
        thumbnail_url: e.experience.thumbnailUrl,
        title: e.experience.title,
        description: e.experience.description,
        location: e.experience.location,
        duration: e.experience.duration,
        view_count: e.experience.viewCount,
        created_at: e.experience.createdAt.toISOString(),
        user: {
          id: e.profile?.id || e.experience.userId,
          username: e.profile?.username || null,
          display_name: e.profile?.displayName || null,
          avatar_url: e.profile?.avatarUrl || null,
        },
      };
    } catch (error) {
      app.logger.error({ err: error, experienceId: request.params.id }, 'Failed to fetch experience');
      throw error;
    }
  });
}

// Helper function to generate a simple UUID
function generateUUID(): string {
  const bytes = randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return [
    bytes.toString('hex', 0, 4),
    bytes.toString('hex', 4, 6),
    bytes.toString('hex', 6, 8),
    bytes.toString('hex', 8, 10),
    bytes.toString('hex', 10, 16),
  ].join('-');
}

// Helper function to extract file extension from mimetype
function getFileExtension(mimetype: string, filename: string): string {
  // Try to get extension from filename first
  const filenameExt = filename.split('.').pop()?.toLowerCase();
  if (filenameExt && /^[a-z0-9]+$/.test(filenameExt)) {
    return filenameExt;
  }

  // Fall back to mimetype mapping
  const mimetypeMap: Record<string, string> = {
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/x-msvideo': 'avi',
    'video/x-matroska': 'mkv',
    'video/webm': 'webm',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };

  return mimetypeMap[mimetype] || 'mp4';
}
