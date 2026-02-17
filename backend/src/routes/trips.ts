import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, desc, count } from 'drizzle-orm';
import * as schema from '../db/schema.js';

export function registerTripRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // GET /api/trips - Get trips for authenticated user
  app.fastify.get('/api/trips', {
    schema: {
      description: 'Get trips for authenticated user',
      tags: ['trips'],
      response: {
        200: {
          description: 'Trips retrieved successfully',
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
    app.logger.info({ userId }, 'Fetching trips');

    try {
      const userTrips = await app.db.select({
        id: schema.trips.id,
        title: schema.trips.title,
        created_at: schema.trips.createdAt,
      }).from(schema.trips)
        .where(eq(schema.trips.userId, userId))
        .orderBy(desc(schema.trips.createdAt));

      app.logger.info({ userId, count: userTrips.length }, 'Trips retrieved successfully');
      return userTrips;
    } catch (error) {
      app.logger.error({ err: error, userId }, 'Failed to fetch trips');
      throw error;
    }
  });

  // GET /api/trips/:trip_id/items - Get items in a trip
  app.fastify.get('/api/trips/:trip_id/items', {
    schema: {
      description: 'Get items in a trip',
      tags: ['trips'],
      params: {
        type: 'object',
        required: ['trip_id'],
        properties: {
          trip_id: { type: 'string', format: 'uuid', description: 'Trip ID' },
        },
      },
      response: {
        200: {
          description: 'Trip items retrieved successfully',
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              trip_id: { type: 'string', format: 'uuid' },
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
          description: 'Trip not found',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Params: { trip_id: string } }>,
    reply: FastifyReply
  ): Promise<Array<{ id: string; trip_id: string; post_id: string; created_at: Date }> | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    const { trip_id: tripId } = request.params;

    app.logger.info({ userId, tripId }, 'Fetching trip items');

    try {
      // Verify user owns the trip
      const trip = await app.db.select().from(schema.trips)
        .where(eq(schema.trips.id, tripId))
        .limit(1);

      if (trip.length === 0 || trip[0].userId !== userId) {
        app.logger.warn({ userId, tripId }, 'Trip not found or access denied');
        return reply.status(404).send({ error: 'Trip not found' });
      }

      const items = await app.db.select({
        id: schema.tripItems.id,
        trip_id: schema.tripItems.tripId,
        post_id: schema.tripItems.postId,
        created_at: schema.tripItems.createdAt,
      }).from(schema.tripItems)
        .where(eq(schema.tripItems.tripId, tripId))
        .orderBy(desc(schema.tripItems.createdAt));

      app.logger.info({ userId, tripId, count: items.length }, 'Trip items retrieved successfully');
      return items;
    } catch (error) {
      app.logger.error({ err: error, userId, tripId }, 'Failed to fetch trip items');
      throw error;
    }
  });

  // POST /api/trips/:trip_id/save - Save video to trip
  app.fastify.post('/api/trips/:trip_id/save', {
    schema: {
      description: 'Save video to trip',
      tags: ['trips'],
      params: {
        type: 'object',
        required: ['trip_id'],
        properties: {
          trip_id: { type: 'string', format: 'uuid', description: 'Trip ID' },
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
          description: 'Video saved to trip successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            trip_items_count: { type: 'number' },
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
          description: 'Trip not found',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest<{
      Params: { trip_id: string };
      Body: { post_id: string };
    }>,
    reply: FastifyReply
  ): Promise<{ success: boolean; trip_items_count: number } | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    const { trip_id: tripId } = request.params;
    const { post_id: postId } = request.body;

    app.logger.info({ userId, tripId, postId }, 'Saving video to trip');

    try {
      // Verify user owns the trip
      const trip = await app.db.select().from(schema.trips)
        .where(eq(schema.trips.id, tripId))
        .limit(1);

      if (trip.length === 0 || trip[0].userId !== userId) {
        app.logger.warn({ userId, tripId }, 'Trip not found or access denied');
        return reply.status(404).send({ error: 'Trip not found' });
      }

      // Insert trip item (with unique constraint)
      await app.db.insert(schema.tripItems).values({
        tripId,
        postId,
      }).onConflictDoNothing();

      // Get updated count
      const [itemsResult] = await app.db.select({ count: count() })
        .from(schema.tripItems)
        .where(eq(schema.tripItems.tripId, tripId));

      const trip_items_count = itemsResult?.count || 0;

      app.logger.info({ userId, tripId, postId, trip_items_count }, 'Video saved to trip successfully');
      return { success: true, trip_items_count };
    } catch (error) {
      app.logger.error({ err: error, userId, tripId, postId }, 'Failed to save video to trip');
      throw error;
    }
  });

  // DELETE /api/trips/:trip_id/items/:post_id - Remove video from trip
  app.fastify.delete('/api/trips/:trip_id/items/:post_id', {
    schema: {
      description: 'Remove video from trip',
      tags: ['trips'],
      params: {
        type: 'object',
        required: ['trip_id', 'post_id'],
        properties: {
          trip_id: { type: 'string', format: 'uuid', description: 'Trip ID' },
          post_id: { type: 'string', description: 'Post ID' },
        },
      },
      response: {
        200: {
          description: 'Video removed from trip successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            trip_items_count: { type: 'number' },
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
          description: 'Trip not found',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Params: { trip_id: string; post_id: string } }>,
    reply: FastifyReply
  ): Promise<{ success: boolean; trip_items_count: number } | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    const { trip_id: tripId, post_id: postId } = request.params;

    app.logger.info({ userId, tripId, postId }, 'Removing video from trip');

    try {
      // Verify user owns the trip
      const trip = await app.db.select().from(schema.trips)
        .where(eq(schema.trips.id, tripId))
        .limit(1);

      if (trip.length === 0 || trip[0].userId !== userId) {
        app.logger.warn({ userId, tripId }, 'Trip not found or access denied');
        return reply.status(404).send({ error: 'Trip not found' });
      }

      // Delete trip item
      await app.db.delete(schema.tripItems).where(
        and(
          eq(schema.tripItems.tripId, tripId),
          eq(schema.tripItems.postId, postId)
        )
      );

      // Get updated count
      const [itemsResult] = await app.db.select({ count: count() })
        .from(schema.tripItems)
        .where(eq(schema.tripItems.tripId, tripId));

      const trip_items_count = itemsResult?.count || 0;

      app.logger.info({ userId, tripId, postId, trip_items_count }, 'Video removed from trip successfully');
      return { success: true, trip_items_count };
    } catch (error) {
      app.logger.error({ err: error, userId, tripId, postId }, 'Failed to remove video from trip');
      throw error;
    }
  });
}
