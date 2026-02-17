import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema.js';

export function registerBlockRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // POST /api/blocks - Block a user
  app.fastify.post('/api/blocks', {
    schema: {
      description: 'Block a user',
      tags: ['blocks'],
      body: {
        type: 'object',
        required: ['blocked_id'],
        properties: {
          blocked_id: { type: 'string', description: 'ID of user to block' },
        },
      },
      response: {
        200: {
          description: 'User blocked successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
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
      },
    },
  }, async (
    request: FastifyRequest<{ Body: { blocked_id: string } }>,
    reply: FastifyReply
  ): Promise<{ success: boolean } | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const blockerId = session.user.id;
    const { blocked_id: blockedId } = request.body;

    app.logger.info({ blockerId, blockedId }, 'Blocking user');

    // Prevent self-blocking
    if (blockerId === blockedId) {
      app.logger.warn({ blockerId }, 'User attempted to block themselves');
      return reply.status(400).send({ error: 'Cannot block yourself' });
    }

    try {
      // Insert block record
      await app.db.insert(schema.blocks).values({
        blockerId,
        blockedId,
      }).onConflictDoNothing();

      app.logger.info({ blockerId, blockedId }, 'User blocked successfully');
      return { success: true };
    } catch (error) {
      app.logger.error({ err: error, blockerId, blockedId }, 'Failed to block user');
      throw error;
    }
  });

  // DELETE /api/blocks/:blocked_id - Unblock a user
  app.fastify.delete('/api/blocks/:blocked_id', {
    schema: {
      description: 'Unblock a user',
      tags: ['blocks'],
      params: {
        type: 'object',
        required: ['blocked_id'],
        properties: {
          blocked_id: { type: 'string', description: 'ID of user to unblock' },
        },
      },
      response: {
        200: {
          description: 'User unblocked successfully',
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
    request: FastifyRequest<{ Params: { blocked_id: string } }>,
    reply: FastifyReply
  ): Promise<{ success: boolean } | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const blockerId = session.user.id;
    const { blocked_id: blockedId } = request.params;

    app.logger.info({ blockerId, blockedId }, 'Unblocking user');

    try {
      await app.db.delete(schema.blocks).where(
        and(
          eq(schema.blocks.blockerId, blockerId),
          eq(schema.blocks.blockedId, blockedId)
        )
      );

      app.logger.info({ blockerId, blockedId }, 'User unblocked successfully');
      return { success: true };
    } catch (error) {
      app.logger.error({ err: error, blockerId, blockedId }, 'Failed to unblock user');
      throw error;
    }
  });

  // GET /api/blocks/check/:user_id - Check if a user is blocked
  app.fastify.get('/api/blocks/check/:user_id', {
    schema: {
      description: 'Check block status with another user',
      tags: ['blocks'],
      params: {
        type: 'object',
        required: ['user_id'],
        properties: {
          user_id: { type: 'string', description: 'ID of user to check block status with' },
        },
      },
      response: {
        200: {
          description: 'Block status retrieved',
          type: 'object',
          properties: {
            isBlocked: { type: 'boolean' },
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
    request: FastifyRequest<{ Params: { user_id: string } }>,
    reply: FastifyReply
  ): Promise<{ isBlocked: boolean } | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const blockerId = session.user.id;
    const { user_id: userId } = request.params;

    app.logger.info({ blockerId, userId }, 'Checking block status');

    try {
      const block = await app.db.select().from(schema.blocks).where(
        and(
          eq(schema.blocks.blockerId, blockerId),
          eq(schema.blocks.blockedId, userId)
        )
      ).limit(1);

      const isBlocked = block.length > 0;
      app.logger.info({ blockerId, userId, isBlocked }, 'Block status checked');
      return { isBlocked };
    } catch (error) {
      app.logger.error({ err: error, blockerId, userId }, 'Failed to check block status');
      throw error;
    }
  });

  // GET /api/blocks - Get blocked users list
  app.fastify.get('/api/blocks', {
    schema: {
      description: 'Get list of blocked users',
      tags: ['blocks'],
      response: {
        200: {
          description: 'Blocked users list retrieved',
          type: 'array',
          items: {
            type: 'object',
            properties: {
              blockerId: { type: 'string' },
              blockedId: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' },
            },
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
  ): Promise<Array<{ blockerId: string; blockedId: string; createdAt: Date }> | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const blockerId = session.user.id;

    app.logger.info({ blockerId }, 'Fetching blocked users list');

    try {
      const blockedUsers = await app.db.select().from(schema.blocks).where(
        eq(schema.blocks.blockerId, blockerId)
      );

      app.logger.info({ blockerId, count: blockedUsers.length }, 'Blocked users list retrieved');
      return blockedUsers;
    } catch (error) {
      app.logger.error({ err: error, blockerId }, 'Failed to fetch blocked users');
      throw error;
    }
  });
}
