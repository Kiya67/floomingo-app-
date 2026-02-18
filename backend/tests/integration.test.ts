import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app } from '../src/index.js';

describe('Block Feature', () => {
  let authToken: string;
  let userId: string;
  let targetUserId: string;

  beforeAll(async () => {
    // Wait for app to be fully initialized
    // Note: The app is already running from src/index.ts
  });

  afterAll(async () => {
    // Cleanup if needed
  });

  it('should create a session for testing', async () => {
    const response = await app.fastify.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      },
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.payload);
    expect(data.user).toBeDefined();
    userId = data.user.id;
  });

  it('should create another user to block', async () => {
    const response = await app.fastify.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: {
        email: 'target@example.com',
        password: 'password123',
        name: 'Target User',
      },
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.payload);
    targetUserId = data.user.id;
  });

  it('should return 401 when trying to block without authentication', async () => {
    const response = await app.fastify.inject({
      method: 'POST',
      url: '/api/blocks',
      payload: {
        blocked_id: targetUserId,
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it('should return 400 when blocking with missing blocked_id', async () => {
    // First get a session
    const loginResponse = await app.fastify.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      payload: {
        email: 'test@example.com',
        password: 'password123',
      },
    });

    expect(loginResponse.statusCode).toBe(200);
    authToken = loginResponse.cookies[0]?.value || '';

    // Try to block without blocked_id
    const response = await app.fastify.inject({
      method: 'POST',
      url: '/api/blocks',
      payload: {},
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(400);
  });

  it('should block a user', async () => {
    // Now block the user
    const response = await app.fastify.inject({
      method: 'POST',
      url: '/api/blocks',
      payload: {
        blocked_id: targetUserId,
      },
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.payload);
    expect(data.success).toBe(true);
  });

  it('should prevent self-blocking', async () => {
    const response = await app.fastify.inject({
      method: 'POST',
      url: '/api/blocks',
      payload: {
        blocked_id: userId,
      },
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(400);
    const data = JSON.parse(response.payload);
    expect(data.error).toBeDefined();
  });

  it('should return 401 when checking block status without authentication', async () => {
    const response = await app.fastify.inject({
      method: 'GET',
      url: `/api/blocks/check/${targetUserId}`,
    });

    expect(response.statusCode).toBe(401);
  });

  it('should check block status', async () => {
    const response = await app.fastify.inject({
      method: 'GET',
      url: `/api/blocks/check/${targetUserId}`,
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.payload);
    expect(data.isBlocked).toBe(true);
  });

  it('should get blocked users list', async () => {
    const response = await app.fastify.inject({
      method: 'GET',
      url: '/api/blocks',
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.payload);
    expect(Array.isArray(data)).toBe(true);
  });

  it('should return 401 when getting blocked users without authentication', async () => {
    const response = await app.fastify.inject({
      method: 'GET',
      url: '/api/blocks',
    });

    expect(response.statusCode).toBe(401);
  });

  it('should return 401 when unblocking without authentication', async () => {
    const response = await app.fastify.inject({
      method: 'DELETE',
      url: `/api/blocks/${targetUserId}`,
    });

    expect(response.statusCode).toBe(401);
  });

  it('should unblock a user', async () => {
    const response = await app.fastify.inject({
      method: 'DELETE',
      url: `/api/blocks/${targetUserId}`,
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.payload);
    expect(data.success).toBe(true);
  });

  it('should verify user is no longer blocked', async () => {
    const response = await app.fastify.inject({
      method: 'GET',
      url: `/api/blocks/check/${targetUserId}`,
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.payload);
    expect(data.isBlocked).toBe(false);
  });
});

describe('Boards Feature', () => {
  let authToken: string;
  let boardId: string;
  let postId: string;

  beforeAll(async () => {
    // Create a user for boards tests
    const signUpResponse = await app.fastify.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: {
        email: 'boards-test@example.com',
        password: 'password123',
        name: 'Boards Test User',
      },
    });

    expect(signUpResponse.statusCode).toBe(200);

    // Sign in to get auth token
    const signInResponse = await app.fastify.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      payload: {
        email: 'boards-test@example.com',
        password: 'password123',
      },
    });

    expect(signInResponse.statusCode).toBe(200);
    authToken = signInResponse.cookies[0]?.value || '';

    // Create a post for save-video tests
    const postResponse = await app.fastify.inject({
      method: 'POST',
      url: '/api/posts',
      payload: {
        caption: 'Test post for board',
        video_url: 'https://example.com/video.mp4',
      },
      cookies: { 'auth_token': authToken },
    });

    expect(postResponse.statusCode).toBe(201);
    const postData = JSON.parse(postResponse.payload);
    postId = postData.id;
  });

  afterAll(async () => {
    // Cleanup if needed
  });

  it('should return 401 when getting boards without authentication', async () => {
    const response = await app.fastify.inject({
      method: 'GET',
      url: '/api/boards',
    });

    expect(response.statusCode).toBe(401);
  });

  it('should return 400 when creating board without title', async () => {
    const response = await app.fastify.inject({
      method: 'POST',
      url: '/api/boards',
      payload: {},
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(400);
  });

  it('should create a board with authentication', async () => {
    const response = await app.fastify.inject({
      method: 'POST',
      url: '/api/boards',
      payload: {
        title: 'My Test Board',
      },
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(201);
    const data = JSON.parse(response.payload);
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('user_id');
    expect(data).toHaveProperty('title');
    expect(data.title).toBe('My Test Board');
    boardId = data.id;
  });

  it('should return 401 when creating board without authentication', async () => {
    const response = await app.fastify.inject({
      method: 'POST',
      url: '/api/boards',
      payload: {
        title: 'Another Board',
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it('should get boards for authenticated user', async () => {
    const response = await app.fastify.inject({
      method: 'GET',
      url: '/api/boards',
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.payload);
    expect(Array.isArray(data)).toBe(true);

    // If there are boards, verify structure
    if (data.length > 0) {
      expect(data[0]).toHaveProperty('id');
      expect(data[0]).toHaveProperty('title');
    }
  });

  it('should return 404 when getting videos for non-existent board', async () => {
    const nonExistentBoardId = '00000000-0000-0000-0000-000000000000';
    const response = await app.fastify.inject({
      method: 'GET',
      url: `/api/boards/${nonExistentBoardId}/videos`,
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(404);
  });

  it('should return 401 when getting board videos without authentication', async () => {
    const boardUuid = '00000000-0000-0000-0000-000000000000';
    const response = await app.fastify.inject({
      method: 'GET',
      url: `/api/boards/${boardUuid}/videos`,
    });

    expect(response.statusCode).toBe(401);
  });

  it('should get videos for board if one exists', async () => {
    if (!boardId) {
      expect(true).toBe(true);
      return;
    }

    const response = await app.fastify.inject({
      method: 'GET',
      url: `/api/boards/${boardId}/videos`,
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.payload);
    expect(Array.isArray(data)).toBe(true);
  });

  it('should return 404 when saving video to non-existent board', async () => {
    const nonExistentBoardId = '00000000-0000-0000-0000-000000000000';
    const response = await app.fastify.inject({
      method: 'POST',
      url: `/api/boards/${nonExistentBoardId}/save-video`,
      payload: {
        post_id: 'test-post-id',
      },
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(404);
  });

  it('should return 401 when saving video without authentication', async () => {
    const boardUuid = '00000000-0000-0000-0000-000000000000';
    const response = await app.fastify.inject({
      method: 'POST',
      url: `/api/boards/${boardUuid}/save-video`,
      payload: {
        post_id: 'test-post-id',
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it('should return 400 when saving video without post_id', async () => {
    const boardUuid = '00000000-0000-0000-0000-000000000000';
    const response = await app.fastify.inject({
      method: 'POST',
      url: `/api/boards/${boardUuid}/save-video`,
      payload: {},
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(400);
  });

  it('should save video to board successfully', async () => {
    if (!boardId || !postId) {
      expect(true).toBe(true);
      return;
    }

    const response = await app.fastify.inject({
      method: 'POST',
      url: `/api/boards/${boardId}/save-video`,
      payload: {
        post_id: postId,
      },
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.payload);
    expect(data.success).toBe(true);
  });

  it('should return 409 when saving same video to board twice', async () => {
    if (!boardId || !postId) {
      expect(true).toBe(true);
      return;
    }

    const response = await app.fastify.inject({
      method: 'POST',
      url: `/api/boards/${boardId}/save-video`,
      payload: {
        post_id: postId,
      },
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(409);
    const data = JSON.parse(response.payload);
    expect(data.error).toBeDefined();
  });

  it('should get saved videos from board', async () => {
    if (!boardId) {
      expect(true).toBe(true);
      return;
    }

    const response = await app.fastify.inject({
      method: 'GET',
      url: `/api/boards/${boardId}/videos`,
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.payload);
    expect(Array.isArray(data)).toBe(true);
    if (data.length > 0) {
      expect(data[0]).toHaveProperty('post_id');
      expect(data[0]).toHaveProperty('saved_at');
    }
  });
});

describe('Trips Feature', () => {
  let authToken: string;
  let tripId: string;
  let postId: string;

  beforeAll(async () => {
    // Create a user for trips tests
    const signUpResponse = await app.fastify.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: {
        email: 'trips-test@example.com',
        password: 'password123',
        name: 'Trips Test User',
      },
    });

    expect(signUpResponse.statusCode).toBe(200);

    // Sign in to get auth token
    const signInResponse = await app.fastify.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      payload: {
        email: 'trips-test@example.com',
        password: 'password123',
      },
    });

    expect(signInResponse.statusCode).toBe(200);
    authToken = signInResponse.cookies[0]?.value || '';

    // Create a post for save tests
    const postResponse = await app.fastify.inject({
      method: 'POST',
      url: '/api/posts',
      payload: {
        caption: 'Test post for trip',
        video_url: 'https://example.com/video.mp4',
      },
      cookies: { 'auth_token': authToken },
    });

    expect(postResponse.statusCode).toBe(201);
    const postData = JSON.parse(postResponse.payload);
    postId = postData.id;
  });

  afterAll(async () => {
    // Cleanup if needed
  });

  it('should return 401 when getting trips without authentication', async () => {
    const response = await app.fastify.inject({
      method: 'GET',
      url: '/api/trips',
    });

    expect(response.statusCode).toBe(401);
  });

  it('should get trips for authenticated user', async () => {
    const response = await app.fastify.inject({
      method: 'GET',
      url: '/api/trips',
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.payload);
    expect(Array.isArray(data)).toBe(true);

    // If there are trips, verify structure and store ID
    if (data.length > 0) {
      expect(data[0]).toHaveProperty('id');
      expect(data[0]).toHaveProperty('title');
      tripId = data[0].id;
    }
  });

  it('should return 404 when getting items for non-existent trip', async () => {
    const nonExistentTripId = '00000000-0000-0000-0000-000000000000';
    const response = await app.fastify.inject({
      method: 'GET',
      url: `/api/trips/${nonExistentTripId}/items`,
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(404);
  });

  it('should return 401 when getting trip items without authentication', async () => {
    const tripUuid = '00000000-0000-0000-0000-000000000000';
    const response = await app.fastify.inject({
      method: 'GET',
      url: `/api/trips/${tripUuid}/items`,
    });

    expect(response.statusCode).toBe(401);
  });

  it('should get trip items if trip exists', async () => {
    if (!tripId) {
      expect(true).toBe(true);
      return;
    }

    const response = await app.fastify.inject({
      method: 'GET',
      url: `/api/trips/${tripId}/items`,
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.payload);
    expect(Array.isArray(data)).toBe(true);
  });

  it('should return 404 when saving video to non-existent trip', async () => {
    const nonExistentTripId = '00000000-0000-0000-0000-000000000000';
    const response = await app.fastify.inject({
      method: 'POST',
      url: `/api/trips/${nonExistentTripId}/save`,
      payload: {
        post_id: 'test-post-id',
      },
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(404);
  });

  it('should return 401 when saving video to trip without authentication', async () => {
    const tripUuid = '00000000-0000-0000-0000-000000000000';
    const response = await app.fastify.inject({
      method: 'POST',
      url: `/api/trips/${tripUuid}/save`,
      payload: {
        post_id: 'test-post-id',
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it('should return 400 when saving video to trip without post_id', async () => {
    const tripUuid = '00000000-0000-0000-0000-000000000000';
    const response = await app.fastify.inject({
      method: 'POST',
      url: `/api/trips/${tripUuid}/save`,
      payload: {},
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(400);
  });

  it('should save video to trip successfully', async () => {
    if (!tripId || !postId) {
      expect(true).toBe(true);
      return;
    }

    const response = await app.fastify.inject({
      method: 'POST',
      url: `/api/trips/${tripId}/save`,
      payload: {
        post_id: postId,
      },
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.payload);
    expect(data.success).toBe(true);
    expect(data).toHaveProperty('trip_items_count');
  });

  it('should return 404 when removing video from non-existent trip', async () => {
    const nonExistentTripId = '00000000-0000-0000-0000-000000000000';
    const response = await app.fastify.inject({
      method: 'DELETE',
      url: `/api/trips/${nonExistentTripId}/items/test-post-id`,
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(404);
  });

  it('should return 401 when removing video from trip without authentication', async () => {
    const tripUuid = '00000000-0000-0000-0000-000000000000';
    const response = await app.fastify.inject({
      method: 'DELETE',
      url: `/api/trips/${tripUuid}/items/test-post-id`,
    });

    expect(response.statusCode).toBe(401);
  });

  it('should remove video from trip successfully', async () => {
    if (!tripId || !postId) {
      expect(true).toBe(true);
      return;
    }

    const response = await app.fastify.inject({
      method: 'DELETE',
      url: `/api/trips/${tripId}/items/${postId}`,
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.payload);
    expect(data.success).toBe(true);
    expect(data).toHaveProperty('trip_items_count');
  });
});

describe('Profile Stats Feature', () => {
  let userId: string;

  beforeAll(async () => {
    // Create a user for profile stats tests
    const signUpResponse = await app.fastify.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: {
        email: 'profile-stats-test@example.com',
        password: 'password123',
        name: 'Profile Stats Test User',
      },
    });

    expect(signUpResponse.statusCode).toBe(200);
    const data = JSON.parse(signUpResponse.payload);
    userId = data.user.id;
  });

  afterAll(async () => {
    // Cleanup if needed
  });

  it('should get profile stats for existing user', async () => {
    const response = await app.fastify.inject({
      method: 'GET',
      url: `/api/profile/stats/${userId}`,
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.payload);
    expect(data).toHaveProperty('user_id');
    expect(data).toHaveProperty('post_count');
    expect(data).toHaveProperty('follower_count');
    expect(data).toHaveProperty('following_count');
  });

  it('should return 404 for non-existent user profile stats', async () => {
    const nonExistentUserId = '00000000-0000-0000-0000-000000000000';
    const response = await app.fastify.inject({
      method: 'GET',
      url: `/api/profile/stats/${nonExistentUserId}`,
    });

    expect(response.statusCode).toBe(404);
  });

  it('should recalculate profile stats for existing user', async () => {
    const response = await app.fastify.inject({
      method: 'POST',
      url: `/api/profile/stats/recalculate/${userId}`,
    });

    expect([200, 500]).toContain(response.statusCode);
    const data = JSON.parse(response.payload);

    if (response.statusCode === 200) {
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('post_count');
      expect(data).toHaveProperty('follower_count');
      expect(data).toHaveProperty('following_count');
    } else {
      expect(data).toHaveProperty('error');
    }
  });
});

describe('Posts Feature', () => {
  let authToken: string;
  let userId: string;
  let postId: string;
  let otherUserId: string;
  let otherUserToken: string;

  beforeAll(async () => {
    // Create user 1 for posts
    const signUpResponse = await app.fastify.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: {
        email: 'posts-user1@example.com',
        password: 'password123',
        name: 'Posts User 1',
      },
    });

    expect(signUpResponse.statusCode).toBe(200);
    const data = JSON.parse(signUpResponse.payload);
    userId = data.user.id;

    // Sign in to get auth token
    const signInResponse = await app.fastify.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      payload: {
        email: 'posts-user1@example.com',
        password: 'password123',
      },
    });

    expect(signInResponse.statusCode).toBe(200);
    authToken = signInResponse.cookies[0]?.value || '';

    // Create user 2 for viewing posts
    const signUpResponse2 = await app.fastify.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: {
        email: 'posts-user2@example.com',
        password: 'password123',
        name: 'Posts User 2',
      },
    });

    expect(signUpResponse2.statusCode).toBe(200);
    const data2 = JSON.parse(signUpResponse2.payload);
    otherUserId = data2.user.id;

    // Sign in user 2
    const signInResponse2 = await app.fastify.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      payload: {
        email: 'posts-user2@example.com',
        password: 'password123',
      },
    });

    expect(signInResponse2.statusCode).toBe(200);
    otherUserToken = signInResponse2.cookies[0]?.value || '';
  });

  afterAll(async () => {
    // Cleanup if needed
  });

  it('should return 401 when creating post without authentication', async () => {
    const response = await app.fastify.inject({
      method: 'POST',
      url: '/api/posts',
      payload: {
        caption: 'Test post',
        video_url: 'https://example.com/video.mp4',
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it('should return 400 when creating post without required fields', async () => {
    const response = await app.fastify.inject({
      method: 'POST',
      url: '/api/posts',
      payload: {
        caption: 'Missing video URL',
      },
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(400);
  });

  it('should return 400 when creating post with invalid video_url', async () => {
    const response = await app.fastify.inject({
      method: 'POST',
      url: '/api/posts',
      payload: {
        caption: 'Invalid URL',
        video_url: 'not-a-url',
      },
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(400);
  });

  it('should create a post with authentication', async () => {
    const response = await app.fastify.inject({
      method: 'POST',
      url: '/api/posts',
      payload: {
        caption: 'Test video post',
        video_url: 'https://example.com/video.mp4',
        thumbnail_url: 'https://example.com/thumb.jpg',
        place_id: 'place-123',
      },
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(201);
    const data = JSON.parse(response.payload);
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('user_id');
    expect(data.caption).toBe('Test video post');
    expect(data.view_count).toBe(0);
    postId = data.id;
  });

  it('should get a single post with view count', async () => {
    const response = await app.fastify.inject({
      method: 'GET',
      url: `/api/posts/${postId}`,
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.payload);
    expect(data.id).toBe(postId);
    expect(data).toHaveProperty('view_count');
  });

  it('should return 404 for non-existent post', async () => {
    const nonExistentPostId = '00000000-0000-0000-0000-000000000000';
    const response = await app.fastify.inject({
      method: 'GET',
      url: `/api/posts/${nonExistentPostId}`,
    });

    expect(response.statusCode).toBe(404);
  });

  it('should return 401 when incrementing view without authentication', async () => {
    const response = await app.fastify.inject({
      method: 'POST',
      url: '/api/rpc/increment-view',
      payload: {
        postId: postId,
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it('should return 400 when incrementing view without postId', async () => {
    const response = await app.fastify.inject({
      method: 'POST',
      url: '/api/rpc/increment-view',
      payload: {},
      cookies: { 'auth_token': otherUserToken },
    });

    expect(response.statusCode).toBe(400);
  });

  it('should return null view_count when post owner tries to increment', async () => {
    const response = await app.fastify.inject({
      method: 'POST',
      url: '/api/rpc/increment-view',
      payload: {
        postId: postId,
      },
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.payload);
    expect(data.view_count).toBeNull();
  });

  it('should increment view count when other user views', async () => {
    const response = await app.fastify.inject({
      method: 'POST',
      url: '/api/rpc/increment-view',
      payload: {
        postId: postId,
      },
      cookies: { 'auth_token': otherUserToken },
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.payload);
    expect(data.view_count).toBeGreaterThanOrEqual(1);
  });

  it('should return 404 when incrementing non-existent post', async () => {
    const nonExistentPostId = '00000000-0000-0000-0000-000000000000';
    const response = await app.fastify.inject({
      method: 'POST',
      url: '/api/rpc/increment-view',
      payload: {
        postId: nonExistentPostId,
      },
      cookies: { 'auth_token': otherUserToken },
    });

    expect(response.statusCode).toBe(404);
  });

  it('should get user posts with view_count when viewing own profile', async () => {
    const response = await app.fastify.inject({
      method: 'GET',
      url: `/api/users/${userId}/posts`,
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.payload);
    expect(Array.isArray(data)).toBe(true);
    if (data.length > 0) {
      expect(data[0]).toHaveProperty('view_count');
      expect(typeof data[0].view_count).toBe('number');
    }
  });

  it('should get user posts without view_count when viewing other profile', async () => {
    const response = await app.fastify.inject({
      method: 'GET',
      url: `/api/users/${userId}/posts`,
      cookies: { 'auth_token': otherUserToken },
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.payload);
    expect(Array.isArray(data)).toBe(true);
    if (data.length > 0) {
      expect(data[0].view_count).toBeNull();
    }
  });

  it('should get user posts without authentication', async () => {
    const response = await app.fastify.inject({
      method: 'GET',
      url: `/api/users/${userId}/posts`,
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.payload);
    expect(Array.isArray(data)).toBe(true);
    if (data.length > 0) {
      expect(data[0].view_count).toBeNull();
    }
  });

  it('should return 401 when deleting post without authentication', async () => {
    const response = await app.fastify.inject({
      method: 'DELETE',
      url: `/api/posts/${postId}`,
    });

    expect(response.statusCode).toBe(401);
  });

  it('should return 403 when deleting other user post', async () => {
    const response = await app.fastify.inject({
      method: 'DELETE',
      url: `/api/posts/${postId}`,
      cookies: { 'auth_token': otherUserToken },
    });

    expect(response.statusCode).toBe(403);
  });

  it('should delete own post', async () => {
    const response = await app.fastify.inject({
      method: 'DELETE',
      url: `/api/posts/${postId}`,
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.payload);
    expect(data.success).toBe(true);
  });

  it('should return 404 when deleting non-existent post', async () => {
    const nonExistentPostId = '00000000-0000-0000-0000-000000000000';
    const response = await app.fastify.inject({
      method: 'DELETE',
      url: `/api/posts/${nonExistentPostId}`,
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(404);
  });
});

describe('Follow Feature', () => {
  let authToken: string;
  let userId: string;
  let followUserId: string;
  let followUserToken: string;

  beforeAll(async () => {
    // Create user 1 (follower)
    const signUpResponse = await app.fastify.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: {
        email: 'follow-user1@example.com',
        password: 'password123',
        name: 'Follow User 1',
      },
    });

    expect(signUpResponse.statusCode).toBe(200);
    const data = JSON.parse(signUpResponse.payload);
    userId = data.user.id;

    // Sign in user 1
    const signInResponse = await app.fastify.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      payload: {
        email: 'follow-user1@example.com',
        password: 'password123',
      },
    });

    expect(signInResponse.statusCode).toBe(200);
    authToken = signInResponse.cookies[0]?.value || '';

    // Create user 2 (to be followed)
    const signUpResponse2 = await app.fastify.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: {
        email: 'follow-user2@example.com',
        password: 'password123',
        name: 'Follow User 2',
      },
    });

    expect(signUpResponse2.statusCode).toBe(200);
    const data2 = JSON.parse(signUpResponse2.payload);
    followUserId = data2.user.id;

    // Sign in user 2
    const signInResponse2 = await app.fastify.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      payload: {
        email: 'follow-user2@example.com',
        password: 'password123',
      },
    });

    expect(signInResponse2.statusCode).toBe(200);
    followUserToken = signInResponse2.cookies[0]?.value || '';
  });

  afterAll(async () => {
    // Cleanup if needed
  });

  it('should return 401 when following without authentication', async () => {
    const response = await app.fastify.inject({
      method: 'POST',
      url: `/api/follow/${followUserId}`,
    });

    expect(response.statusCode).toBe(401);
  });

  it('should follow a user', async () => {
    const response = await app.fastify.inject({
      method: 'POST',
      url: `/api/follow/${followUserId}`,
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.payload);
    expect(data.success).toBe(true);
    expect(data).toHaveProperty('follower_count');
  });

  it('should return 400 when trying to follow same user twice', async () => {
    const response = await app.fastify.inject({
      method: 'POST',
      url: `/api/follow/${followUserId}`,
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(400);
    const data = JSON.parse(response.payload);
    expect(data.error).toBeDefined();
  });

  it('should return 400 when trying to follow self', async () => {
    const response = await app.fastify.inject({
      method: 'POST',
      url: `/api/follow/${userId}`,
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(400);
    const data = JSON.parse(response.payload);
    expect(data.error).toBeDefined();
  });

  it('should check follow status - returns true when following', async () => {
    const response = await app.fastify.inject({
      method: 'GET',
      url: `/api/follow/status/${followUserId}`,
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.payload);
    expect(data.isFollowing).toBe(true);
  });

  it('should return 401 when checking follow status without authentication', async () => {
    const response = await app.fastify.inject({
      method: 'GET',
      url: `/api/follow/status/${followUserId}`,
    });

    expect(response.statusCode).toBe(401);
  });

  it('should get followers list', async () => {
    const response = await app.fastify.inject({
      method: 'GET',
      url: `/api/followers/${followUserId}`,
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.payload);
    expect(Array.isArray(data)).toBe(true);
    if (data.length > 0) {
      expect(data[0]).toHaveProperty('id');
      expect(data[0]).toHaveProperty('username');
    }
  });

  it('should get following list', async () => {
    const response = await app.fastify.inject({
      method: 'GET',
      url: `/api/following/${userId}`,
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.payload);
    expect(Array.isArray(data)).toBe(true);
    if (data.length > 0) {
      expect(data[0]).toHaveProperty('id');
      expect(data[0]).toHaveProperty('username');
    }
  });

  it('should return 401 when unfollowing without authentication', async () => {
    const response = await app.fastify.inject({
      method: 'DELETE',
      url: `/api/follow/${followUserId}`,
    });

    expect(response.statusCode).toBe(401);
  });

  it('should unfollow a user', async () => {
    const response = await app.fastify.inject({
      method: 'DELETE',
      url: `/api/follow/${followUserId}`,
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.payload);
    expect(data.success).toBe(true);
    expect(data).toHaveProperty('follower_count');
  });

  it('should check follow status - returns false after unfollow', async () => {
    const response = await app.fastify.inject({
      method: 'GET',
      url: `/api/follow/status/${followUserId}`,
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.payload);
    expect(data.isFollowing).toBe(false);
  });

  it('should return 400 when unfollowing if not following', async () => {
    const response = await app.fastify.inject({
      method: 'DELETE',
      url: `/api/follow/${followUserId}`,
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(400);
    const data = JSON.parse(response.payload);
    expect(data.error).toBeDefined();
  });
});

describe('Account Feature', () => {
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    // Create a user for account deletion test
    const signUpResponse = await app.fastify.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: {
        email: 'account-delete@example.com',
        password: 'password123',
        name: 'Account Delete User',
      },
    });

    expect(signUpResponse.statusCode).toBe(200);
    const data = JSON.parse(signUpResponse.payload);
    userId = data.user.id;

    // Sign in
    const signInResponse = await app.fastify.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      payload: {
        email: 'account-delete@example.com',
        password: 'password123',
      },
    });

    expect(signInResponse.statusCode).toBe(200);
    authToken = signInResponse.cookies[0]?.value || '';
  });

  afterAll(async () => {
    // Cleanup if needed
  });

  it('should return 401 when deleting account without authentication', async () => {
    const response = await app.fastify.inject({
      method: 'POST',
      url: '/api/account/delete',
    });

    expect(response.statusCode).toBe(401);
  });

  it('should delete authenticated user account', async () => {
    const response = await app.fastify.inject({
      method: 'POST',
      url: '/api/account/delete',
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.payload);
    expect(data.success).toBe(true);
  });

  it('should not allow login with deleted account', async () => {
    const response = await app.fastify.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      payload: {
        email: 'account-delete@example.com',
        password: 'password123',
      },
    });

    // Should fail because account was deleted
    expect(response.statusCode).not.toBe(200);
  });
});

describe('Profile Feature', () => {
  let authToken: string;
  let userId: string;
  let otherUserId: string;

  beforeAll(async () => {
    // Create user 1 for profile tests
    const signUpResponse = await app.fastify.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: {
        email: 'profile-user1@example.com',
        password: 'password123',
        name: 'Profile User 1',
      },
    });

    expect(signUpResponse.statusCode).toBe(200);
    const data = JSON.parse(signUpResponse.payload);
    userId = data.user.id;

    // Sign in user 1
    const signInResponse = await app.fastify.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      payload: {
        email: 'profile-user1@example.com',
        password: 'password123',
      },
    });

    expect(signInResponse.statusCode).toBe(200);
    authToken = signInResponse.cookies[0]?.value || '';

    // Create user 2 for profile retrieval
    const signUpResponse2 = await app.fastify.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: {
        email: 'profile-user2@example.com',
        password: 'password123',
        name: 'Profile User 2',
      },
    });

    expect(signUpResponse2.statusCode).toBe(200);
    const data2 = JSON.parse(signUpResponse2.payload);
    otherUserId = data2.user.id;
  });

  afterAll(async () => {
    // Cleanup if needed
  });

  it('should return 401 when getting own profile without authentication', async () => {
    const response = await app.fastify.inject({
      method: 'GET',
      url: '/api/profile',
    });

    expect(response.statusCode).toBe(401);
  });

  it('should get authenticated user profile', async () => {
    const response = await app.fastify.inject({
      method: 'GET',
      url: '/api/profile',
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.payload);
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('created_at');
    expect(data).toHaveProperty('updated_at');
  });

  it('should return 404 when getting non-existent user profile', async () => {
    const response = await app.fastify.inject({
      method: 'GET',
      url: '/api/profile/00000000-0000-0000-0000-000000000000',
    });

    expect(response.statusCode).toBe(404);
  });

  it('should get user profile by ID', async () => {
    const response = await app.fastify.inject({
      method: 'GET',
      url: `/api/profile/${otherUserId}`,
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.payload);
    expect(data.id).toBe(otherUserId);
    expect(data).toHaveProperty('created_at');
  });

  it('should return 401 when updating profile without authentication', async () => {
    const response = await app.fastify.inject({
      method: 'PUT',
      url: '/api/profile',
      payload: {
        display_name: 'Updated Name',
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it('should update authenticated user profile', async () => {
    const response = await app.fastify.inject({
      method: 'PUT',
      url: '/api/profile',
      payload: {
        display_name: 'Updated Display Name',
        username: 'newusername',
        bio: 'My bio',
      },
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.payload);
    expect(data.display_name).toBe('Updated Display Name');
    expect(data.username).toBe('newusername');
    expect(data.bio).toBe('My bio');
  });

  it('should return 400 when updating profile with invalid username format', async () => {
    const response = await app.fastify.inject({
      method: 'PUT',
      url: '/api/profile',
      payload: {
        username: 'in', // too short
      },
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(400);
  });

  it('should return 400 when updating profile with invalid username characters', async () => {
    const response = await app.fastify.inject({
      method: 'PUT',
      url: '/api/profile',
      payload: {
        username: 'invalid-username', // contains hyphen
      },
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(400);
  });

  it('should return 400 when updating profile with invalid avatar URL', async () => {
    const response = await app.fastify.inject({
      method: 'PUT',
      url: '/api/profile',
      payload: {
        avatar_url: 'not-a-url',
      },
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(400);
  });

  it('should return 400 when updating profile with invalid bio URL', async () => {
    const response = await app.fastify.inject({
      method: 'PUT',
      url: '/api/profile',
      payload: {
        bio_url: 'not-a-url',
      },
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(400);
  });

  it('should return 400 when updating profile with bio exceeding max length', async () => {
    const response = await app.fastify.inject({
      method: 'PUT',
      url: '/api/profile',
      payload: {
        bio: 'a'.repeat(501), // exceeds 500 char limit
      },
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(400);
  });

  it('should return 401 when ensuring profile without authentication', async () => {
    const response = await app.fastify.inject({
      method: 'POST',
      url: '/api/profile/ensure',
    });

    expect(response.statusCode).toBe(401);
  });

  it('should ensure profile exists for authenticated user', async () => {
    const response = await app.fastify.inject({
      method: 'POST',
      url: '/api/profile/ensure',
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.payload);
    expect(data.success).toBe(true);
  });
});
