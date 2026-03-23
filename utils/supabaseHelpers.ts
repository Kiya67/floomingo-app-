
import { supabase } from '@/lib/supabase';
import * as FileSystem from 'expo-file-system';

/**
 * Upload a file to Supabase Storage
 * @param uri - Local file URI
 * @param path - Storage path (e.g., 'videos/user-id/timestamp.mp4')
 * @param bucket - Storage bucket name (e.g., 'video_public')
 * @param contentType - MIME type (e.g., 'video/mp4', 'image/jpeg')
 * @returns Object with path and publicUrl
 */
export async function uploadFileToSupabase(
  uri: string,
  path: string,
  bucket: string,
  contentType: string
): Promise<{ path: string; publicUrl: string }> {
  try {
    console.log(`[uploadFileToSupabase] Starting upload to ${bucket}/${path}`);
    console.log(`[uploadFileToSupabase] Source URI: ${uri}`);
    console.log(`[uploadFileToSupabase] Content-Type: ${contentType}`);

    // Step 1: Verify file exists
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) {
      throw new Error(`File does not exist at URI: ${uri}`);
    }
    console.log(`[uploadFileToSupabase] File exists, size: ${fileInfo.size} bytes`);

    // Step 2: Read file as base64
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64' as any,
    });
    console.log(`[uploadFileToSupabase] File read as base64, length: ${base64.length}`);

    // Step 3: Convert base64 to ArrayBuffer (more reliable than Blob for large files)
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    console.log(`[uploadFileToSupabase] Converted to ArrayBuffer, size: ${bytes.length} bytes`);

    // Step 4: Upload to Supabase Storage
    console.log(`[uploadFileToSupabase] Uploading to Supabase...`);
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, bytes.buffer, {
        contentType,
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error(`[uploadFileToSupabase] Upload error:`, error);
      throw error;
    }

    console.log(`[uploadFileToSupabase] Upload successful:`, data);

    // Step 5: Get public URL
    const { data: publicUrlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(path);

    if (!publicUrlData?.publicUrl) {
      throw new Error('Failed to get public URL');
    }

    console.log(`[uploadFileToSupabase] ✅ SUCCESS - Public URL: ${publicUrlData.publicUrl}`);

    return {
      path: data.path,
      publicUrl: publicUrlData.publicUrl,
    };
  } catch (error: any) {
    console.error(`[uploadFileToSupabase] ❌ FAILED:`, error);
    throw new Error(`Upload failed: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Get follow status between current user and target user
 */
export async function getIsFollowing(targetUserId: string): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', user.id)
      .eq('following_id', targetUserId)
      .maybeSingle();

    if (error) {
      console.error('Error checking follow status:', error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error('Error in getIsFollowing:', error);
    return false;
  }
}

/**
 * Get follower and following counts for a user
 */
export async function getFollowCounts(userId: string): Promise<{ followerCount: number; followingCount: number }> {
  try {
    const [followersResult, followingResult] = await Promise.all([
      supabase
        .from('follows')
        .select('id', { count: 'exact', head: true })
        .eq('following_id', userId),
      supabase
        .from('follows')
        .select('id', { count: 'exact', head: true })
        .eq('follower_id', userId),
    ]);

    return {
      followerCount: followersResult.count || 0,
      followingCount: followingResult.count || 0,
    };
  } catch (error) {
    console.error('Error getting follow counts:', error);
    return { followerCount: 0, followingCount: 0 };
  }
}

/**
 * Follow a user
 */
export async function followUser(targetUserId: string): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('follows')
      .insert({
        follower_id: user.id,
        following_id: targetUserId,
      });

    if (error) throw error;
  } catch (error) {
    console.error('Error following user:', error);
    throw error;
  }
}

/**
 * Unfollow a user
 */
export async function unfollowUser(targetUserId: string): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', user.id)
      .eq('following_id', targetUserId);

    if (error) throw error;
  } catch (error) {
    console.error('Error unfollowing user:', error);
    throw error;
  }
}
