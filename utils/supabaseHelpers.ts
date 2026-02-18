
import { supabase } from '@/lib/supabase';

/**
 * Ensure user profile row exists in profiles table
 * Call this on app start and after login
 */
export async function ensureProfileRow() {
  console.log('[Supabase] Ensuring profile row exists');
  const { data: u } = await supabase.auth.getUser();
  const user = u.user;
  if (!user) throw new Error('Not signed in');
  
  // Create profile if missing
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: user.id }, { onConflict: 'id' });
  
  if (error) {
    console.error('[Supabase] Error ensuring profile row:', error);
    throw error;
  }
  
  console.log('[Supabase] Profile row ensured for user:', user.id);
  return user.id;
}

/**
 * Check if current user is following another user
 */
export async function getIsFollowing(myId: string, profileUserId: string) {
  console.log('[Supabase] Checking if following:', profileUserId);
  const { data, error } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('follower_id', myId)
    .eq('following_id', profileUserId)
    .maybeSingle();

  if (error) {
    console.error('[Supabase] Error checking follow status:', error);
    throw error;
  }
  
  const isFollowing = !!data;
  console.log('[Supabase] Is following:', isFollowing);
  return isFollowing;
}

/**
 * Get follower and following counts for a user
 */
export async function getFollowCounts(profileUserId: string) {
  console.log('[Supabase] Fetching follow counts for user:', profileUserId);
  const [{ count: followers, error: e1 }, { count: following, error: e2 }] = await Promise.all([
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', profileUserId),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', profileUserId),
  ]);

  if (e1) {
    console.error('[Supabase] Error fetching followers count:', e1);
    throw e1;
  }
  if (e2) {
    console.error('[Supabase] Error fetching following count:', e2);
    throw e2;
  }

  const counts = { followers: followers ?? 0, following: following ?? 0 };
  console.log('[Supabase] Follow counts:', counts);
  return counts;
}

/**
 * Follow a user
 */
export async function followUser(myId: string, profileUserId: string) {
  console.log('[Supabase] Following user:', profileUserId);
  const { error } = await supabase.from('follows').insert({
    follower_id: myId,
    following_id: profileUserId,
  });
  
  if (error) {
    console.error('[Supabase] Error following user:', error);
    throw error;
  }
  
  console.log('[Supabase] Successfully followed user:', profileUserId);
}

/**
 * Unfollow a user
 */
export async function unfollowUser(myId: string, profileUserId: string) {
  console.log('[Supabase] Unfollowing user:', profileUserId);
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', myId)
    .eq('following_id', profileUserId);
  
  if (error) {
    console.error('[Supabase] Error unfollowing user:', error);
    throw error;
  }
  
  console.log('[Supabase] Successfully unfollowed user:', profileUserId);
}

/**
 * Get list of followers for a user
 */
export async function getFollowers(profileUserId: string) {
  console.log('[Supabase] Fetching followers for user:', profileUserId);
  const { data, error } = await supabase
    .from('follows')
    .select(`
      follower_id,
      profiles!follows_follower_id_fkey (
        id,
        username,
        display_name,
        avatar_url
      )
    `)
    .eq('following_id', profileUserId);

  if (error) {
    console.error('[Supabase] Error fetching followers:', error);
    throw error;
  }

  // Transform data to flat structure
  const followers = (data || []).map((item: any) => ({
    id: item.profiles.id,
    username: item.profiles.username,
    display_name: item.profiles.display_name,
    avatar_url: item.profiles.avatar_url,
  }));

  console.log('[Supabase] Fetched followers:', followers.length);
  return followers;
}

/**
 * Get list of users being followed by a user
 */
export async function getFollowing(profileUserId: string) {
  console.log('[Supabase] Fetching following for user:', profileUserId);
  const { data, error } = await supabase
    .from('follows')
    .select(`
      following_id,
      profiles!follows_following_id_fkey (
        id,
        username,
        display_name,
        avatar_url
      )
    `)
    .eq('follower_id', profileUserId);

  if (error) {
    console.error('[Supabase] Error fetching following:', error);
    throw error;
  }

  // Transform data to flat structure
  const following = (data || []).map((item: any) => ({
    id: item.profiles.id,
    username: item.profiles.username,
    display_name: item.profiles.display_name,
    avatar_url: item.profiles.avatar_url,
  }));

  console.log('[Supabase] Fetched following:', following.length);
  return following;
}
