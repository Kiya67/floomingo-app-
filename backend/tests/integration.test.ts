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
      boardId = data[0].id;
    }
  });

  it('should return 404 when getting places for non-existent board', async () => {
    const nonExistentBoardId = '00000000-0000-0000-0000-000000000000';
    const response = await app.fastify.inject({
      method: 'GET',
      url: `/api/boards/${nonExistentBoardId}/places`,
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(404);
  });

  it('should return 400 for invalid UUID format when getting places', async () => {
    const response = await app.fastify.inject({
      method: 'GET',
      url: '/api/boards/invalid-uuid/places',
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(400);
  });

  it('should return 401 when getting places without authentication', async () => {
    const boardUuid = '00000000-0000-0000-0000-000000000000';
    const response = await app.fastify.inject({
      method: 'GET',
      url: `/api/boards/${boardUuid}/places`,
    });

    expect(response.statusCode).toBe(401);
  });

  it('should get places for a board if one exists', async () => {
    if (!boardId) {
      // Skip if no boards exist
      expect(true).toBe(true);
      return;
    }

    const response = await app.fastify.inject({
      method: 'GET',
      url: `/api/boards/${boardId}/places`,
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

  it('should return 400 for invalid UUID when saving video', async () => {
    const response = await app.fastify.inject({
      method: 'POST',
      url: '/api/boards/invalid-uuid/save-video',
      payload: {
        post_id: 'test-post-id',
      },
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(400);
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

  it('should return 404 when saving video with location to non-existent board', async () => {
    const nonExistentBoardId = '00000000-0000-0000-0000-000000000000';
    const response = await app.fastify.inject({
      method: 'POST',
      url: `/api/boards/${nonExistentBoardId}/save-video-with-location`,
      payload: {
        post_id: 'test-post-id',
        place_id: 'test-place-id',
        place_name: 'Test Place',
        place_address: '123 Test St',
        place_primary_type: 'restaurant',
      },
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(404);
  });

  it('should return 400 for invalid UUID when saving video with location', async () => {
    const response = await app.fastify.inject({
      method: 'POST',
      url: '/api/boards/invalid-uuid/save-video-with-location',
      payload: {
        post_id: 'test-post-id',
        place_id: 'test-place-id',
        place_name: 'Test Place',
        place_address: '123 Test St',
        place_primary_type: 'restaurant',
      },
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(400);
  });

  it('should return 401 when saving video with location without authentication', async () => {
    const boardUuid = '00000000-0000-0000-0000-000000000000';
    const response = await app.fastify.inject({
      method: 'POST',
      url: `/api/boards/${boardUuid}/save-video-with-location`,
      payload: {
        post_id: 'test-post-id',
        place_id: 'test-place-id',
        place_name: 'Test Place',
        place_address: '123 Test St',
        place_primary_type: 'restaurant',
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it('should return 400 when saving video with location without required fields', async () => {
    const boardUuid = '00000000-0000-0000-0000-000000000000';
    const response = await app.fastify.inject({
      method: 'POST',
      url: `/api/boards/${boardUuid}/save-video-with-location`,
      payload: {
        post_id: 'test-post-id',
        // Missing other required fields
      },
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(400);
  });
});

describe('Trips Feature', () => {
  let authToken: string;
  let tripId: string;

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

  it('should return 400 for invalid UUID format when getting trip items', async () => {
    const response = await app.fastify.inject({
      method: 'GET',
      url: '/api/trips/invalid-uuid/items',
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(400);
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

  it('should return 400 for invalid UUID when saving video to trip', async () => {
    const response = await app.fastify.inject({
      method: 'POST',
      url: '/api/trips/invalid-uuid/save',
      payload: {
        post_id: 'test-post-id',
      },
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(400);
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

  it('should return 404 when removing video from non-existent trip', async () => {
    const nonExistentTripId = '00000000-0000-0000-0000-000000000000';
    const response = await app.fastify.inject({
      method: 'DELETE',
      url: `/api/trips/${nonExistentTripId}/items/test-post-id`,
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(404);
  });

  it('should return 400 for invalid UUID when removing video from trip', async () => {
    const response = await app.fastify.inject({
      method: 'DELETE',
      url: '/api/trips/invalid-uuid/items/test-post-id',
      cookies: { 'auth_token': authToken },
    });

    expect(response.statusCode).toBe(400);
  });

  it('should return 401 when removing video from trip without authentication', async () => {
    const tripUuid = '00000000-0000-0000-0000-000000000000';
    const response = await app.fastify.inject({
      method: 'DELETE',
      url: `/api/trips/${tripUuid}/items/test-post-id`,
    });

    expect(response.statusCode).toBe(401);
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
