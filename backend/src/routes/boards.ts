import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, desc, count } from 'drizzle-orm';
import * as schema from '../db/schema.js';

export function registerBoardRoutes(app: App) {
  const requireAuth = app.requireAuth();

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
              cover_url: { type: ['string', 'null'] },
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
  ): Promise<Array<{ id: string; title: string; cover_url: string | null; created_at: Date }> | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    app.logger.info({ userId }, 'Fetching boards');

    try {
      const userBoards = await app.db.select({
        id: schema.boards.id,
        title: schema.boards.title,
        cover_url: schema.boards.coverUrl,
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

  // GET /api/boards/:board_id/places - Get places for a board
  app.fastify.get('/api/boards/:board_id/places', {
    schema: {
      description: 'Get places for a board',
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
          description: 'Places retrieved successfully',
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              board_id: { type: 'string', format: 'uuid' },
              place_id: { type: 'string' },
              place_name: { type: 'string' },
              place_primary_type: { type: 'string' },
              place_address: { type: 'string' },
              post_id: { type: 'string' },
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
    id: string;
    board_id: string;
    place_id: string;
    place_name: string;
    place_primary_type: string;
    place_address: string;
    post_id: string;
    created_at: Date;
  }> | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    const { board_id: boardId } = request.params;

    app.logger.info({ userId, boardId }, 'Fetching places for board');

    try {
      // Verify user owns the board
      const board = await app.db.select().from(schema.boards)
        .where(eq(schema.boards.id, boardId))
        .limit(1);

      if (board.length === 0 || board[0].userId !== userId) {
        app.logger.warn({ userId, boardId }, 'Board not found or access denied');
        return reply.status(404).send({ error: 'Board not found' });
      }

      const places = await app.db.select({
        id: schema.boardPlaces.id,
        board_id: schema.boardPlaces.boardId,
        place_id: schema.boardPlaces.placeId,
        place_name: schema.boardPlaces.placeName,
        place_primary_type: schema.boardPlaces.placePrimaryType,
        place_address: schema.boardPlaces.placeAddress,
        post_id: schema.boardPlaces.postId,
        created_at: schema.boardPlaces.createdAt,
      }).from(schema.boardPlaces)
        .where(eq(schema.boardPlaces.boardId, boardId))
        .orderBy(desc(schema.boardPlaces.createdAt));

      app.logger.info({ userId, boardId, count: places.length }, 'Places retrieved successfully');
      return places;
    } catch (error) {
      app.logger.error({ err: error, userId, boardId }, 'Failed to fetch places');
      throw error;
    }
  });

  // POST /api/boards/:board_id/save-video-with-location - Save video + location to board
  app.fastify.post('/api/boards/:board_id/save-video-with-location', {
    schema: {
      description: 'Save video with location to board',
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
        required: ['post_id', 'place_id', 'place_name', 'place_address', 'place_primary_type'],
        properties: {
          post_id: { type: 'string', description: 'Post ID' },
          place_id: { type: 'string', description: 'Place ID' },
          place_name: { type: 'string', description: 'Place name' },
          place_address: { type: 'string', description: 'Place address' },
          place_primary_type: { type: 'string', description: 'Place primary type' },
        },
      },
      response: {
        200: {
          description: 'Video with location saved successfully',
          type: 'object',
          properties: {
            board_posts_count: { type: 'number' },
            board_places_count: { type: 'number' },
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
        409: {
          description: 'Video already saved to this board',
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
      Body: {
        post_id: string;
        place_id: string;
        place_name: string;
        place_address: string;
        place_primary_type: string;
      };
    }>,
    reply: FastifyReply
  ): Promise<{ board_posts_count: number; board_places_count: number } | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    const { board_id: boardId } = request.params;
    const { post_id: postId, place_id: placeId, place_name: placeName, place_address: placeAddress, place_primary_type: placePrimaryType } = request.body;

    app.logger.info({ userId, boardId, postId }, 'Saving video with location to board');

    try {
      // Verify user owns the board
      const board = await app.db.select().from(schema.boards)
        .where(eq(schema.boards.id, boardId))
        .limit(1);

      if (board.length === 0 || board[0].userId !== userId) {
        app.logger.warn({ userId, boardId }, 'Board not found or access denied');
        return reply.status(404).send({ error: 'Board not found' });
      }

      // Insert board post (with unique constraint)
      await app.db.insert(schema.boardPosts).values({
        boardId,
        postId,
      }).onConflictDoNothing();

      // Insert board place (with unique constraint)
      await app.db.insert(schema.boardPlaces).values({
        boardId,
        postId,
        placeId,
        placeName,
        placeAddress,
        placePrimaryType,
      }).onConflictDoNothing();

      // Get updated counts
      const [postsResult] = await app.db.select({ count: count() })
        .from(schema.boardPosts)
        .where(eq(schema.boardPosts.boardId, boardId));

      const [placesResult] = await app.db.select({ count: count() })
        .from(schema.boardPlaces)
        .where(eq(schema.boardPlaces.boardId, boardId));

      const board_posts_count = postsResult?.count || 0;
      const board_places_count = placesResult?.count || 0;

      app.logger.info({ userId, boardId, postId, board_posts_count, board_places_count }, 'Video with location saved successfully');
      return { board_posts_count, board_places_count };
    } catch (error) {
      app.logger.error({ err: error, userId, boardId, postId }, 'Failed to save video with location');
      throw error;
    }
  });

  // POST /api/boards/:board_id/save-video - Save video only to board
  app.fastify.post('/api/boards/:board_id/save-video', {
    schema: {
      description: 'Save video only to board',
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
            board_posts_count: { type: 'number' },
            board_places_count: { type: 'number' },
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
        409: {
          description: 'Video already saved to this board',
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
  ): Promise<{ board_posts_count: number; board_places_count: number } | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    const { board_id: boardId } = request.params;
    const { post_id: postId } = request.body;

    app.logger.info({ userId, boardId, postId }, 'Saving video only to board');

    try {
      // Verify user owns the board
      const board = await app.db.select().from(schema.boards)
        .where(eq(schema.boards.id, boardId))
        .limit(1);

      if (board.length === 0 || board[0].userId !== userId) {
        app.logger.warn({ userId, boardId }, 'Board not found or access denied');
        return reply.status(404).send({ error: 'Board not found' });
      }

      // Insert board post (with unique constraint)
      await app.db.insert(schema.boardPosts).values({
        boardId,
        postId,
      }).onConflictDoNothing();

      // Get updated counts
      const [postsResult] = await app.db.select({ count: count() })
        .from(schema.boardPosts)
        .where(eq(schema.boardPosts.boardId, boardId));

      const [placesResult] = await app.db.select({ count: count() })
        .from(schema.boardPlaces)
        .where(eq(schema.boardPlaces.boardId, boardId));

      const board_posts_count = postsResult?.count || 0;
      const board_places_count = placesResult?.count || 0;

      app.logger.info({ userId, boardId, postId, board_posts_count, board_places_count }, 'Video saved successfully');
      return { board_posts_count, board_places_count };
    } catch (error) {
      app.logger.error({ err: error, userId, boardId, postId }, 'Failed to save video');
      throw error;
    }
  });
}
