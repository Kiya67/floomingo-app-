
import Constants from "expo-constants";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { BEARER_TOKEN_KEY } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

/**
 * Backend URL is configured in app.json under expo.extra.backendUrl
 * It is set automatically when the backend is deployed
 */
export const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl || "";

// Log resolved backend URL once at module load so it's visible in every build's logs
console.log('[API] BACKEND_URL resolved to:', BACKEND_URL || '⚠️ MISSING — backend calls will fail');

/**
 * Check if backend is properly configured
 */
export const isBackendConfigured = (): boolean => {
  return !!BACKEND_URL && BACKEND_URL.length > 0;
};

/**
 * Get the best available auth token for backend API calls.
 * Prefers the Better Auth bearer token stored in SecureStore.
 * Falls back to the Supabase session access_token if Better Auth token is absent.
 *
 * @returns Bearer token string or null if no auth is available
 */
export const getBearerToken = async (): Promise<string | null> => {
  try {
    // 1. Try Better Auth token from SecureStore first
    const betterAuthToken = await SecureStore.getItemAsync(BEARER_TOKEN_KEY);
    if (betterAuthToken && betterAuthToken.length > 0) {
      console.log('Using Better Auth token');
      return betterAuthToken;
    }

    // 2. Fall back to Supabase session token
    console.log('[API] Better Auth token not found, falling back to Supabase session');
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      console.error('[API] Error getting Supabase session:', error);
      return null;
    }

    if (!session) {
      console.warn('[API] No active Supabase session found');
      return null;
    }

    if (!session.access_token) {
      console.error('[API] Session exists but no access_token found');
      return null;
    }

    console.log('Using Supabase token (fallback)');
    console.log('[API] Token expires at:', new Date(session.expires_at! * 1000).toISOString());
    console.log('[API] User ID from session:', session.user?.id);

    return session.access_token;
  } catch (error) {
    console.error('[API] Error retrieving bearer token:', error);
    return null;
  }
};

/**
 * @deprecated Use getBearerToken() instead.
 */
export const getSupabaseAccessToken = getBearerToken;

/**
 * Generic API call helper with Supabase auth token
 * CRITICAL: Uses Supabase access_token for authentication
 *
 * @param endpoint - API endpoint path (e.g., '/users', '/auth/login')
 * @param options - Fetch options (method, headers, body, etc.)
 * @returns Parsed JSON response
 * @throws Error if backend is not configured or request fails
 */
export const apiCall = async <T = any>(
  endpoint: string,
  options?: RequestInit
): Promise<T> => {
  if (!isBackendConfigured()) {
    const error = "Backend URL not configured. Please rebuild the app.";
    console.error("[API]", error);
    throw new Error(error);
  }

  const url = `${BACKEND_URL}${endpoint}`;
  const method = options?.method || "GET";
  console.log(`[API] ${method} ${url}`);

  try {
    const fetchOptions: RequestInit = {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    };

    // CRITICAL: Always get fresh bearer token (prefers Better Auth, falls back to Supabase)
    const token = await getBearerToken();
    if (token) {
      fetchOptions.headers = {
        ...fetchOptions.headers,
        Authorization: `Bearer ${token}`,
      };
      console.log('[API] ✓ Authorization header added with bearer token');
    } else {
      console.warn('[API] ⚠️ No bearer token available - request may fail if endpoint requires auth');
    }

    console.log("[API] Request headers:", JSON.stringify(fetchOptions.headers, null, 2));

    const response = await fetch(url, fetchOptions);

    console.log(`[API] Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const text = await response.text();
      console.error(`[API] ❌ Error response (${response.status}):`, text);
      
      if (response.status === 401) {
        console.error('[API] 401 Unauthorized - Possible causes:');
        console.error('  1. Supabase session expired or invalid');
        console.error('  2. Backend not configured to validate Supabase JWT tokens');
        console.error('  3. Missing or incorrect SUPABASE_JWT_SECRET on backend');
      } else if (response.status === 404) {
        console.error('[API] 404 Not Found - Resource does not exist or endpoint not configured');
      }
      
      throw new Error(`API error: ${response.status} - ${text}`);
    }

    const data = await response.json();
    console.log("[API] ✓ Success:", data);
    return data;
  } catch (error) {
    console.error("[API] ❌ Request failed:", error);
    throw error;
  }
};

/**
 * GET request helper
 */
export const apiGet = async <T = any>(endpoint: string): Promise<T> => {
  return apiCall<T>(endpoint, { method: "GET" });
};

/**
 * POST request helper
 */
export const apiPost = async <T = any>(
  endpoint: string,
  data: any
): Promise<T> => {
  return apiCall<T>(endpoint, {
    method: "POST",
    body: JSON.stringify(data),
  });
};

/**
 * PUT request helper
 */
export const apiPut = async <T = any>(
  endpoint: string,
  data: any
): Promise<T> => {
  return apiCall<T>(endpoint, {
    method: "PUT",
    body: JSON.stringify(data),
  });
};

/**
 * PATCH request helper
 */
export const apiPatch = async <T = any>(
  endpoint: string,
  data: any
): Promise<T> => {
  return apiCall<T>(endpoint, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
};

/**
 * DELETE request helper
 * Always sends a body to avoid FST_ERR_CTP_EMPTY_JSON_BODY errors
 */
export const apiDelete = async <T = any>(endpoint: string, data: any = {}): Promise<T> => {
  return apiCall<T>(endpoint, {
    method: "DELETE",
    body: JSON.stringify(data),
  });
};

/**
 * Authenticated API call helper
 * CRITICAL: Requires Supabase access token, redirects to login if missing
 *
 * @param endpoint - API endpoint path
 * @param options - Fetch options (method, headers, body, etc.)
 * @returns Parsed JSON response
 * @throws Error if token not found or request fails
 */
export const authenticatedApiCall = async <T = any>(
  endpoint: string,
  options?: RequestInit
): Promise<T> => {
  const token = await getBearerToken();

  if (!token) {
    console.error('[API] Authentication token not found. User must sign in.');
    throw new Error("Authentication token not found. Please sign in.");
  }

  return apiCall<T>(endpoint, {
    ...options,
    headers: {
      ...options?.headers,
      Authorization: `Bearer ${token}`,
    },
  });
};

/**
 * Authenticated GET request
 */
export const authenticatedGet = async <T = any>(endpoint: string): Promise<T> => {
  return authenticatedApiCall<T>(endpoint, { method: "GET" });
};

/**
 * Authenticated POST request
 */
export const authenticatedPost = async <T = any>(
  endpoint: string,
  data: any
): Promise<T> => {
  return authenticatedApiCall<T>(endpoint, {
    method: "POST",
    body: JSON.stringify(data),
  });
};

/**
 * Authenticated PUT request
 */
export const authenticatedPut = async <T = any>(
  endpoint: string,
  data: any
): Promise<T> => {
  return authenticatedApiCall<T>(endpoint, {
    method: "PUT",
    body: JSON.stringify(data),
  });
};

/**
 * Authenticated PATCH request
 */
export const authenticatedPatch = async <T = any>(
  endpoint: string,
  data: any
): Promise<T> => {
  return authenticatedApiCall<T>(endpoint, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
};

/**
 * Authenticated DELETE request
 * Always sends a body to avoid FST_ERR_CTP_EMPTY_JSON_BODY errors
 */
export const authenticatedDelete = async <T = any>(endpoint: string, data: any = {}): Promise<T> => {
  return authenticatedApiCall<T>(endpoint, {
    method: "DELETE",
    body: JSON.stringify(data),
  });
};

// ============================================
// BOARDS API HELPERS
// ============================================

export interface Board {
  id: string;
  title: string;
  created_at: string;
}

export interface BoardVideo {
  board_id: string;
  post_id: string;
  post_caption: string;
  post_video_url: string;
  post_thumbnail_url: string | null;
  post_created_at: string;
  saved_at: string;
}

export interface SaveVideoResponse {
  success: boolean;
}

/**
 * Get all boards for the authenticated user
 */
export const getBoards = async (): Promise<Board[]> => {
  console.log('[API] Fetching boards');
  return authenticatedGet<Board[]>('/api/boards');
};

/**
 * Get videos for a specific board
 */
export const getBoardVideos = async (boardId: string): Promise<BoardVideo[]> => {
  console.log('[API] Fetching videos for board:', boardId);
  return authenticatedGet<BoardVideo[]>(`/api/boards/${boardId}/videos`);
};

/**
 * Create a new board
 */
export const createBoard = async (title: string): Promise<Board> => {
  console.log('[API] Creating board:', title);
  return authenticatedPost<Board>('/api/boards', { title });
};

/**
 * Save video to a board (VIDEO-ONLY, no places)
 * Uses Supabase client directly with active session
 * 
 * CRITICAL: board_posts.saved_by is uuid[] array
 * - Inserts must use arrays: saved_by = [userId]
 * - Queries must use .contains('saved_by', [userId])
 */
export const saveVideoOnly = async (
  boardId: string,
  postId: string
): Promise<SaveVideoResponse | { error: { code: number; message: string } }> => {
  console.log('[API] Saving video to board:', boardId, 'post:', postId);
  
  try {
    // Get active Supabase session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      console.error('[API] No active session found');
      throw new Error("Authentication token not found. Please sign in.");
    }

    console.log('[API] Active session found, user:', session.user.id);

    // Check if already saved by this user
    // CRITICAL: Use .contains() for uuid[] array query
    const { data: existingData } = await supabase
      .from('board_posts')
      .select('id')
      .eq('board_id', boardId)
      .eq('post_id', postId)
      .contains('saved_by', [session.user.id]) // ✅ CORRECT: Use .contains() for uuid[] array
      .limit(1);

    if (existingData && existingData.length > 0) {
      console.log('[API] Video already saved to this board by this user');
      return { error: { code: 409, message: 'Video already saved to this board' } };
    }

    // Check if board_post exists for this board+post combo
    const { data: boardPostData } = await supabase
      .from('board_posts')
      .select('id, saved_by')
      .eq('board_id', boardId)
      .eq('post_id', postId)
      .limit(1)
      .single();

    if (boardPostData) {
      // Board post exists, append user to saved_by array
      console.log('[API] Board post exists, appending user to saved_by array');
      const currentSavedBy = boardPostData.saved_by || [];
      const updatedSavedBy = [...currentSavedBy, session.user.id];

      const { error: updateError } = await supabase
        .from('board_posts')
        .update({ saved_by: updatedSavedBy }) // ✅ CORRECT: Update with array
        .eq('id', boardPostData.id);

      if (updateError) {
        console.error('[API] Supabase update error:', updateError);
        throw updateError;
      }

      console.log('[API] User added to saved_by array successfully');
      return { success: true };
    } else {
      // Board post doesn't exist, create new with saved_by array
      console.log('[API] Creating new board_post with saved_by array');
      const { data, error } = await supabase
        .from('board_posts')
        .insert({
          board_id: boardId,
          post_id: postId,
          saved_by: [session.user.id], // ✅ CORRECT: Insert as array
        })
        .select()
        .single();

      if (error) {
        console.error('[API] Supabase insert error:', error);
        throw error;
      }

      console.log('[API] Video saved successfully:', data);
      return { success: true };
    }
  } catch (error: any) {
    console.error('[API] Error saving video:', error);
    return { error: { code: 500, message: error.message || 'Failed to save video' } };
  }
};

// ============================================
// PROFILE STATS API HELPERS
// ============================================

export interface ProfileStats {
  user_id: string;
  post_count: number;
  follower_count: number;
  following_count: number;
  updated_at: string;
}

export interface RecalculateStatsResponse {
  success: boolean;
  post_count: number;
  follower_count: number;
  following_count: number;
}

/**
 * Get profile stats for a user
 * CRITICAL: Uses Supabase access token for auth
 */
export const getProfileStats = async (userId: string): Promise<ProfileStats> => {
  console.log('[API] Fetching profile stats for user:', userId);
  return apiGet<ProfileStats>(`/api/profile/stats/${userId}`);
};

/**
 * Recalculate profile stats for a user (internal endpoint)
 */
export const recalculateProfileStats = async (userId: string): Promise<RecalculateStatsResponse> => {
  console.log('[API] Recalculating profile stats for user:', userId);
  return apiPost<RecalculateStatsResponse>(`/api/profile/stats/recalculate/${userId}`, {});
};

// ============================================
// POSTS API HELPERS
// ============================================

export interface PostLocation {
  id: string;
  post_id: string;
  place_id: string;
  place_name: string;
  location_type: string;
  display_order: number;
  created_at: string;
}

export interface PostWithViewCount {
  id: string;
  user_id: string;
  video_url: string;
  thumbnail_url: string;
  caption: string;
  place_id: string | null;
  place_name: string | null;
  location_type: string | null;
  created_at: string;
  view_count?: number;
}

/**
 * Get posts for a user profile
 * Includes view_count only if viewing own profile
 * CRITICAL: Uses Supabase access token for auth
 */
export const getUserPosts = async (userId: string): Promise<PostWithViewCount[]> => {
  console.log('[API] Fetching posts for user:', userId);
  return apiGet<PostWithViewCount[]>(`/api/users/${userId}/posts`);
};

/**
 * Get all locations for a post
 */
export const getPostLocations = async (postId: string): Promise<PostLocation[]> => {
  console.log('[API] Fetching locations for post:', postId);
  return apiGet<PostLocation[]>(`/api/posts/${postId}/locations`);
};

/**
 * Add a location to a post
 * CRITICAL: Requires Supabase access token, user must own the post
 */
export const addPostLocation = async (
  postId: string,
  location: { place_id: string; place_name: string; location_type: string }
): Promise<PostLocation> => {
  console.log('[API] Adding location to post:', postId, location);
  return authenticatedPost<PostLocation>(`/api/posts/${postId}/locations`, location);
};

/**
 * Remove a location from a post
 * CRITICAL: Requires Supabase access token, user must own the post
 */
export const removePostLocation = async (postId: string, locationId: string): Promise<{ success: boolean }> => {
  console.log('[API] Removing location from post:', postId, 'location:', locationId);
  return authenticatedDelete<{ success: boolean }>(`/api/posts/${postId}/locations/${locationId}`);
};

/**
 * Increment view count for a post
 * Only increments if user is authenticated and not the post owner
 * CRITICAL: Requires Supabase access token
 */
export const incrementPostView = async (postId: string): Promise<{ view_count: number | null }> => {
  console.log('[API] Incrementing view count for post:', postId);
  return authenticatedPost<{ view_count: number | null }>('/api/rpc/increment-view', { post_id: postId });
};

// ============================================
// FOLLOW API HELPERS
// ============================================

export interface FollowResponse {
  success: boolean;
  follower_count: number;
}

export interface FollowStatusResponse {
  isFollowing: boolean;
}

export interface FollowerUser {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

/**
 * Follow a user
 * CRITICAL: Requires Supabase access token, uses auth.uid() on backend
 */
export const followUser = async (userId: string): Promise<FollowResponse> => {
  console.log('[API] Following user:', userId);
  return authenticatedPost<FollowResponse>(`/api/follow/${userId}`, {});
};

/**
 * Unfollow a user
 * CRITICAL: Requires Supabase access token, uses auth.uid() on backend
 */
export const unfollowUser = async (userId: string): Promise<FollowResponse> => {
  console.log('[API] Unfollowing user:', userId);
  return authenticatedDelete<FollowResponse>(`/api/follow/${userId}`, {});
};

/**
 * Check if authenticated user is following a user
 * CRITICAL: Requires Supabase access token, uses auth.uid() on backend
 */
export const getFollowStatus = async (userId: string): Promise<FollowStatusResponse> => {
  console.log('[API] Checking follow status for user:', userId);
  return authenticatedGet<FollowStatusResponse>(`/api/follow/status/${userId}`);
};

/**
 * Get list of followers for a user
 * CRITICAL: Uses Supabase access token for auth
 */
export const getFollowers = async (userId: string): Promise<FollowerUser[]> => {
  console.log('[API] Fetching followers for user:', userId);
  return apiGet<FollowerUser[]>(`/api/followers/${userId}`);
};

/**
 * Get list of users being followed by a user
 * CRITICAL: Uses Supabase access token for auth
 */
export const getFollowing = async (userId: string): Promise<FollowerUser[]> => {
  console.log('[API] Fetching following for user:', userId);
  return apiGet<FollowerUser[]>(`/api/following/${userId}`);
};

// ============================================
// ACCOUNT API HELPERS
// ============================================

export interface DeleteAccountResponse {
  success: boolean;
}

/**
 * Delete authenticated user account and all associated data
 * This is a DESTRUCTIVE operation - all data is permanently deleted
 * CRITICAL: Requires Supabase access token
 */
export const deleteAccount = async (): Promise<DeleteAccountResponse> => {
  console.log('[API] Deleting account');
  return authenticatedPost<DeleteAccountResponse>('/api/account/delete', {});
};
