
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useColorScheme, ActivityIndicator, Image, RefreshControl, Dimensions, ImageSourcePropType } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { VideoGridItem } from '@/components/VideoGridItem';
import { Modal } from '@/components/ui/Modal';
import { Toast } from '@/components/ui/Toast';
import { authenticatedApiCall, getProfileStats, followUser, unfollowUser, getFollowStatus } from '@/utils/api';

interface Profile {
  id: string;
  email: string;
  display_name: string;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
}

interface Post {
  id: string;
  user_id: string;
  video_url: string;
  thumbnail_url: string;
  caption: string;
  place_id: string | null;
  place_name: string | null;
  location_type: string | null;
  created_at: string;
}

interface ProfileStats {
  follower_count: number;
  following_count: number;
  post_count: number;
}

const windowWidth = Dimensions.get('window').width;
const gridItemSize = (windowWidth - 48) / 3;

function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: '' };
  if (typeof source === 'string') return { uri: source };
  return source as ImageSourcePropType;
}

export default function UserProfileScreen() {
  const { id: profileUserId } = useLocalSearchParams();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const bgColor = isDark ? colors.backgroundDark : colors.background;
  const textColor = isDark ? colors.textDark : colors.text;
  const textSecondaryColor = isDark ? colors.textSecondaryDark : colors.textSecondary;
  const primaryColor = isDark ? colors.primaryDark : colors.primary;
  const cardColor = isDark ? colors.cardDark : colors.card;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [stats, setStats] = useState<ProfileStats>({ follower_count: 0, following_count: 0, post_count: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // Block/Report states
  const [showMoreModal, setShowMoreModal] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  
  // Toast states
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  const checkBlockStatus = useCallback(async (targetUserId: string, currentUserId: string) => {
    console.log('[API] Checking block status for user:', targetUserId);
    try {
      const data = await authenticatedApiCall(`/api/blocks/check/${targetUserId}`, {
        method: 'GET',
      });
      
      setIsBlocked(data.isBlocked || false);
      console.log('[API] Block status:', data.isBlocked);
    } catch (error) {
      console.error('[API] Error checking block status:', error);
      setIsBlocked(false);
    }
  }, []);

  const fetchProfile = useCallback(async () => {
    console.log('Fetching user profile for ID:', profileUserId);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profileUserId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
      } else {
        console.log('Profile fetched successfully:', data);
        setProfile(data);
      }
    } catch (error) {
      console.error('Error in fetchProfile:', error);
    }
  }, [profileUserId]);

  const fetchUserPosts = useCallback(async () => {
    console.log('Fetching posts for user:', profileUserId);
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', profileUserId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching user posts:', error);
      } else {
        console.log('User posts fetched successfully:', data?.length || 0);
        setPosts(data || []);
      }
    } catch (error) {
      console.error('Error in fetchUserPosts:', error);
    }
  }, [profileUserId]);

  const fetchStats = useCallback(async () => {
    console.log('Fetching profile stats for user from backend API:', profileUserId);
    try {
      // Use backend API to fetch stats
      try {
        const statsData = await getProfileStats(profileUserId as string);
        console.log('Stats fetched successfully from backend:', statsData);
        setStats({
          follower_count: statsData.follower_count || 0,
          following_count: statsData.following_count || 0,
          post_count: statsData.post_count || 0,
        });
      } catch (apiError) {
        console.error('Error fetching stats from backend API:', apiError);
        // Fallback to Supabase direct query if backend fails
        const { data, error } = await supabase
          .from('profile_stats')
          .select('*')
          .eq('user_id', profileUserId)
          .single();

        if (error) {
          console.error('Error fetching stats from Supabase:', error);
        } else if (data) {
          console.log('Stats fetched successfully from Supabase fallback:', data);
          setStats(data);
        }
      }
    } catch (error) {
      console.error('Error in fetchStats:', error);
    }
  }, [profileUserId]);

  const checkFollowStatus = useCallback(async () => {
    console.log('Checking follow status for user:', profileUserId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('No authenticated user');
        return;
      }

      setCurrentUserId(user.id);

      // Don't check follow status if viewing own profile
      if (user.id === profileUserId) {
        console.log('Viewing own profile, skipping follow status check');
        setIsFollowing(false);
        return;
      }

      // Check block status
      await checkBlockStatus(profileUserId as string, user.id);

      // Use backend API to check follow status
      try {
        const statusData = await getFollowStatus(profileUserId as string);
        console.log('Follow status from backend:', statusData.isFollowing);
        setIsFollowing(statusData.isFollowing);
      } catch (apiError) {
        console.error('Error checking follow status from backend API:', apiError);
        // Fallback to Supabase direct query if backend fails
        const { data, error } = await supabase
          .from('follows')
          .select('*')
          .eq('follower_id', user.id)
          .eq('following_id', profileUserId)
          .limit(1);

        if (error) {
          console.error('Error checking follow status from Supabase:', error);
        } else {
          const following = data && data.length > 0;
          console.log('Follow status from Supabase fallback:', following);
          setIsFollowing(following);
        }
      }
    } catch (error) {
      console.error('Error in checkFollowStatus:', error);
    }
  }, [profileUserId, checkBlockStatus]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchProfile(),
        fetchUserPosts(),
        fetchStats(),
        checkFollowStatus(),
      ]);
      setLoading(false);
    };
    loadData();
  }, [fetchProfile, fetchUserPosts, fetchStats, checkFollowStatus]);

  const onRefresh = async () => {
    console.log('User pulled to refresh profile');
    setRefreshing(true);
    await Promise.all([
      fetchProfile(),
      fetchUserPosts(),
      fetchStats(),
      checkFollowStatus(),
    ]);
    setRefreshing(false);
  };

  const handleFollowToggle = async () => {
    console.log('User tapped follow/unfollow button');
    if (followLoading || !currentUserId) return;

    // CRITICAL: Prevent following yourself
    if (currentUserId === profileUserId) {
      console.log('Cannot follow yourself, ignoring action');
      return;
    }

    try {
      setFollowLoading(true);

      if (isFollowing) {
        console.log('Unfollowing user:', profileUserId);
        // Use backend API to unfollow
        const response = await unfollowUser(profileUserId as string);
        
        setIsFollowing(false);
        // Update follower count from backend response
        setStats(prev => ({ ...prev, follower_count: response.follower_count }));
        console.log('Successfully unfollowed user, new follower count:', response.follower_count);
      } else {
        console.log('Following user:', profileUserId);
        // Use backend API to follow
        const response = await followUser(profileUserId as string);
        
        setIsFollowing(true);
        // Update follower count from backend response
        setStats(prev => ({ ...prev, follower_count: response.follower_count }));
        console.log('Successfully followed user, new follower count:', response.follower_count);
      }
    } catch (error: any) {
      console.error('Error toggling follow:', error);
      showToast(error.message || 'Failed to update follow status', 'error');
    } finally {
      setFollowLoading(false);
    }
  };

  const handleBlockUser = async () => {
    console.log('[API] User tapped block user');
    if (!currentUserId) return;

    // Prevent blocking yourself
    if (currentUserId === profileUserId) {
      console.log('Cannot block yourself');
      showToast('Cannot block yourself', 'error');
      return;
    }

    setShowMoreModal(false);
    setBlockLoading(true);

    try {
      if (isBlocked) {
        // Unblock
        console.log('[API] Unblocking user:', profileUserId);
        const data = await authenticatedApiCall(`/api/blocks/${profileUserId}`, {
          method: 'DELETE',
        });

        console.log('[API] Unblock response:', data);

        setIsBlocked(false);
        showToast('User unblocked', 'success');
        console.log('[API] User unblocked successfully');
      } else {
        // Block
        console.log('[API] Blocking user:', profileUserId);
        const data = await authenticatedApiCall('/api/blocks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            blocked_id: profileUserId,
          }),
        });

        console.log('[API] Block response:', data);

        // Unfollow each other (using Supabase since this is a local operation)
        console.log('Unfollowing blocked user');
        await supabase
          .from('follows')
          .delete()
          .or(`and(follower_id.eq.${currentUserId},following_id.eq.${profileUserId}),and(follower_id.eq.${profileUserId},following_id.eq.${currentUserId})`);

        setIsBlocked(true);
        setIsFollowing(false);
        showToast('User blocked', 'success');
        console.log('[API] User blocked successfully');

        // Navigate back to remove blocked user's content from view
        setTimeout(() => {
          router.back();
        }, 1000);
      }
    } catch (error) {
      console.error('[API] Error blocking/unblocking user:', error);
      showToast('Failed to update block status', 'error');
    } finally {
      setBlockLoading(false);
    }
  };

  const handleReportUser = () => {
    console.log('User tapped report user');
    setShowMoreModal(false);
    // TODO: Implement report functionality (backend endpoint not yet available)
    showToast('Report functionality coming soon', 'info');
  };

  const handleMoreOptions = () => {
    console.log('User tapped more options button');
    if (currentUserId === profileUserId) {
      console.log('Cannot block/report yourself');
      return;
    }
    setShowMoreModal(true);
  };

  const handleBack = () => {
    console.log('User tapped back button');
    router.back();
  };

  const getInitials = (name: string) => {
    const names = name.split(' ');
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const displayName = profile?.display_name || 'Unknown User';
  const username = profile?.username || '';
  const bio = profile?.bio || '';
  const avatarUrl = profile?.avatar_url || '';
  const coverUrl = profile?.cover_url || '';
  const initials = getInitials(displayName);

  const followerCountText = stats.follower_count.toString();
  const followingCountText = stats.following_count.toString();
  const postCountText = stats.post_count.toString();

  const isOwnProfile = currentUserId === profileUserId;
  const blockButtonText = isBlocked ? 'Unblock User' : 'Block User';

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: bgColor }]}>
        <Stack.Screen 
          options={{
            headerShown: true,
            title: 'Profile',
            headerStyle: { backgroundColor: bgColor },
            headerTintColor: textColor,
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={primaryColor} />
          <Text style={[styles.loadingText, { color: textColor }]}>Loading profile...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <Stack.Screen 
        options={{
          headerShown: true,
          title: displayName,
          headerStyle: { backgroundColor: bgColor },
          headerTintColor: textColor,
          headerRight: !isOwnProfile ? () => (
            <TouchableOpacity
              onPress={handleMoreOptions}
              style={{ marginRight: 16 }}
              activeOpacity={0.7}
            >
              <IconSymbol 
                android_material_icon_name="more-vert" 
                size={24} 
                color={textColor}
              />
            </TouchableOpacity>
          ) : undefined,
        }}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={primaryColor}
            colors={[primaryColor]}
          />
        }
      >
        <View style={styles.coverContainer}>
          {coverUrl ? (
            <Image 
              source={resolveImageSource(coverUrl)} 
              style={styles.coverImage}
            />
          ) : (
            <View style={[styles.coverPlaceholder, { backgroundColor: primaryColor }]} />
          )}
        </View>

        <View style={[styles.profileHeader, { backgroundColor: bgColor }]}>
          <View style={styles.avatarContainer}>
            {avatarUrl ? (
              <Image 
                source={resolveImageSource(avatarUrl)} 
                style={styles.avatar}
              />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: primaryColor }]}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            )}
          </View>

          <View style={styles.nameContainer}>
            <Text style={[styles.displayName, { color: textColor }]}>{displayName}</Text>
            {username ? (
              <Text style={[styles.username, { color: textSecondaryColor }]}>@{username}</Text>
            ) : null}
          </View>

          {bio ? (
            <Text style={[styles.bio, { color: textColor }]}>{bio}</Text>
          ) : null}

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: textColor }]}>{postCountText}</Text>
              <Text style={[styles.statLabel, { color: textSecondaryColor }]}>Posts</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: textColor }]}>{followerCountText}</Text>
              <Text style={[styles.statLabel, { color: textSecondaryColor }]}>Followers</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: textColor }]}>{followingCountText}</Text>
              <Text style={[styles.statLabel, { color: textSecondaryColor }]}>Following</Text>
            </View>
          </View>

          {!isOwnProfile && (
            <TouchableOpacity
              style={[
                styles.followButton,
                { 
                  backgroundColor: isFollowing ? cardColor : primaryColor,
                  borderWidth: isFollowing ? 1 : 0,
                  borderColor: isFollowing ? primaryColor : 'transparent',
                }
              ]}
              onPress={handleFollowToggle}
              disabled={followLoading}
              activeOpacity={0.7}
            >
              {followLoading ? (
                <ActivityIndicator size="small" color={isFollowing ? primaryColor : '#FFFFFF'} />
              ) : (
                <Text style={[
                  styles.followButtonText,
                  { color: isFollowing ? primaryColor : '#FFFFFF' }
                ]}>
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.postsSection}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>Posts</Text>
          {posts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <IconSymbol 
                android_material_icon_name="videocam" 
                size={48} 
                color={textSecondaryColor}
              />
              <Text style={[styles.emptyText, { color: textSecondaryColor }]}>
                No posts yet
              </Text>
            </View>
          ) : (
            <View style={styles.gridContainer}>
              {posts.map((post, index) => (
                <VideoGridItem
                  key={post.id}
                  post={post}
                  size={gridItemSize}
                  onPress={() => router.push(`/video/${post.id}`)}
                  shouldPlay={false}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* More Options Modal (Block/Report) */}
      <Modal
        visible={showMoreModal}
        onClose={() => setShowMoreModal(false)}
        title="More Options"
      >
        <View style={{ gap: 12, marginBottom: 20 }}>
          <TouchableOpacity
            style={[styles.modalOptionButton, { borderBottomColor: textSecondaryColor }]}
            onPress={handleBlockUser}
            disabled={blockLoading}
            activeOpacity={0.7}
          >
            {blockLoading ? (
              <ActivityIndicator size="small" color={primaryColor} />
            ) : (
              <>
                <IconSymbol 
                  android_material_icon_name={isBlocked ? "check-circle" : "block"} 
                  size={24} 
                  color={isBlocked ? primaryColor : '#FF3B30'}
                />
                <Text style={[styles.modalOptionText, { color: isBlocked ? primaryColor : '#FF3B30' }]}>
                  {blockButtonText}
                </Text>
              </>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.modalOptionButton}
            onPress={handleReportUser}
            activeOpacity={0.7}
          >
            <IconSymbol 
              android_material_icon_name="flag" 
              size={24} 
              color={textColor}
            />
            <Text style={[styles.modalOptionText, { color: textColor }]}>Report User</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Toast Notification */}
      <Toast
        message={toastMessage}
        visible={toastVisible}
        onHide={() => setToastVisible(false)}
        type={toastType}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  coverContainer: {
    width: '100%',
    height: 200,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
  },
  profileHeader: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    marginTop: -50,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  nameContainer: {
    marginBottom: 12,
  },
  displayName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  username: {
    fontSize: 16,
  },
  bio: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
  },
  followButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  followButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  postsSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 12,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  modalOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  modalOptionText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
