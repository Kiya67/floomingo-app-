import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, desc, count } from 'drizzle-orm';
import * as schema from '../db/schema.js';

export function registerBoardRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // POST /api/boards - Create a new board
  app.fastify.post('/api/boards', {
    schema: {
      description: 'Create a new board for authenticated user',
      tags: ['boards'],
      body: {
        type: 'object',
        required: ['title'],
        properties: {
          title: { type: 'string', description: 'Board title' },
        },
      },
      response: {
        201: {
          description: 'Board created successfully',
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            user_id: { type: 'string' },
            title: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        400: {
          description: 'Invalid request',
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
    request: FastifyRequest<{ Body: { title: string } }>,
    reply: FastifyReply
  ): Promise<{ id: string; user_id: string; title: string; created_at: Date } | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    const { title } = request.body;

    app.logger.info({ userId, title }, 'Creating board');

    try {
      const [newBoard] = await app.db.insert(schema.boards).values({
        userId,
        title,
      }).returning();

      app.logger.info({ userId, boardId: newBoard.id }, 'Board created successfully');
      return reply.status(201).send({
        id: newBoard.id,
        user_id: newBoard.userId,
        title: newBoard.title,
        created_at: newBoard.createdAt,
      });
    } catch (error) {
      app.logger.error({ err: error, userId }, 'Failed to create board');
      throw error;
    }
  });

  // GET /api/boards - Get boards for authenticated user
  app.fastify.get('/api/boards', {
    schema: {
      description: 'Get boards for authenticated user',
      tags: ['boards'],
      response: {
        200: {
          description: 'Boards retrieved successfully',
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              title: { type: 'string' },
              created_at: { type: 'string', format: 'date-time' },
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
  ): Promise<Array<{ id: string; title: string; created_at: Date }> | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    app.logger.info({ userId }, 'Fetching boards');

    try {
      const userBoards = await app.db.select({
        id: schema.boards.id,
        title: schema.boards.title,
        created_at: schema.boards.createdAt,
      }).from(schema.boards)
        .where(eq(schema.boards.userId, userId))
        .orderBy(desc(schema.boards.createdAt));

      app.logger.info({ userId, count: userBoards.length }, 'Boards retrieved successfully');
      return userBoards;
    } catch (error) {
      app.logger.error({ err: error, userId }, 'Failed to fetch boards');
      throw error;
    }
  });

  // GET /api/boards/:board_id/videos - Get videos saved to a board
  app.fastify.get('/api/boards/:board_id/videos', {
    schema: {
      description: 'Get videos saved to a board by authenticated user',
      tags: ['boards'],
      params: {
        type: 'object',
        required: ['board_id'],
        properties: {
          board_id: { type: 'string', format: 'uuid', description: 'Board ID' },
        },
      },
      response: {
        200: {
          description: 'Videos retrieved successfully',
          type: 'array',
          items: {
            type: 'object',
            properties: {
              board_id: { type: 'string', format: 'uuid' },
              post_id: { type: 'string' },
              post_caption: { type: 'string' },
              post_video_url: { type: 'string' },
              post_thumbnail_url: { type: ['string', 'null'] },
              post_created_at: { type: 'string', format: 'date-time' },
              saved_at: { type: 'string', format: 'date-time' },
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
        404: {
          description: 'Board not found',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Params: { board_id: string } }>,
    reply: FastifyReply
  ): Promise<Array<{
    board_id: string;
    post_id: string;
    post_caption: string;
    post_video_url: string;
    post_thumbnail_url: string | null;
    post_created_at: Date;
    saved_at: Date;
  }> | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    const { board_id: boardId } = request.params;

    app.logger.info({ userId, boardId }, 'Fetching videos for board');

    try {
      // Verify user owns the board
      const board = await app.db.select().from(schema.boards)
        .where(eq(schema.boards.id, boardId))
        .limit(1);

      if (board.length === 0 || board[0].userId !== userId) {
        app.logger.warn({ userId, boardId }, 'Board not found or access denied');
        return reply.status(404).send({ error: 'Board not found' });
      }

      const videos = await app.db.select({
        board_id: schema.boardPosts.boardId,
        post_id: schema.boardPosts.postId,
        post_caption: schema.posts.caption,
        post_video_url: schema.posts.videoUrl,
        post_thumbnail_url: schema.posts.thumbnailUrl,
        post_created_at: schema.posts.createdAt,
        saved_at: schema.boardPosts.createdAt,
      }).from(schema.boardPosts)
        .innerJoin(schema.posts, eq(schema.boardPosts.postId, schema.posts.id))
        .where(and(
          eq(schema.boardPosts.boardId, boardId),
          eq(schema.boardPosts.savedBy, userId)
        ))
        .orderBy(desc(schema.boardPosts.createdAt));

      app.logger.info({ userId, boardId, count: videos.length }, 'Videos retrieved successfully');
      return videos;
    } catch (error) {
      app.logger.error({ err: error, userId, boardId }, 'Failed to fetch videos');
      throw error;
    }
  });

  // POST /api/boards/:board_id/save-video - Save video to board
  app.fastify.post('/api/boards/:board_id/save-video', {
    schema: {
      description: 'Save video to board for authenticated user',
      tags: ['boards'],
      params: {
        type: 'object',
        required: ['board_id'],
        properties: {
          board_id: { type: 'string', format: 'uuid', description: 'Board ID' },
        },
      },
      body: {
        type: 'object',
        required: ['post_id'],
        properties: {
          post_id: { type: 'string', description: 'Post ID' },
        },
      },
      response: {
        200: {
          description: 'Video saved successfully',
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
        404: {
          description: 'Board or post not found',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        409: {
          description: 'Video already saved to this board by this user',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest<{
      Params: { board_id: string };
      Body: { post_id: string };
    }>,
    reply: FastifyReply
  ): Promise<{ success: boolean } | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    const { board_id: boardId } = request.params;
    const { post_id: postId } = request.body;

    app.logger.info({ userId, boardId, postId }, 'Saving video to board');

    try {
      // Verify user owns the board
      const board = await app.db.select().from(schema.boards)
        .where(eq(schema.boards.id, boardId))
        .limit(1);

      if (board.length === 0 || board[0].userId !== userId) {
        app.logger.warn({ userId, boardId }, 'Board not found or access denied');
        return reply.status(404).send({ error: 'Board not found' });
      }

      // Verify post exists
      const post = await app.db.select().from(schema.posts)
        .where(eq(schema.posts.id, postId))
        .limit(1);

      if (post.length === 0) {
        app.logger.warn({ postId }, 'Post not found');
        return reply.status(404).send({ error: 'Post not found' });
      }

      // Try to insert board post
      try {
        await app.db.insert(schema.boardPosts).values({
          boardId,
          postId,
          savedBy: userId,
        });

        app.logger.info({ userId, boardId, postId }, 'Video saved successfully');
        return { success: true };
      } catch (dbError: any) {
        // Check if it's a unique constraint violation
        if (dbError.code === '23505' || dbError.message?.includes('unique')) {
          app.logger.warn({ userId, boardId, postId }, 'Video already saved by user');
          return reply.status(409).send({ error: 'Video already saved to this board' });
        }
        throw dbError;
      }
    } catch (error) {
      app.logger.error({ err: error, userId, boardId, postId }, 'Failed to save video');
      throw error;
    }
  });
}
