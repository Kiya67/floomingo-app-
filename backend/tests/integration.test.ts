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
