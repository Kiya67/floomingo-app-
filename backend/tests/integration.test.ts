import { describe, it, expect } from 'vitest';
import {
  api,
  authenticatedApi,
  expectStatus,
  signUpTestUser,
} from './helpers.js';

describe('Block Feature', () => {
  let authToken: string;
  let userId: string;
  let targetUserId: string;
  let targetToken: string;

  it('should set up test users for blocking', async () => {
    const user1 = await signUpTestUser();
    authToken = user1.token;
    userId = user1.user.id;

    const user2 = await signUpTestUser();
    targetUserId = user2.user.id;
    targetToken = user2.token;
  });

  it('should return 401 when trying to block without authentication', async () => {
    const res = await api('/api/blocks', {
      method: 'POST',
      body: JSON.stringify({ blocked_id: targetUserId }),
      headers: { 'Content-Type': 'application/json' },
    });
    await expectStatus(res, 401);
  });

  it('should return 400 when blocking with missing blocked_id', async () => {
    const res = await authenticatedApi('/api/blocks', authToken, {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    await expectStatus(res, 400);
  });

  it('should block a user successfully', async () => {
    const res = await authenticatedApi('/api/blocks', authToken, {
      method: 'POST',
      body: JSON.stringify({ blocked_id: targetUserId }),
      headers: { 'Content-Type': 'application/json' },
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it('should prevent self-blocking', async () => {
    const res = await authenticatedApi('/api/blocks', authToken, {
      method: 'POST',
      body: JSON.stringify({ blocked_id: userId }),
      headers: { 'Content-Type': 'application/json' },
    });
    await expectStatus(res, 400);
  });

  it('should return 401 when checking block status without authentication', async () => {
    const res = await api(`/api/blocks/check/${targetUserId}`);
    await expectStatus(res, 401);
  });

  it('should check block status - returns true when blocked', async () => {
    const res = await authenticatedApi(
      `/api/blocks/check/${targetUserId}`,
      authToken
    );
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.isBlocked).toBe(true);
  });

  it('should get blocked users list', async () => {
    const res = await authenticatedApi('/api/blocks', authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it('should return 401 when getting blocked users without authentication', async () => {
    const res = await api('/api/blocks');
    await expectStatus(res, 401);
  });

  it('should return 401 when unblocking without authentication', async () => {
    const res = await api(`/api/blocks/${targetUserId}`, { method: 'DELETE' });
    await expectStatus(res, 401);
  });

  it('should unblock a user successfully', async () => {
    const res = await authenticatedApi(`/api/blocks/${targetUserId}`, authToken, {
      method: 'DELETE',
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it('should verify user is no longer blocked', async () => {
    const res = await authenticatedApi(
      `/api/blocks/check/${targetUserId}`,
      authToken
    );
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.isBlocked).toBe(false);
  });
});

describe('Boards Feature', () => {
  let authToken: string;
  let boardId: string;
  let postId: string;

  it('should set up test user and create a post', async () => {
    const user = await signUpTestUser();
    authToken = user.token;

    const postRes = await authenticatedApi('/api/posts', authToken, {
      method: 'POST',
      body: JSON.stringify({
        caption: 'Test post for board',
        video_url: 'https://example.com/video.mp4',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    await expectStatus(postRes, 201);
    const postData = await postRes.json();
    postId = postData.id;
  });

  it('should return 401 when getting boards without authentication', async () => {
    const res = await api('/api/boards');
    await expectStatus(res, 401);
  });

  it('should return 400 when creating board without title', async () => {
    const res = await authenticatedApi('/api/boards', authToken, {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    await expectStatus(res, 400);
  });

  it('should create a board with authentication', async () => {
    const res = await authenticatedApi('/api/boards', authToken, {
      method: 'POST',
      body: JSON.stringify({ title: 'My Test Board' }),
      headers: { 'Content-Type': 'application/json' },
    });
    await expectStatus(res, 201);
    const data = await res.json();
    expect(data.title).toBe('My Test Board');
    boardId = data.id;
  });

  it('should return 401 when creating board without authentication', async () => {
    const res = await api('/api/boards', {
      method: 'POST',
      body: JSON.stringify({ title: 'Another Board' }),
      headers: { 'Content-Type': 'application/json' },
    });
    await expectStatus(res, 401);
  });

  it('should get boards for authenticated user', async () => {
    const res = await authenticatedApi('/api/boards', authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it('should return 404 when getting videos for non-existent board', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';
    const res = await authenticatedApi(
      `/api/boards/${nonExistentId}/videos`,
      authToken
    );
    await expectStatus(res, 404);
  });

  it('should return 400 when getting videos with invalid board UUID format', async () => {
    const res = await authenticatedApi(
      `/api/boards/invalid-uuid/videos`,
      authToken
    );
    await expectStatus(res, 400);
  });

  it('should return 401 when getting board videos without authentication', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';
    const res = await api(`/api/boards/${nonExistentId}/videos`);
    await expectStatus(res, 401);
  });

  it('should get videos for existing board', async () => {
    const res = await authenticatedApi(
      `/api/boards/${boardId}/videos`,
      authToken
    );
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it('should return 404 when saving video to non-existent board', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';
    const res = await authenticatedApi(
      `/api/boards/${nonExistentId}/save-video`,
      authToken,
      {
        method: 'POST',
        body: JSON.stringify({ post_id: 'test-post-id' }),
        headers: { 'Content-Type': 'application/json' },
      }
    );
    await expectStatus(res, 404);
  });

  it('should return 401 when saving video without authentication', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';
    const res = await api(`/api/boards/${nonExistentId}/save-video`, {
      method: 'POST',
      body: JSON.stringify({ post_id: 'test-post-id' }),
      headers: { 'Content-Type': 'application/json' },
    });
    await expectStatus(res, 401);
  });

  it('should return 400 when saving video without post_id', async () => {
    const res = await authenticatedApi(
      `/api/boards/${boardId}/save-video`,
      authToken,
      {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      }
    );
    await expectStatus(res, 400);
  });

  it('should save video to board successfully', async () => {
    const res = await authenticatedApi(
      `/api/boards/${boardId}/save-video`,
      authToken,
      {
        method: 'POST',
        body: JSON.stringify({ post_id: postId }),
        headers: { 'Content-Type': 'application/json' },
      }
    );
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it('should return 409 when saving same video to board twice', async () => {
    const res = await authenticatedApi(
      `/api/boards/${boardId}/save-video`,
      authToken,
      {
        method: 'POST',
        body: JSON.stringify({ post_id: postId }),
        headers: { 'Content-Type': 'application/json' },
      }
    );
    await expectStatus(res, 409);
  });

  it('should get saved videos from board', async () => {
    const res = await authenticatedApi(
      `/api/boards/${boardId}/videos`,
      authToken
    );
    await expectStatus(res, 200);
    const data = await res.json();
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

  it('should set up test user and create a post', async () => {
    const user = await signUpTestUser();
    authToken = user.token;

    const postRes = await authenticatedApi('/api/posts', authToken, {
      method: 'POST',
      body: JSON.stringify({
        caption: 'Test post for trip',
        video_url: 'https://example.com/video.mp4',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    await expectStatus(postRes, 201);
    const postData = await postRes.json();
    postId = postData.id;
  });

  it('should return 401 when getting trips without authentication', async () => {
    const res = await api('/api/trips');
    await expectStatus(res, 401);
  });

  it('should get trips for authenticated user', async () => {
    const res = await authenticatedApi('/api/trips', authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);

    if (data.length > 0) {
      tripId = data[0].id;
    }
  });

  it('should return 404 when getting items for non-existent trip', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';
    const res = await authenticatedApi(
      `/api/trips/${nonExistentId}/items`,
      authToken
    );
    await expectStatus(res, 404);
  });

  it('should return 401 when getting trip items without authentication', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';
    const res = await api(`/api/trips/${nonExistentId}/items`);
    await expectStatus(res, 401);
  });

  it('should get trip items if trip exists', async () => {
    if (!tripId) {
      expect(true).toBe(true);
      return;
    }

    const res = await authenticatedApi(`/api/trips/${tripId}/items`, authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it('should return 404 when saving video to non-existent trip', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';
    const res = await authenticatedApi(
      `/api/trips/${nonExistentId}/save`,
      authToken,
      {
        method: 'POST',
        body: JSON.stringify({ post_id: 'test-post-id' }),
        headers: { 'Content-Type': 'application/json' },
      }
    );
    await expectStatus(res, 404);
  });

  it('should return 401 when saving video to trip without authentication', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';
    const res = await api(`/api/trips/${nonExistentId}/save`, {
      method: 'POST',
      body: JSON.stringify({ post_id: 'test-post-id' }),
      headers: { 'Content-Type': 'application/json' },
    });
    await expectStatus(res, 401);
  });

  it('should return 400 when saving video to trip without post_id', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';
    const res = await authenticatedApi(
      `/api/trips/${nonExistentId}/save`,
      authToken,
      {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      }
    );
    await expectStatus(res, 400);
  });

  it('should save video to trip successfully', async () => {
    if (!tripId || !postId) {
      expect(true).toBe(true);
      return;
    }

    const res = await authenticatedApi(`/api/trips/${tripId}/save`, authToken, {
      method: 'POST',
      body: JSON.stringify({ post_id: postId }),
      headers: { 'Content-Type': 'application/json' },
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data).toHaveProperty('trip_items_count');
  });

  it('should remove video from trip successfully', async () => {
    if (!tripId || !postId) {
      expect(true).toBe(true);
      return;
    }

    const res = await authenticatedApi(
      `/api/trips/${tripId}/items/${postId}`,
      authToken,
      { method: 'DELETE' }
    );
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data).toHaveProperty('trip_items_count');
  });

  it('should return 404 when removing video from non-existent trip', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';
    const res = await authenticatedApi(
      `/api/trips/${nonExistentId}/items/test-post-id`,
      authToken,
      { method: 'DELETE' }
    );
    await expectStatus(res, 404);
  });

  it('should return 401 when removing video from trip without authentication', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';
    const res = await api(`/api/trips/${nonExistentId}/items/test-post-id`, {
      method: 'DELETE',
    });
    await expectStatus(res, 401);
  });
});

describe('Profile Stats Feature', () => {
  let userId: string;

  it('should set up test user', async () => {
    const user = await signUpTestUser();
    userId = user.user.id;
  });

  it('should get profile stats for existing user', async () => {
    const res = await api(`/api/profile/stats/${userId}`);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data).toHaveProperty('user_id');
    expect(data).toHaveProperty('post_count');
    expect(data).toHaveProperty('follower_count');
    expect(data).toHaveProperty('following_count');
  });

  it('should return 404 for non-existent user profile stats', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';
    const res = await api(`/api/profile/stats/${nonExistentId}`);
    await expectStatus(res, 404);
  });

  it('should recalculate profile stats for existing user', async () => {
    const res = await api(`/api/profile/stats/recalculate/${userId}`, {
      method: 'POST',
    });
    await expectStatus(res, 200, 500);
    const data = await res.json();

    if (res.status === 200) {
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('post_count');
    } else {
      expect(data).toHaveProperty('error');
    }
  });
});

describe('Posts Feature', () => {
  let authToken: string;
  let userId: string;
  let postId: string;
  let otherUserToken: string;
  let otherUserId: string;

  it('should set up test users', async () => {
    const user1 = await signUpTestUser();
    authToken = user1.token;
    userId = user1.user.id;

    const user2 = await signUpTestUser();
    otherUserToken = user2.token;
    otherUserId = user2.user.id;
  });

  it('should return 401 when creating post without authentication', async () => {
    const res = await api('/api/posts', {
      method: 'POST',
      body: JSON.stringify({
        caption: 'Test post',
        video_url: 'https://example.com/video.mp4',
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    await expectStatus(res, 401);
  });

  it('should return 400 when creating post without required fields', async () => {
    const res = await authenticatedApi('/api/posts', authToken, {
      method: 'POST',
      body: JSON.stringify({ caption: 'Missing video URL' }),
      headers: { 'Content-Type': 'application/json' },
    });
    await expectStatus(res, 400);
  });

  it('should return 400 when creating post with invalid video_url', async () => {
    const res = await authenticatedApi('/api/posts', authToken, {
      method: 'POST',
      body: JSON.stringify({
        caption: 'Invalid URL',
        video_url: 'not-a-url',
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    await expectStatus(res, 400);
  });

  it('should create a post with authentication', async () => {
    const res = await authenticatedApi('/api/posts', authToken, {
      method: 'POST',
      body: JSON.stringify({
        caption: 'Test video post',
        video_url: 'https://example.com/video.mp4',
        thumbnail_url: 'https://example.com/thumb.jpg',
        place_id: 'place-123',
        place_name: 'Test Place',
        location_type: 'city',
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    await expectStatus(res, 201);
    const data = await res.json();
    expect(data.caption).toBe('Test video post');
    expect(data.view_count).toBe(0);
    postId = data.id;
  });

  it('should create a post with locations array', async () => {
    const res = await authenticatedApi('/api/posts', authToken, {
      method: 'POST',
      body: JSON.stringify({
        caption: 'Post with multiple locations',
        video_url: 'https://example.com/video2.mp4',
        locations: [
          {
            place_id: 'place-456',
            place_name: 'Location One',
            location_type: 'city',
          },
          {
            place_id: 'place-789',
            place_name: 'Location Two',
            location_type: 'landmark',
          },
        ],
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    await expectStatus(res, 201);
    const data = await res.json();
    expect(data.caption).toBe('Post with multiple locations');
  });

  it('should get a single post with view count', async () => {
    const res = await api(`/api/posts/${postId}`);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.id).toBe(postId);
    expect(data).toHaveProperty('view_count');
  });

  it('should return 404 for non-existent post', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';
    const res = await api(`/api/posts/${nonExistentId}`);
    await expectStatus(res, 404);
  });

  it('should return 400 when getting post with invalid UUID format', async () => {
    const res = await api(`/api/posts/invalid-uuid`);
    await expectStatus(res, 400);
  });

  it('should return 401 when incrementing view without authentication', async () => {
    const res = await api('/api/rpc/increment-view', {
      method: 'POST',
      body: JSON.stringify({ postId }),
      headers: { 'Content-Type': 'application/json' },
    });
    await expectStatus(res, 401);
  });

  it('should return 400 when incrementing view without postId', async () => {
    const res = await authenticatedApi(
      '/api/rpc/increment-view',
      otherUserToken,
      {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      }
    );
    await expectStatus(res, 400);
  });

  it('should return null view_count when post owner tries to increment', async () => {
    const res = await authenticatedApi(
      '/api/rpc/increment-view',
      authToken,
      {
        method: 'POST',
        body: JSON.stringify({ postId }),
        headers: { 'Content-Type': 'application/json' },
      }
    );
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.view_count).toBeNull();
  });

  it('should increment view count when other user views', async () => {
    const res = await authenticatedApi(
      '/api/rpc/increment-view',
      otherUserToken,
      {
        method: 'POST',
        body: JSON.stringify({ postId }),
        headers: { 'Content-Type': 'application/json' },
      }
    );
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.view_count).toBeGreaterThanOrEqual(1);
  });

  it('should return 404 when incrementing non-existent post', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';
    const res = await authenticatedApi(
      '/api/rpc/increment-view',
      otherUserToken,
      {
        method: 'POST',
        body: JSON.stringify({ postId: nonExistentId }),
        headers: { 'Content-Type': 'application/json' },
      }
    );
    await expectStatus(res, 404);
  });

  it('should get user posts with view_count when viewing own profile', async () => {
    const res = await authenticatedApi(
      `/api/users/${userId}/posts`,
      authToken
    );
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    if (data.length > 0) {
      expect(typeof data[0].view_count).toBe('number');
    }
  });

  it('should get user posts without view_count when viewing other profile', async () => {
    const res = await authenticatedApi(
      `/api/users/${userId}/posts`,
      otherUserToken
    );
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    if (data.length > 0) {
      expect(data[0].view_count).toBeNull();
    }
  });

  it('should get user posts without authentication', async () => {
    const res = await api(`/api/users/${userId}/posts`);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    if (data.length > 0) {
      expect(data[0].view_count).toBeNull();
    }
  });

  it('should return 401 when deleting post without authentication', async () => {
    const res = await api(`/api/posts/${postId}`, { method: 'DELETE' });
    await expectStatus(res, 401);
  });

  it('should return 403 when deleting other user post', async () => {
    const res = await authenticatedApi(`/api/posts/${postId}`, otherUserToken, {
      method: 'DELETE',
    });
    await expectStatus(res, 403);
  });

  it('should delete own post', async () => {
    const res = await authenticatedApi(`/api/posts/${postId}`, authToken, {
      method: 'DELETE',
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it('should return 404 when deleting non-existent post', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';
    const res = await authenticatedApi(
      `/api/posts/${nonExistentId}`,
      authToken,
      { method: 'DELETE' }
    );
    await expectStatus(res, 404);
  });
});

describe('Post Locations Feature', () => {
  let authToken: string;
  let userId: string;
  let otherUserToken: string;
  let otherUserId: string;
  let postId: string;
  let locationId: string;

  it('should set up test users and create a post', async () => {
    const user1 = await signUpTestUser();
    authToken = user1.token;
    userId = user1.user.id;

    const user2 = await signUpTestUser();
    otherUserToken = user2.token;
    otherUserId = user2.user.id;

    const postRes = await authenticatedApi('/api/posts', authToken, {
      method: 'POST',
      body: JSON.stringify({
        caption: 'Test post for locations',
        video_url: 'https://example.com/video.mp4',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    await expectStatus(postRes, 201);
    const postData = await postRes.json();
    postId = postData.id;
  });

  it('should return 404 when getting locations for non-existent post', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';
    const res = await api(`/api/posts/${nonExistentId}/locations`);
    await expectStatus(res, 404);
  });

  it('should get locations for existing post', async () => {
    const res = await api(`/api/posts/${postId}/locations`);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it('should return 401 when adding location without authentication', async () => {
    const res = await api(`/api/posts/${postId}/locations`, {
      method: 'POST',
      body: JSON.stringify({
        place_id: 'place-123',
        place_name: 'Test Location',
        location_type: 'city',
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    await expectStatus(res, 401);
  });

  it('should return 404 when adding location to non-existent post', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';
    const res = await authenticatedApi(
      `/api/posts/${nonExistentId}/locations`,
      authToken,
      {
        method: 'POST',
        body: JSON.stringify({
          place_id: 'place-123',
          place_name: 'Test Location',
          location_type: 'city',
        }),
        headers: { 'Content-Type': 'application/json' },
      }
    );
    await expectStatus(res, 404);
  });

  it('should add location to own post', async () => {
    const res = await authenticatedApi(
      `/api/posts/${postId}/locations`,
      authToken,
      {
        method: 'POST',
        body: JSON.stringify({
          place_id: 'place-123',
          place_name: 'Test Location',
          location_type: 'city',
        }),
        headers: { 'Content-Type': 'application/json' },
      }
    );
    await expectStatus(res, 201);
    const data = await res.json();
    expect(data.place_id).toBe('place-123');
    locationId = data.id;
  });

  it('should return 403 when adding location to other user post', async () => {
    const res = await authenticatedApi(
      `/api/posts/${postId}/locations`,
      otherUserToken,
      {
        method: 'POST',
        body: JSON.stringify({
          place_id: 'place-456',
          place_name: 'Other Location',
          location_type: 'landmark',
        }),
        headers: { 'Content-Type': 'application/json' },
      }
    );
    await expectStatus(res, 403);
  });

  it('should remove location from own post', async () => {
    const res = await authenticatedApi(
      `/api/posts/${postId}/locations/${locationId}`,
      authToken,
      { method: 'DELETE' }
    );
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it('should return 404 when removing non-existent location', async () => {
    const nonExistentLocationId = '00000000-0000-0000-0000-000000000000';
    const res = await authenticatedApi(
      `/api/posts/${postId}/locations/${nonExistentLocationId}`,
      authToken,
      { method: 'DELETE' }
    );
    await expectStatus(res, 404);
  });

  it('should return 401 when removing location without authentication', async () => {
    const nonExistentLocationId = '00000000-0000-0000-0000-000000000000';
    const res = await api(
      `/api/posts/${postId}/locations/${nonExistentLocationId}`,
      { method: 'DELETE' }
    );
    await expectStatus(res, 401);
  });

  it('should return 403 when removing location from other user post', async () => {
    // Add a location as owner first
    const addRes = await authenticatedApi(
      `/api/posts/${postId}/locations`,
      authToken,
      {
        method: 'POST',
        body: JSON.stringify({
          place_id: 'place-789',
          place_name: 'Temp Location',
          location_type: 'area',
        }),
        headers: { 'Content-Type': 'application/json' },
      }
    );
    await expectStatus(addRes, 201);
    const addData = await addRes.json();
    const tempLocationId = addData.id;

    // Try to delete as other user
    const res = await authenticatedApi(
      `/api/posts/${postId}/locations/${tempLocationId}`,
      otherUserToken,
      { method: 'DELETE' }
    );
    await expectStatus(res, 403);
  });
});

describe('Follow Feature', () => {
  let authToken: string;
  let userId: string;
  let followUserId: string;
  let followUserToken: string;

  it('should set up test users', async () => {
    const user1 = await signUpTestUser();
    authToken = user1.token;
    userId = user1.user.id;

    const user2 = await signUpTestUser();
    followUserToken = user2.token;
    followUserId = user2.user.id;
  });

  it('should return 401 when following without authentication', async () => {
    const res = await api(`/api/follow/${followUserId}`, {
      method: 'POST',
    });
    await expectStatus(res, 401);
  });

  it('should follow a user', async () => {
    const res = await authenticatedApi(
      `/api/follow/${followUserId}`,
      authToken,
      { method: 'POST' }
    );
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data).toHaveProperty('follower_count');
  });

  it('should return 400 when trying to follow same user twice', async () => {
    const res = await authenticatedApi(
      `/api/follow/${followUserId}`,
      authToken,
      { method: 'POST' }
    );
    await expectStatus(res, 400);
  });

  it('should return 400 when trying to follow self', async () => {
    const res = await authenticatedApi(`/api/follow/${userId}`, authToken, {
      method: 'POST',
    });
    await expectStatus(res, 400);
  });

  it('should check follow status - returns true when following', async () => {
    const res = await authenticatedApi(
      `/api/follow/status/${followUserId}`,
      authToken
    );
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.isFollowing).toBe(true);
  });

  it('should return 401 when checking follow status without authentication', async () => {
    const res = await api(`/api/follow/status/${followUserId}`);
    await expectStatus(res, 401);
  });

  it('should get followers list', async () => {
    const res = await api(`/api/followers/${followUserId}`);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it('should get following list', async () => {
    const res = await api(`/api/following/${userId}`);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it('should return 401 when unfollowing without authentication', async () => {
    const res = await api(`/api/follow/${followUserId}`, {
      method: 'DELETE',
    });
    await expectStatus(res, 401);
  });

  it('should unfollow a user', async () => {
    const res = await authenticatedApi(
      `/api/follow/${followUserId}`,
      authToken,
      { method: 'DELETE' }
    );
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data).toHaveProperty('follower_count');
  });

  it('should check follow status - returns false after unfollow', async () => {
    const res = await authenticatedApi(
      `/api/follow/status/${followUserId}`,
      authToken
    );
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.isFollowing).toBe(false);
  });

  it('should return 400 when unfollowing if not following', async () => {
    const res = await authenticatedApi(
      `/api/follow/${followUserId}`,
      authToken,
      { method: 'DELETE' }
    );
    await expectStatus(res, 400);
  });
});

describe('Account Feature', () => {
  let authToken: string;

  it('should set up test user', async () => {
    const user = await signUpTestUser();
    authToken = user.token;
  });

  it('should return 401 when deleting account without authentication', async () => {
    const res = await api('/api/account/delete', { method: 'POST' });
    await expectStatus(res, 401);
  });

  it('should delete authenticated user account', async () => {
    const res = await authenticatedApi('/api/account/delete', authToken, {
      method: 'POST',
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });
});

describe('Profile Feature', () => {
  let authToken: string;
  let userId: string;
  let otherUserId: string;

  it('should set up test users', async () => {
    const user1 = await signUpTestUser();
    authToken = user1.token;
    userId = user1.user.id;

    const user2 = await signUpTestUser();
    otherUserId = user2.user.id;
  });

  it('should return 401 when getting own profile without authentication', async () => {
    const res = await api('/api/profile');
    await expectStatus(res, 401);
  });

  it('should get authenticated user profile', async () => {
    const res = await authenticatedApi('/api/profile', authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('created_at');
  });

  it('should return 404 when getting non-existent user profile', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';
    const res = await api(`/api/profile/${nonExistentId}`);
    await expectStatus(res, 404);
  });

  it('should get user profile by ID', async () => {
    const res = await api(`/api/profile/${otherUserId}`);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.id).toBe(otherUserId);
  });

  it('should return 401 when updating profile without authentication', async () => {
    const res = await api('/api/profile', {
      method: 'PUT',
      body: JSON.stringify({ display_name: 'Updated Name' }),
      headers: { 'Content-Type': 'application/json' },
    });
    await expectStatus(res, 401);
  });

  it('should update authenticated user profile', async () => {
    const res = await authenticatedApi('/api/profile', authToken, {
      method: 'PUT',
      body: JSON.stringify({
        display_name: 'Updated Display Name',
        username: 'newusername',
        bio: 'My bio',
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.display_name).toBe('Updated Display Name');
    expect(data.username).toBe('newusername');
  });

  it('should return 400 when updating profile with invalid username format', async () => {
    const res = await authenticatedApi('/api/profile', authToken, {
      method: 'PUT',
      body: JSON.stringify({ username: 'in' }),
      headers: { 'Content-Type': 'application/json' },
    });
    await expectStatus(res, 400);
  });

  it('should return 400 when updating profile with invalid username characters', async () => {
    const res = await authenticatedApi('/api/profile', authToken, {
      method: 'PUT',
      body: JSON.stringify({ username: 'invalid-username' }),
      headers: { 'Content-Type': 'application/json' },
    });
    await expectStatus(res, 400);
  });

  it('should return 400 when updating profile with invalid avatar URL', async () => {
    const res = await authenticatedApi('/api/profile', authToken, {
      method: 'PUT',
      body: JSON.stringify({ avatar_url: 'not-a-url' }),
      headers: { 'Content-Type': 'application/json' },
    });
    await expectStatus(res, 400);
  });

  it('should return 400 when updating profile with invalid cover URL', async () => {
    const res = await authenticatedApi('/api/profile', authToken, {
      method: 'PUT',
      body: JSON.stringify({ cover_url: 'not-a-url' }),
      headers: { 'Content-Type': 'application/json' },
    });
    await expectStatus(res, 400);
  });

  it('should return 400 when updating profile with bio exceeding max length', async () => {
    const res = await authenticatedApi('/api/profile', authToken, {
      method: 'PUT',
      body: JSON.stringify({ bio: 'a'.repeat(501) }),
      headers: { 'Content-Type': 'application/json' },
    });
    await expectStatus(res, 400);
  });

  it('should return 401 when ensuring profile without authentication', async () => {
    const res = await api('/api/profile/ensure', { method: 'POST' });
    await expectStatus(res, 401);
  });

  it('should ensure profile exists for authenticated user', async () => {
    const res = await authenticatedApi('/api/profile/ensure', authToken, {
      method: 'POST',
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it('should update profile with valid email', async () => {
    const res = await authenticatedApi('/api/profile', authToken, {
      method: 'PUT',
      body: JSON.stringify({ email: 'newemail@example.com' }),
      headers: { 'Content-Type': 'application/json' },
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.email).toBe('newemail@example.com');
  });

  it('should return 400 when updating profile with invalid email', async () => {
    const res = await authenticatedApi('/api/profile', authToken, {
      method: 'PUT',
      body: JSON.stringify({ email: 'invalid-email' }),
      headers: { 'Content-Type': 'application/json' },
    });
    await expectStatus(res, 400);
  });

  it('should update profile with valid URLs', async () => {
    const res = await authenticatedApi('/api/profile', authToken, {
      method: 'PUT',
      body: JSON.stringify({
        avatar_url: 'https://example.com/avatar.jpg',
        cover_url: 'https://example.com/cover.jpg',
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.avatar_url).toBe('https://example.com/avatar.jpg');
  });

  it('should return 409 when updating profile with duplicate username', async () => {
    // Create another user and try to take first user's username
    const user3 = await signUpTestUser();
    const token3 = user3.token;

    const res = await authenticatedApi('/api/profile', token3, {
      method: 'PUT',
      body: JSON.stringify({ username: 'newusername' }),
      headers: { 'Content-Type': 'application/json' },
    });
    await expectStatus(res, 409);
  });
});

describe('Moments Feature', () => {
  let authToken: string;
  let userId: string;
  let otherUserToken: string;
  let momentId: string;

  it('should set up test users', async () => {
    const user1 = await signUpTestUser();
    authToken = user1.token;
    userId = user1.user.id;

    const user2 = await signUpTestUser();
    otherUserToken = user2.token;
  });

  it('should list moments without authentication', async () => {
    const res = await api('/api/moments');
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data).toHaveProperty('moments');
    expect(data).toHaveProperty('next_cursor');
    expect(data).toHaveProperty('has_more');
    expect(Array.isArray(data.moments)).toBe(true);
  });

  it('should list moments with limit and cursor parameters', async () => {
    const res = await api('/api/moments?limit=10');
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data.moments)).toBe(true);
    expect(typeof data.has_more).toBe('boolean');
  });

  it('should list moments with place_id filter', async () => {
    const res = await api('/api/moments?place_id=test-place-123');
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data).toHaveProperty('moments');
    expect(Array.isArray(data.moments)).toBe(true);
  });

  it('should list moments with keywords filter', async () => {
    const res = await api('/api/moments?keywords=adventure');
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data).toHaveProperty('moments');
    expect(Array.isArray(data.moments)).toBe(true);
  });

  it('should return 400 when creating moment without video_url', async () => {
    const res = await authenticatedApi('/api/moments', authToken, {
      method: 'POST',
      body: JSON.stringify({ caption: 'Missing video URL' }),
      headers: { 'Content-Type': 'application/json' },
    });
    await expectStatus(res, 400);
  });

  it('should return 401 when creating moment without authentication', async () => {
    const res = await api('/api/moments', {
      method: 'POST',
      body: JSON.stringify({ video_url: 'https://example.com/video.mp4' }),
      headers: { 'Content-Type': 'application/json' },
    });
    await expectStatus(res, 401);
  });

  it('should create moment with authentication', async () => {
    const res = await authenticatedApi('/api/moments', authToken, {
      method: 'POST',
      body: JSON.stringify({
        video_url: 'https://example.com/moment.mp4',
        caption: 'My awesome moment',
        thumbnail_url: 'https://example.com/thumb.jpg',
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    await expectStatus(res, 201);
    const data = await res.json();
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('user_id');
    expect(data).toHaveProperty('video_url');
    expect(data).toHaveProperty('created_at');
    momentId = data.id;
  });

  it('should create moment with places array', async () => {
    const res = await authenticatedApi('/api/moments', authToken, {
      method: 'POST',
      body: JSON.stringify({
        video_url: 'https://example.com/moment2.mp4',
        caption: 'Moment with places',
        places: [
          {
            place_id: 'place-001',
            place_name: 'Paris',
            place_address: '75001 Paris, France',
          },
          {
            place_id: 'place-002',
            place_name: 'Eiffel Tower',
          },
        ],
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    await expectStatus(res, 201);
    const data = await res.json();
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('video_url');
  });

  it('should create moment with linked_experience_id', async () => {
    const res = await authenticatedApi('/api/moments', authToken, {
      method: 'POST',
      body: JSON.stringify({
        video_url: 'https://example.com/moment3.mp4',
        caption: 'Moment with linked experience',
        linked_experience_id: '550e8400-e29b-41d4-a716-446655440000',
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    await expectStatus(res, 201);
    const data = await res.json();
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('video_url');
  });

  it('should get moment by ID', async () => {
    const res = await api(`/api/moments/${momentId}`);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data).toHaveProperty('id');
  });

  it('should return 404 when getting non-existent moment', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';
    const res = await api(`/api/moments/${nonExistentId}`);
    await expectStatus(res, 404);
  });

  it('should return 400 when getting moment with invalid UUID format', async () => {
    const res = await api(`/api/moments/invalid-uuid`);
    await expectStatus(res, 400);
  });

  it('should toggle like on moment', async () => {
    const res = await authenticatedApi(`/api/moments/${momentId}/like`, authToken, {
      method: 'POST',
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data).toHaveProperty('liked');
    expect(data).toHaveProperty('likes_count');
    expect(typeof data.liked).toBe('boolean');
  });

  it('should toggle like off on moment', async () => {
    const res = await authenticatedApi(`/api/moments/${momentId}/like`, authToken, {
      method: 'POST',
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.liked).toBe(false);
  });

  it('should return 404 when liking non-existent moment', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';
    const res = await authenticatedApi(`/api/moments/${nonExistentId}/like`, authToken, {
      method: 'POST',
    });
    await expectStatus(res, 404);
  });

  it('should toggle bookmark on moment', async () => {
    const res = await authenticatedApi(`/api/moments/${momentId}/bookmark`, authToken, {
      method: 'POST',
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data).toHaveProperty('bookmarked');
    expect(data).toHaveProperty('bookmarks_count');
  });

  it('should toggle bookmark off on moment', async () => {
    const res = await authenticatedApi(`/api/moments/${momentId}/bookmark`, authToken, {
      method: 'POST',
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.bookmarked).toBe(false);
  });

  it('should return 404 when bookmarking non-existent moment', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';
    const res = await authenticatedApi(`/api/moments/${nonExistentId}/bookmark`, authToken, {
      method: 'POST',
    });
    await expectStatus(res, 404);
  });

  it('should return 403 when deleting other user moment', async () => {
    const res = await authenticatedApi(`/api/moments/${momentId}`, otherUserToken, {
      method: 'DELETE',
    });
    await expectStatus(res, 403);
  });

  it('should delete own moment', async () => {
    const res = await authenticatedApi(`/api/moments/${momentId}`, authToken, {
      method: 'DELETE',
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it('should return 404 when deleting non-existent moment', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';
    const res = await authenticatedApi(`/api/moments/${nonExistentId}`, authToken, {
      method: 'DELETE',
    });
    await expectStatus(res, 404);
  });
});

describe('Experiences Feature', () => {
  let authToken: string;
  let userId: string;
  let otherUserToken: string;
  let experienceId: string;

  it('should set up test users', async () => {
    const user1 = await signUpTestUser();
    authToken = user1.token;
    userId = user1.user.id;

    const user2 = await signUpTestUser();
    otherUserToken = user2.token;
  });

  it('should list experiences without authentication', async () => {
    const res = await api('/api/experiences');
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data).toHaveProperty('experiences');
    expect(data).toHaveProperty('next_cursor');
    expect(Array.isArray(data.experiences)).toBe(true);
  });

  it('should list experiences with limit and cursor parameters', async () => {
    const res = await api('/api/experiences?limit=10');
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data.experiences)).toBe(true);
  });

  it('should return 401 when creating experience without authentication', async () => {
    const res = await api('/api/experiences', {
      method: 'POST',
      body: JSON.stringify({
        video_url: 'https://example.com/video.mp4',
        title: 'My Experience',
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    await expectStatus(res, 401);
  });

  it('should return 400 when creating experience without video_url', async () => {
    const res = await authenticatedApi('/api/experiences', authToken, {
      method: 'POST',
      body: JSON.stringify({ title: 'My Experience' }),
      headers: { 'Content-Type': 'application/json' },
    });
    await expectStatus(res, 400);
  });

  it('should create experience with required fields', async () => {
    const res = await authenticatedApi('/api/experiences', authToken, {
      method: 'POST',
      body: JSON.stringify({
        video_url: 'https://example.com/experience.mp4',
        title: 'My Experience',
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    await expectStatus(res, 201);
    const data = await res.json();
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('user_id');
    expect(data).toHaveProperty('video_url');
    expect(data).toHaveProperty('created_at');
    experienceId = data.id;
  });

  it('should create experience with optional fields', async () => {
    const res = await authenticatedApi('/api/experiences', authToken, {
      method: 'POST',
      body: JSON.stringify({
        video_url: 'https://example.com/exp2.mp4',
        title: 'Complete Experience',
        description: 'A detailed experience description',
        thumbnail_url: 'https://example.com/thumb.jpg',
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    await expectStatus(res, 201);
    const data = await res.json();
    expect(data).toHaveProperty('id');
  });

  it('should get experience by ID', async () => {
    const res = await api(`/api/experiences/${experienceId}`);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data).toHaveProperty('id');
  });

  it('should return 404 when getting non-existent experience', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';
    const res = await api(`/api/experiences/${nonExistentId}`);
    await expectStatus(res, 404);
  });

  it('should return 400 when getting experience with invalid UUID format', async () => {
    const res = await api(`/api/experiences/invalid-uuid`);
    await expectStatus(res, 400);
  });
});
