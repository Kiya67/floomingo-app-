import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, desc, and } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import { sql } from 'drizzle-orm';

export function registerPostRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // POST /api/posts - Create a post
  app.fastify.post('/api/posts', {
    schema: {
      description: 'Create a new post with video, caption, and optional location',
      tags: ['posts'],
      body: {
        type: 'object',
        required: ['caption', 'video_url'],
        properties: {
          caption: { type: 'string', description: 'Post caption' },
          video_url: { type: 'string', format: 'uri', description: 'Video URL (S3 or CDN)' },
          thumbnail_url: { type: 'string', format: 'uri', description: 'Thumbnail URL (optional)' },
          place_id: { type: 'string', description: 'Location place ID (optional)' },
        },
      },
      response: {
        201: {
          description: 'Post created successfully',
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            user_id: { type: 'string' },
            caption: { type: 'string' },
            video_url: { type: 'string' },
            thumbnail_url: { type: ['string', 'null'] },
            place_id: { type: ['string', 'null'] },
            created_at: { type: 'string', format: 'date-time' },
            view_count: { type: 'number' },
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
    request: FastifyRequest<{
      Body: {
        caption: string;
        video_url: string;
        thumbnail_url?: string;
        place_id?: string;
      };
    }>,
    reply: FastifyReply
  ): Promise<{ id: string; user_id: string; caption: string; video_url: string; thumbnail_url: string | null; place_id: string | null; created_at: Date; view_count: number } | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    const { caption, video_url, thumbnail_url, place_id } = request.body;

    app.logger.info({ userId, captionLength: caption.length }, 'Creating post');

    try {
      // Insert post
      const [newPost] = await app.db.insert(schema.posts).values({
        userId,
        caption,
        videoUrl: video_url,
        thumbnailUrl: thumbnail_url || null,
        placeId: place_id || null,
      }).returning();

      // Post stats will be initialized automatically by trigger
      app.logger.info({ userId, postId: newPost.id }, 'Post created successfully');

      return reply.status(201).send({
        id: newPost.id,
        user_id: newPost.userId,
        caption: newPost.caption,
        video_url: newPost.videoUrl,
        thumbnail_url: newPost.thumbnailUrl,
        place_id: newPost.placeId,
        created_at: newPost.createdAt,
        view_count: 0,
      });
    } catch (error) {
      app.logger.error({ err: error, userId }, 'Failed to create post');
      throw error;
    }
  });

  // GET /api/users/:user_id/posts - Get posts for a user's profile
  app.fastify.get('/api/users/:user_id/posts', {
    schema: {
      description: 'Get posts for a user profile. Includes view_count only if viewing own profile.',
      tags: ['posts'],
      params: {
        type: 'object',
        required: ['user_id'],
        properties: {
          user_id: { type: 'string', description: 'User ID' },
        },
      },
      response: {
        200: {
          description: 'Posts retrieved successfully',
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              user_id: { type: 'string' },
              caption: { type: 'string' },
              video_url: { type: 'string' },
              thumbnail_url: { type: ['string', 'null'] },
              place_id: { type: ['string', 'null'] },
              created_at: { type: 'string', format: 'date-time' },
              view_count: { type: ['number', 'null'] },
            },
          },
        },
        400: {
          description: 'Invalid request',
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
  ): Promise<Array<{ id: string; user_id: string; caption: string; video_url: string; thumbnail_url: string | null; place_id: string | null; created_at: Date; view_count: number | null }> | void> => {
    const { user_id: targetUserId } = request.params;

    app.logger.info({ targetUserId }, 'Fetching posts for user profile');

    try {
      // Check if authenticated user is viewing their own profile
      const session = request.headers.authorization ? await requireAuth(request, reply) : null;
      const isOwnProfile = session?.user?.id === targetUserId;

      if (isOwnProfile) {
        // Include view_count for own profile
        const userPosts = await app.db.select({
          id: schema.posts.id,
          user_id: schema.posts.userId,
          caption: schema.posts.caption,
          video_url: schema.posts.videoUrl,
          thumbnail_url: schema.posts.thumbnailUrl,
          place_id: schema.posts.placeId,
          created_at: schema.posts.createdAt,
          view_count: schema.postStats.viewCount,
        }).from(schema.posts)
          .leftJoin(schema.postStats, eq(schema.posts.id, schema.postStats.postId))
          .where(eq(schema.posts.userId, targetUserId))
          .orderBy(desc(schema.posts.createdAt));

        app.logger.info({ targetUserId, count: userPosts.length }, 'Posts retrieved (own profile)');
        return userPosts;
      } else {
        // Exclude view_count for other users' profiles
        const userPosts = await app.db.select({
          id: schema.posts.id,
          user_id: schema.posts.userId,
          caption: schema.posts.caption,
          video_url: schema.posts.videoUrl,
          thumbnail_url: schema.posts.thumbnailUrl,
          place_id: schema.posts.placeId,
          created_at: schema.posts.createdAt,
        }).from(schema.posts)
          .where(eq(schema.posts.userId, targetUserId))
          .orderBy(desc(schema.posts.createdAt));

        // Map to include view_count as null
        const postsWithNullViewCount = userPosts.map(post => ({
          ...post,
          view_count: null,
        }));

        app.logger.info({ targetUserId, count: postsWithNullViewCount.length }, 'Posts retrieved (other profile)');
        return postsWithNullViewCount;
      }
    } catch (error) {
      app.logger.error({ err: error, targetUserId }, 'Failed to fetch user posts');
      throw error;
    }
  });

  // GET /api/posts/:post_id - Get a single post with view_count
  app.fastify.get('/api/posts/:post_id', {
    schema: {
      description: 'Get a single post with view count',
      tags: ['posts'],
      params: {
        type: 'object',
        required: ['post_id'],
        properties: {
          post_id: { type: 'string', format: 'uuid', description: 'Post ID' },
        },
      },
      response: {
        200: {
          description: 'Post retrieved successfully',
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            user_id: { type: 'string' },
            caption: { type: 'string' },
            video_url: { type: 'string' },
            thumbnail_url: { type: ['string', 'null'] },
            place_id: { type: ['string', 'null'] },
            created_at: { type: 'string', format: 'date-time' },
            view_count: { type: 'number' },
          },
        },
        404: {
          description: 'Post not found',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Params: { post_id: string } }>,
    reply: FastifyReply
  ): Promise<{ id: string; user_id: string; caption: string; video_url: string; thumbnail_url: string | null; place_id: string | null; created_at: Date; view_count: number } | void> => {
    const { post_id: postId } = request.params;

    app.logger.info({ postId }, 'Fetching post');

    try {
      const [post] = await app.db.select({
        id: schema.posts.id,
        user_id: schema.posts.userId,
        caption: schema.posts.caption,
        video_url: schema.posts.videoUrl,
        thumbnail_url: schema.posts.thumbnailUrl,
        place_id: schema.posts.placeId,
        created_at: schema.posts.createdAt,
        view_count: schema.postStats.viewCount,
      }).from(schema.posts)
        .leftJoin(schema.postStats, eq(schema.posts.id, schema.postStats.postId))
        .where(eq(schema.posts.id, postId))
        .limit(1);

      if (!post) {
        app.logger.warn({ postId }, 'Post not found');
        return reply.status(404).send({ error: 'Post not found' });
      }

      app.logger.info({ postId }, 'Post retrieved successfully');
      return {
        ...post,
        view_count: post.view_count || 0,
      };
    } catch (error) {
      app.logger.error({ err: error, postId }, 'Failed to fetch post');
      throw error;
    }
  });

  // POST /api/rpc/increment-view - Increment view count for a post
  app.fastify.post('/api/rpc/increment-view', {
    schema: {
      description: 'Increment view count for a post. Only increments if user is authenticated and not the post owner.',
      tags: ['posts'],
      body: {
        type: 'object',
        required: ['postId'],
        properties: {
          postId: { type: 'string', format: 'uuid', description: 'Post ID' },
        },
      },
      response: {
        200: {
          description: 'View count incremented',
          type: 'object',
          properties: {
            view_count: { type: ['number', 'null'] },
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
        404: {
          description: 'Post not found',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Body: { postId: string } }>,
    reply: FastifyReply
  ): Promise<{ view_count: number | null } | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    const { postId } = request.body;

    app.logger.info({ userId, postId }, 'Incrementing view count');

    try {
      // Get the post to check ownership
      const [post] = await app.db.select({
        id: schema.posts.id,
        userId: schema.posts.userId,
      }).from(schema.posts)
        .where(eq(schema.posts.id, postId))
        .limit(1);

      if (!post) {
        app.logger.warn({ postId }, 'Post not found');
        return reply.status(404).send({ error: 'Post not found' });
      }

      // Don't increment if user is the post owner
      if (post.userId === userId) {
        app.logger.info({ userId, postId }, 'User is post owner, skipping view increment');
        return { view_count: null };
      }

      // Increment view count using database function
      const result = await app.db.execute(
        sql`SELECT increment_view(${postId}::uuid) as view_count`
      );

      const viewCount = (result as any).rows?.[0]?.view_count;

      app.logger.info({ userId, postId, viewCount }, 'View count incremented successfully');
      return { view_count: viewCount };
    } catch (error) {
      app.logger.error({ err: error, userId, postId }, 'Failed to increment view count');
      throw error;
    }
  });

  // DELETE /api/posts/:post_id - Delete a post
  app.fastify.delete('/api/posts/:post_id', {
    schema: {
      description: 'Delete a post (only post owner can delete)',
      tags: ['posts'],
      params: {
        type: 'object',
        required: ['post_id'],
        properties: {
          post_id: { type: 'string', format: 'uuid', description: 'Post ID' },
        },
      },
      response: {
        200: {
          description: 'Post deleted successfully',
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
        403: {
          description: 'Forbidden - not post owner',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        404: {
          description: 'Post not found',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Params: { post_id: string } }>,
    reply: FastifyReply
  ): Promise<{ success: boolean } | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    const { post_id: postId } = request.params;

    app.logger.info({ userId, postId }, 'Deleting post');

    try {
      // Get the post to check ownership
      const [post] = await app.db.select({
        id: schema.posts.id,
        userId: schema.posts.userId,
      }).from(schema.posts)
        .where(eq(schema.posts.id, postId))
        .limit(1);

      if (!post) {
        app.logger.warn({ postId }, 'Post not found');
        return reply.status(404).send({ error: 'Post not found' });
      }

      if (post.userId !== userId) {
        app.logger.warn({ userId, postId, ownerId: post.userId }, 'User not authorized to delete post');
        return reply.status(403).send({ error: 'You can only delete your own posts' });
      }

      // Delete post stats first (cascading)
      await app.db.delete(schema.postStats).where(eq(schema.postStats.postId, postId));

      // Delete post
      await app.db.delete(schema.posts).where(eq(schema.posts.id, postId));

      app.logger.info({ userId, postId }, 'Post deleted successfully');
      return { success: true };
    } catch (error) {
      app.logger.error({ err: error, userId, postId }, 'Failed to delete post');
      throw error;
    }
  });
}
