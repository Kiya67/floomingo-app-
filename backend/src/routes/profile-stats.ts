import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import { sql } from 'drizzle-orm';

export function registerProfileStatsRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // GET /api/profile/stats/:user_id - Get profile stats for a user
  app.fastify.get('/api/profile/stats/:user_id', {
    schema: {
      description: 'Get profile stats for a user',
      tags: ['profile-stats'],
      params: {
        type: 'object',
        required: ['user_id'],
        properties: {
          user_id: { type: 'string', description: 'User ID' },
        },
      },
      response: {
        200: {
          description: 'Profile stats retrieved successfully',
          type: 'object',
          properties: {
            user_id: { type: 'string' },
            post_count: { type: 'number' },
            follower_count: { type: 'number' },
            following_count: { type: 'number' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        404: {
          description: 'User not found',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Params: { user_id: string } }>,
    reply: FastifyReply
  ): Promise<{ user_id: string; post_count: number; follower_count: number; following_count: number; updated_at: Date } | void> => {
    const { user_id: userId } = request.params;

    app.logger.info({ userId }, 'Fetching profile stats');

    try {
      const stats = await app.db.select({
        user_id: schema.profileStats.userId,
        post_count: schema.profileStats.postCount,
        follower_count: schema.profileStats.followerCount,
        following_count: schema.profileStats.followingCount,
        updated_at: schema.profileStats.updatedAt,
      }).from(schema.profileStats)
        .where(eq(schema.profileStats.userId, userId))
        .limit(1);

      if (stats.length === 0) {
        app.logger.info({ userId }, 'Profile stats not found, creating default stats');
        // Auto-create default stats if they don't exist
        await app.db.insert(schema.profileStats).values({
          userId,
          postCount: 0,
          followerCount: 0,
          followingCount: 0,
        }).onConflictDoNothing();

        // Fetch the newly created or existing stats
        const [newStats] = await app.db.select({
          user_id: schema.profileStats.userId,
          post_count: schema.profileStats.postCount,
          follower_count: schema.profileStats.followerCount,
          following_count: schema.profileStats.followingCount,
          updated_at: schema.profileStats.updatedAt,
        }).from(schema.profileStats)
          .where(eq(schema.profileStats.userId, userId))
          .limit(1);

        app.logger.info({ userId }, 'Default profile stats created');
        return newStats;
      }

      app.logger.info({ userId }, 'Profile stats retrieved successfully');
      return stats[0];
    } catch (error) {
      app.logger.error({ err: error, userId }, 'Failed to fetch profile stats');
      throw error;
    }
  });

  // POST /api/profile/stats/recalculate/:user_id - Recalculate stats for a user (admin/internal only)
  app.fastify.post('/api/profile/stats/recalculate/:user_id', {
    schema: {
      description: 'Recalculate profile stats for a user (internal endpoint)',
      tags: ['profile-stats'],
      params: {
        type: 'object',
        required: ['user_id'],
        properties: {
          user_id: { type: 'string', description: 'User ID' },
        },
      },
      response: {
        200: {
          description: 'Profile stats recalculated successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            post_count: { type: 'number' },
            follower_count: { type: 'number' },
            following_count: { type: 'number' },
          },
        },
        500: {
          description: 'Internal server error',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Params: { user_id: string } }>,
    reply: FastifyReply
  ): Promise<{ success: boolean; post_count: number; follower_count: number; following_count: number } | void> => {
    const { user_id: userId } = request.params;

    app.logger.info({ userId }, 'Recalculating profile stats');

    try {
      // Call the recalculate_profile_stats function
      await app.db.execute(
        sql`SELECT recalculate_profile_stats(${userId})`
      );

      // Fetch the updated stats
      const stats = await app.db.select({
        post_count: schema.profileStats.postCount,
        follower_count: schema.profileStats.followerCount,
        following_count: schema.profileStats.followingCount,
      }).from(schema.profileStats)
        .where(eq(schema.profileStats.userId, userId))
        .limit(1);

      if (stats.length === 0) {
        app.logger.warn({ userId }, 'Failed to recalculate stats');
        return reply.status(500).send({ error: 'Failed to recalculate stats' });
      }

      app.logger.info({ userId, stats: stats[0] }, 'Profile stats recalculated successfully');
      return { success: true, ...stats[0] };
    } catch (error) {
      app.logger.error({ err: error, userId }, 'Failed to recalculate profile stats');
      throw error;
    }
  });
}
