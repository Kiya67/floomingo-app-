import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema.js';

export function registerProfileRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // GET /api/profile - Get authenticated user's profile
  app.fastify.get('/api/profile', {
    schema: {
      description: 'Get authenticated user profile',
      tags: ['profile'],
      response: {
        200: {
          description: 'Profile retrieved successfully',
          type: 'object',
          properties: {
            id: { type: 'string' },
            username: { type: ['string', 'null'] },
            display_name: { type: ['string', 'null'] },
            email: { type: ['string', 'null'] },
            avatar_url: { type: ['string', 'null'] },
            cover_url: { type: ['string', 'null'] },
            bio: { type: ['string', 'null'] },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        401: {
          description: 'Unauthorized',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        404: {
          description: 'Profile not found',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<{ id: string; username: string | null; display_name: string | null; email: string | null; avatar_url: string | null; cover_url: string | null; bio: string | null; created_at: Date; updated_at: Date } | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    app.logger.info({ userId }, 'Fetching user profile');

    try {
      const [profile] = await app.db.select({
        id: schema.profiles.id,
        username: schema.profiles.username,
        display_name: schema.profiles.displayName,
        email: schema.profiles.email,
        avatar_url: schema.profiles.avatarUrl,
        cover_url: schema.profiles.coverUrl,
        bio: schema.profiles.bio,
        created_at: schema.profiles.createdAt,
        updated_at: schema.profiles.updatedAt,
      }).from(schema.profiles)
        .where(eq(schema.profiles.id, userId))
        .limit(1);

      if (!profile) {
        app.logger.warn({ userId }, 'Profile not found');
        return reply.status(404).send({ error: 'Profile not found' });
      }

      app.logger.info({ userId }, 'Profile retrieved successfully');
      return profile;
    } catch (error) {
      app.logger.error({ err: error, userId }, 'Failed to fetch profile');
      throw error;
    }
  });

  // GET /api/profile/:userId - Get user profile by ID
  app.fastify.get('/api/profile/:userId', {
    schema: {
      description: 'Get user profile by ID',
      tags: ['profile'],
      params: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: { type: 'string', description: 'User ID' },
        },
      },
      response: {
        200: {
          description: 'Profile retrieved successfully',
          type: 'object',
          properties: {
            id: { type: 'string' },
            username: { type: ['string', 'null'] },
            display_name: { type: ['string', 'null'] },
            email: { type: ['string', 'null'] },
            avatar_url: { type: ['string', 'null'] },
            cover_url: { type: ['string', 'null'] },
            bio: { type: ['string', 'null'] },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        404: {
          description: 'Profile not found',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Params: { userId: string } }>,
    reply: FastifyReply
  ): Promise<{ id: string; username: string | null; display_name: string | null; email: string | null; avatar_url: string | null; cover_url: string | null; bio: string | null; created_at: Date; updated_at: Date } | void> => {
    const { userId } = request.params;

    app.logger.info({ userId }, 'Fetching user profile');

    try {
      const [profile] = await app.db.select({
        id: schema.profiles.id,
        username: schema.profiles.username,
        display_name: schema.profiles.displayName,
        email: schema.profiles.email,
        avatar_url: schema.profiles.avatarUrl,
        cover_url: schema.profiles.coverUrl,
        bio: schema.profiles.bio,
        created_at: schema.profiles.createdAt,
        updated_at: schema.profiles.updatedAt,
      }).from(schema.profiles)
        .where(eq(schema.profiles.id, userId))
        .limit(1);

      if (!profile) {
        app.logger.warn({ userId }, 'Profile not found');
        return reply.status(404).send({ error: 'Profile not found' });
      }

      app.logger.info({ userId }, 'Profile retrieved successfully');
      return profile;
    } catch (error) {
      app.logger.error({ err: error, userId }, 'Failed to fetch profile');
      throw error;
    }
  });

  // PUT /api/profile - Update authenticated user's profile
  app.fastify.put('/api/profile', {
    schema: {
      description: 'Update authenticated user profile',
      tags: ['profile'],
      body: {
        type: 'object',
        properties: {
          username: { type: 'string', minLength: 3, maxLength: 20, pattern: '^[a-zA-Z0-9_]+$' },
          display_name: { type: 'string', maxLength: 255 },
          email: { type: 'string', format: 'email' },
          avatar_url: { type: 'string', format: 'uri' },
          cover_url: { type: 'string', format: 'uri' },
          bio: { type: 'string', maxLength: 500 },
        },
      },
      response: {
        200: {
          description: 'Profile updated successfully',
          type: 'object',
          properties: {
            id: { type: 'string' },
            username: { type: ['string', 'null'] },
            display_name: { type: ['string', 'null'] },
            email: { type: ['string', 'null'] },
            avatar_url: { type: ['string', 'null'] },
            cover_url: { type: ['string', 'null'] },
            bio: { type: ['string', 'null'] },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
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
        409: {
          description: 'Username already taken',
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
        username?: string;
        display_name?: string;
        email?: string;
        avatar_url?: string;
        cover_url?: string;
        bio?: string;
      };
    }>,
    reply: FastifyReply
  ): Promise<{ id: string; username: string | null; display_name: string | null; email: string | null; avatar_url: string | null; cover_url: string | null; bio: string | null; created_at: Date; updated_at: Date } | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    const { username, display_name, email, avatar_url, cover_url, bio } = request.body;

    app.logger.info({ userId, username }, 'Updating user profile');

    try {
      // Check if username is taken (if provided)
      if (username) {
        const existing = await app.db.select().from(schema.profiles)
          .where(eq(schema.profiles.username, username))
          .limit(1);

        if (existing.length > 0 && existing[0].id !== userId) {
          app.logger.warn({ username }, 'Username already taken');
          return reply.status(409).send({ error: 'Username already taken' });
        }
      }

      // Update profile
      const [updated] = await app.db
        .update(schema.profiles)
        .set({
          username: username || null,
          displayName: display_name || null,
          email: email || null,
          avatarUrl: avatar_url || null,
          coverUrl: cover_url || null,
          bio: bio || null,
          updatedAt: new Date(),
        })
        .where(eq(schema.profiles.id, userId))
        .returning();

      if (!updated) {
        app.logger.warn({ userId }, 'Profile not found for update');
        return reply.status(404).send({ error: 'Profile not found' });
      }

      app.logger.info({ userId }, 'Profile updated successfully');
      return {
        id: updated.id,
        username: updated.username,
        display_name: updated.displayName,
        email: updated.email,
        avatar_url: updated.avatarUrl,
        cover_url: updated.coverUrl,
        bio: updated.bio,
        created_at: updated.createdAt,
        updated_at: updated.updatedAt,
      };
    } catch (error) {
      app.logger.error({ err: error, userId }, 'Failed to update profile');
      throw error;
    }
  });

  // POST /api/profile/ensure - Ensure profile and stats rows exist for user
  app.fastify.post('/api/profile/ensure', {
    schema: {
      description: 'Ensure profile and stats rows exist for authenticated user (call after signup)',
      tags: ['profile'],
      response: {
        200: {
          description: 'Profile ensured',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
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
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<{ success: boolean } | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;

    app.logger.info({ userId }, 'Ensuring profile and stats rows exist');

    try {
      // Ensure profile row exists
      await app.db
        .insert(schema.profiles)
        .values({
          id: userId,
          username: null,
          displayName: null,
          email: null,
          avatarUrl: null,
          coverUrl: null,
          bio: null,
        })
        .onConflictDoNothing();

      // Ensure profile stats row exists
      await app.db
        .insert(schema.profileStats)
        .values({
          userId,
          postCount: 0,
          followerCount: 0,
          followingCount: 0,
        })
        .onConflictDoNothing();

      app.logger.info({ userId }, 'Profile and stats rows ensured');
      return { success: true };
    } catch (error) {
      app.logger.error({ err: error, userId }, 'Failed to ensure profile rows');
      throw error;
    }
  });
}
