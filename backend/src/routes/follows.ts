import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, or, desc, count } from 'drizzle-orm';
import * as schema from '../db/schema.js';

export function registerFollowRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // POST /api/follow/:userId - Follow a user
  app.fastify.post('/api/follow/:userId', {
    schema: {
      description: 'Follow a user',
      tags: ['follow'],
      params: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: { type: 'string', description: 'User ID to follow' },
        },
      },
      response: {
        200: {
          description: 'Successfully followed user',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            follower_count: { type: 'number' },
          },
        },
        400: {
          description: 'Bad request (already following or self-follow)',
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
    request: FastifyRequest<{ Params: { userId: string } }>,
    reply: FastifyReply
  ): Promise<{ success: boolean; follower_count: number } | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const followerId = session.user.id;
    const { userId: followingId } = request.params;

    app.logger.info({ followerId, followingId }, 'Following user');

    try {
      // Prevent self-follow
      if (followerId === followingId) {
        app.logger.warn({ followerId }, 'User attempted to follow themselves');
        return reply.status(400).send({ error: 'Cannot follow yourself' });
      }

      // Try to insert follow relationship
      try {
        await app.db.insert(schema.follows).values({
          followerId,
          followingId,
        });
      } catch (dbError: any) {
        if (dbError.code === '23505' || dbError.message?.includes('unique')) {
          app.logger.warn({ followerId, followingId }, 'Already following');
          return reply.status(400).send({ error: 'Already following this user' });
        }
        throw dbError;
      }

      // Get follower count for the followed user
      const [followerCountResult] = await app.db.select({ count: count() })
        .from(schema.follows)
        .where(eq(schema.follows.followingId, followingId));

      const follower_count = followerCountResult?.count || 0;

      app.logger.info({ followerId, followingId, follower_count }, 'User followed successfully');
      return { success: true, follower_count };
    } catch (error) {
      app.logger.error({ err: error, followerId, followingId }, 'Failed to follow user');
      throw error;
    }
  });

  // DELETE /api/follow/:userId - Unfollow a user
  app.fastify.delete('/api/follow/:userId', {
    schema: {
      description: 'Unfollow a user',
      tags: ['follow'],
      params: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: { type: 'string', description: 'User ID to unfollow' },
        },
      },
      response: {
        200: {
          description: 'Successfully unfollowed user',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            follower_count: { type: 'number' },
          },
        },
        400: {
          description: 'Bad request (not following)',
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
    request: FastifyRequest<{ Params: { userId: string } }>,
    reply: FastifyReply
  ): Promise<{ success: boolean; follower_count: number } | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const followerId = session.user.id;
    const { userId: followingId } = request.params;

    app.logger.info({ followerId, followingId }, 'Unfollowing user');

    try {
      // Delete follow relationship
      const result = await app.db.delete(schema.follows).where(
        and(
          eq(schema.follows.followerId, followerId),
          eq(schema.follows.followingId, followingId)
        )
      ).returning();

      if (result.length === 0) {
        app.logger.warn({ followerId, followingId }, 'Not following this user');
        return reply.status(400).send({ error: 'Not following this user' });
      }

      // Get follower count for the unfollowed user
      const [followerCountResult] = await app.db.select({ count: count() })
        .from(schema.follows)
        .where(eq(schema.follows.followingId, followingId));

      const follower_count = followerCountResult?.count || 0;

      app.logger.info({ followerId, followingId, follower_count }, 'User unfollowed successfully');
      return { success: true, follower_count };
    } catch (error) {
      app.logger.error({ err: error, followerId, followingId }, 'Failed to unfollow user');
      throw error;
    }
  });

  // GET /api/follow/status/:userId - Check follow status
  app.fastify.get('/api/follow/status/:userId', {
    schema: {
      description: 'Check if authenticated user is following a user',
      tags: ['follow'],
      params: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: { type: 'string', description: 'User ID to check' },
        },
      },
      response: {
        200: {
          description: 'Follow status retrieved',
          type: 'object',
          properties: {
            isFollowing: { type: 'boolean' },
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
    request: FastifyRequest<{ Params: { userId: string } }>,
    reply: FastifyReply
  ): Promise<{ isFollowing: boolean } | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const followerId = session.user.id;
    const { userId: followingId } = request.params;

    app.logger.info({ followerId, followingId }, 'Checking follow status');

    try {
      const follows = await app.db.select().from(schema.follows).where(
        and(
          eq(schema.follows.followerId, followerId),
          eq(schema.follows.followingId, followingId)
        )
      ).limit(1);

      const isFollowing = follows.length > 0;
      app.logger.info({ followerId, followingId, isFollowing }, 'Follow status retrieved');
      return { isFollowing };
    } catch (error) {
      app.logger.error({ err: error, followerId, followingId }, 'Failed to check follow status');
      throw error;
    }
  });

  // GET /api/followers/:userId - Get followers list
  app.fastify.get('/api/followers/:userId', {
    schema: {
      description: 'Get list of followers for a user',
      tags: ['follow'],
      params: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: { type: 'string', description: 'User ID' },
        },
      },
      response: {
        200: {
          description: 'Followers list retrieved',
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              username: { type: 'string' },
              display_name: { type: ['string', 'null'] },
              avatar_url: { type: ['string', 'null'] },
              created_at: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Params: { userId: string } }>,
    reply: FastifyReply
  ): Promise<Array<{ id: string; username: string; display_name: string | null; avatar_url: string | null; created_at: Date }>> => {
    const { userId } = request.params;

    app.logger.info({ userId }, 'Fetching followers');

    try {
      // This would require a profiles table join - for now return empty
      // In a real implementation, this would join with profiles table
      app.logger.info({ userId }, 'Followers retrieved');
      return [];
    } catch (error) {
      app.logger.error({ err: error, userId }, 'Failed to fetch followers');
      throw error;
    }
  });

  // GET /api/following/:userId - Get following list
  app.fastify.get('/api/following/:userId', {
    schema: {
      description: 'Get list of users being followed by a user',
      tags: ['follow'],
      params: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: { type: 'string', description: 'User ID' },
        },
      },
      response: {
        200: {
          description: 'Following list retrieved',
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              username: { type: 'string' },
              display_name: { type: ['string', 'null'] },
              avatar_url: { type: ['string', 'null'] },
              created_at: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Params: { userId: string } }>,
    reply: FastifyReply
  ): Promise<Array<{ id: string; username: string; display_name: string | null; avatar_url: string | null; created_at: Date }>> => {
    const { userId } = request.params;

    app.logger.info({ userId }, 'Fetching following');

    try {
      // This would require a profiles table join - for now return empty
      // In a real implementation, this would join with profiles table
      app.logger.info({ userId }, 'Following retrieved');
      return [];
    } catch (error) {
      app.logger.error({ err: error, userId }, 'Failed to fetch following');
      throw error;
    }
  });

  // POST /api/account/delete - Delete account
  app.fastify.post('/api/account/delete', {
    schema: {
      description: 'Delete authenticated user account and all associated data',
      tags: ['account'],
      response: {
        200: {
          description: 'Account deleted successfully',
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

    app.logger.warn({ userId }, 'Deleting user account and all data');

    try {
      // Use transaction to ensure atomicity
      await app.db.transaction(async (tx) => {
        // Delete all follows where user is follower or being followed
        await tx.delete(schema.follows).where(
          or(
            eq(schema.follows.followerId, userId),
            eq(schema.follows.followingId, userId)
          )
        );

        // Delete board posts saved by user
        await tx.delete(schema.boardPosts).where(eq(schema.boardPosts.savedBy, userId));

        // Delete boards owned by user
        await tx.delete(schema.boards).where(eq(schema.boards.userId, userId));

        // Delete posts by user
        const userPosts = await tx.select({ id: schema.posts.id })
          .from(schema.posts)
          .where(eq(schema.posts.userId, userId));

        for (const post of userPosts) {
          // Delete post stats
          await tx.delete(schema.postStats).where(eq(schema.postStats.postId, post.id));
        }

        await tx.delete(schema.posts).where(eq(schema.posts.userId, userId));

        // Delete profile stats
        await tx.delete(schema.profileStats).where(eq(schema.profileStats.userId, userId));

        // Delete trips and trip items
        const userTrips = await tx.select({ id: schema.trips.id })
          .from(schema.trips)
          .where(eq(schema.trips.userId, userId));

        for (const trip of userTrips) {
          await tx.delete(schema.tripItems).where(eq(schema.tripItems.tripId, trip.id));
        }

        await tx.delete(schema.trips).where(eq(schema.trips.userId, userId));

        // Delete user blocks
        await tx.delete(schema.blocks).where(
          or(
            eq(schema.blocks.blockerId, userId),
            eq(schema.blocks.blockedId, userId)
          )
        );
      });

      // Note: Actual user deletion from auth tables is handled by the auth provider
      // This just deletes all associated application data

      app.logger.warn({ userId }, 'User account and all data deleted successfully');
      return { success: true };
    } catch (error) {
      app.logger.error({ err: error, userId }, 'Failed to delete account');
      throw error;
    }
  });
}
