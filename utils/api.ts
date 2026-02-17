import Constants from "expo-constants";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { BEARER_TOKEN_KEY } from "@/lib/auth";

/**
 * Backend URL is configured in app.json under expo.extra.backendUrl
 * It is set automatically when the backend is deployed
 */
export const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl || "";

/**
 * Check if backend is properly configured
 */
export const isBackendConfigured = (): boolean => {
  return !!BACKEND_URL && BACKEND_URL.length > 0;
};

/**
 * Get bearer token from platform-specific storage
 * Web: localStorage
 * Native: SecureStore
 *
 * @returns Bearer token or null if not found
 */
export const getBearerToken = async (): Promise<string | null> => {
  try {
    if (Platform.OS === "web") {
      return localStorage.getItem(BEARER_TOKEN_KEY);
    } else {
      return await SecureStore.getItemAsync(BEARER_TOKEN_KEY);
    }
  } catch (error) {
    console.error("[API] Error retrieving bearer token:", error);
    return null;
  }
};

/**
 * Generic API call helper with error handling
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
    throw new Error("Backend URL not configured. Please rebuild the app.");
  }

  const url = `${BACKEND_URL}${endpoint}`;
  console.log("[API] Calling:", url, options?.method || "GET");

  try {
    const fetchOptions: RequestInit = {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    };

    console.log("[API] Fetch options:", fetchOptions);

    // Always send the token if we have it (needed for cross-domain/iframe support)
    const token = await getBearerToken();
    if (token) {
      fetchOptions.headers = {
        ...fetchOptions.headers,
        Authorization: `Bearer ${token}`,
      };
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      const text = await response.text();
      console.error("[API] Error response:", response.status, text);
      throw new Error(`API error: ${response.status} - ${text}`);
    }

    const data = await response.json();
    console.log("[API] Success:", data);
    return data;
  } catch (error) {
    console.error("[API] Request failed:", error);
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
 * Automatically retrieves bearer token from storage and adds to Authorization header
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
  cover_url: string | null;
  created_at: string;
}

export interface BoardPlace {
  id: string;
  board_id: string;
  place_id: string;
  place_name: string;
  place_primary_type: string;
  place_address: string;
  post_id: string;
  created_at: string;
}

export interface SaveVideoResponse {
  board_posts_count: number;
  board_places_count: number;
}

/**
 * Get all boards for the authenticated user
 */
export const getBoards = async (): Promise<Board[]> => {
  console.log('[API] Fetching boards');
  return authenticatedGet<Board[]>('/api/boards');
};

/**
 * Get places for a specific board
 */
export const getBoardPlaces = async (boardId: string): Promise<BoardPlace[]> => {
  console.log('[API] Fetching places for board:', boardId);
  return authenticatedGet<BoardPlace[]>(`/api/boards/${boardId}/places`);
};

/**
 * Save video with location to a board
 */
export const saveVideoWithLocation = async (
  boardId: string,
  postId: string,
  placeId: string,
  placeName: string,
  placeAddress: string,
  placePrimaryType: string
): Promise<SaveVideoResponse | { error: { code: number; message: string } }> => {
  console.log('[API] Saving video with location to board:', boardId);
  try {
    return await authenticatedPost<SaveVideoResponse>(
      `/api/boards/${boardId}/save-video-with-location`,
      {
        post_id: postId,
        place_id: placeId,
        place_name: placeName,
        place_address: placeAddress,
        place_primary_type: placePrimaryType,
      }
    );
  } catch (error: any) {
    console.error('[API] Error saving video with location:', error);
    // Check if it's a 409 conflict (already saved)
    if (error.message?.includes('409')) {
      return { error: { code: 409, message: 'Video already saved to this board' } };
    }
    return { error: { code: 500, message: error.message || 'Failed to save video' } };
  }
};

/**
 * Save video only to a board
 */
export const saveVideoOnly = async (
  boardId: string,
  postId: string
): Promise<SaveVideoResponse | { error: { code: number; message: string } }> => {
  console.log('[API] Saving video only to board:', boardId);
  try {
    return await authenticatedPost<SaveVideoResponse>(
      `/api/boards/${boardId}/save-video`,
      {
        post_id: postId,
      }
    );
  } catch (error: any) {
    console.error('[API] Error saving video only:', error);
    // Check if it's a 409 conflict (already saved)
    if (error.message?.includes('409')) {
      return { error: { code: 409, message: 'Video already saved to this board' } };
    }
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
 */
export const getUserPosts = async (userId: string): Promise<PostWithViewCount[]> => {
  console.log('[API] Fetching posts for user:', userId);
  return apiGet<PostWithViewCount[]>(`/api/users/${userId}/posts`);
};

/**
 * Increment view count for a post
 * Only increments if user is authenticated and not the post owner
 */
export const incrementPostView = async (postId: string): Promise<{ view_count: number | null }> => {
  console.log('[API] Incrementing view count for post:', postId);
  return authenticatedPost<{ view_count: number | null }>('/api/rpc/increment-view', { postId });
};
