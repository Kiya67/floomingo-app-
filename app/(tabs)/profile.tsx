
import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useColorScheme, ActivityIndicator, Image, RefreshControl, Dimensions, Modal } from "react-native";
import { colors } from "@/styles/commonStyles";
import { VideoGridItem } from "@/components/VideoGridItem";
import { supabase } from "@/lib/supabase";
import { useRouter, useFocusEffect } from "expo-router";
import { IconSymbol } from "@/components/IconSymbol";
import { getFollowCounts } from "@/utils/supabaseHelpers";
import { Bell } from "lucide-react-native";

interface Experience {
  id: string;
  user_id: string;
  title: string;
  thumbnail_url: string | null;
  views_count: number;
  created_at: string;
}

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
  view_count?: number;
}

interface ProfileStats {
  follower_count: number;
  following_count: number;
  post_count: number;
}

const { width } = Dimensions.get('window');
const gridItemSize = (width - 48) / 3;

function resolveImageSource(source: string | number | any) {
  if (!source) {
    return { uri: '' };
  }
  if (typeof source === 'string') {
    return { uri: source };
  }
  return source;
}

export default function ProfileScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const bgColor = isDark ? colors.backgroundDark : colors.background;
  const textColor = isDark ? colors.textDark : colors.text;
  const textSecondaryColor = isDark ? colors.textSecondaryDark : colors.textSecondary;
  const cardColor = isDark ? colors.cardDark : colors.card;
  const primaryColor = isDark ? colors.primaryDark : colors.primary;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [activeTab, setActiveTab] = useState<"moments" | "experiences">("moments");
  const [stats, setStats] = useState<ProfileStats>({ follower_count: 0, following_count: 0, post_count: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [postToDelete, setPostToDelete] = useState<Post | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  const fetchProfile = async () => {
    console.log('Fetching user profile');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.error('No authenticated user');
        return;
      }

      console.log('User ID:', user.id);

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
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
  };

  const fetchUserPosts = async () => {
    console.log('Fetching user moments');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.error('No authenticated user');
        return;
      }

      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching moments:', error);
      } else {
        console.log('User moments fetched successfully:', data?.length || 0);
        setPosts(data || []);
      }
    } catch (error) {
      console.error('Error in fetchUserPosts:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchExperiences = async () => {
    console.log('Fetching user experiences');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from('experiences')
        .select('id, user_id, title, thumbnail_url, views_count, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Error fetching experiences:', error);
      } else {
        console.log('User experiences fetched:', data?.length || 0);
        setExperiences(data || []);
      }
    } catch (error) {
      console.error('Error in fetchExperiences:', error);
    }
  };

  const fetchStats = async () => {
    console.log('Fetching profile stats using Supabase client');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.error('No authenticated user');
        return;
      }

      const followCounts = await getFollowCounts(user.id);
      
      const { count: postCount } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      setStats({
        follower_count: followCounts.followerCount,
        following_count: followCounts.followingCount,
        post_count: postCount ?? 0,
      });
      
      console.log('Profile stats fetched successfully:', {
        followers: followCounts.followerCount,
        following: followCounts.followingCount,
        moments: postCount ?? 0,
      });
    } catch (error) {
      console.error('Error in fetchStats:', error);
    }
  };

  const fetchUnreadNotifications = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (!error && data) {
        setUnreadNotificationsCount(data.length);
      }
    } catch (error) {
      console.error('Error fetching unread notifications:', error);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      console.log('Profile screen focused - refreshing profile, moments, experiences, and stats');
      Promise.all([fetchProfile(), fetchUserPosts(), fetchExperiences(), fetchStats(), fetchUnreadNotifications()]);
    }, [])
  );

  const onRefresh = async () => {
    console.log('User pulled to refresh profile');
    setRefreshing(true);
    await Promise.all([fetchProfile(), fetchUserPosts(), fetchExperiences(), fetchStats(), fetchUnreadNotifications()]);
    setRefreshing(false);
  };

  const handleEditProfile = () => {
    console.log('User tapped Edit Profile button');
    router.push('/edit-profile');
  };

  const handleSettings = () => {
    console.log('User tapped Settings button');
    router.push('/settings');
  };

  const handleNotifications = () => {
    console.log('User tapped Notifications bell on profile');
    router.push('/(tabs)/notifications');
  };

  const handleLongPress = (post: Post) => {
    console.log('User long pressed on moment:', post.id);
    setPostToDelete(post);
    setShowDeleteModal(true);
  };

  const handleDeletePost = async () => {
    if (!postToDelete) return;

    console.log('User confirmed delete for moment:', postToDelete.id);
    setDeleting(true);

    try {
      const { error: postError } = await supabase
        .from('posts')
        .delete()
        .eq('id', postToDelete.id);

      if (postError) throw postError;

      console.log('Moment deleted successfully');
      
      setPosts(prevPosts => prevPosts.filter(p => p.id !== postToDelete.id));
      
      setShowDeleteModal(false);
      setPostToDelete(null);
      
      await fetchStats();
    } catch (error) {
      console.error('Error deleting moment:', error);
    } finally {
      setDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    console.log('User cancelled delete');
    setShowDeleteModal(false);
    setPostToDelete(null);
  };

  const getInitials = (name: string) => {
    if (!name) {
      return '?';
    }
    const nameParts = name.split(' ');
    const firstInitial = nameParts[0]?.[0] || '';
    const lastInitial = nameParts[1]?.[0] || '';
    const initials = firstInitial + lastInitial;
    return initials.toUpperCase();
  };

  const displayName = profile?.display_name || 'User';
  const username = profile?.username || '';
  const bio = profile?.bio || '';
  const avatarUrl = profile?.avatar_url || '';
  const coverUrl = profile?.cover_url || '';
  const initials = getInitials(displayName);
  const followersCount = Number(stats.follower_count ?? 0);
  const followingCount = Number(stats.following_count ?? 0);
  const momentsCount = Number(stats.post_count ?? 0);
  const followersCountText = followersCount.toString();
  const followingCountText = followingCount.toString();
  const momentsCountText = momentsCount.toString();
  const emptyText = 'No moments yet';
  const emptyExpText = 'No experiences yet';
  const unreadBadgeText = unreadNotificationsCount > 9 ? '9+' : String(unreadNotificationsCount);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: bgColor }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={primaryColor} />
          <Text style={[styles.loadingText, { color: textColor }]}>Loading profile...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
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
        <View style={styles.coverSection}>
          {coverUrl ? (
            <Image 
              source={resolveImageSource(coverUrl)} 
              style={styles.coverImage}
            />
          ) : (
            <View style={[styles.coverPlaceholder, { backgroundColor: primaryColor }]} />
          )}
          
          {/* Top-right header buttons: bell + settings */}
          <View style={styles.headerButtons}>
            <TouchableOpacity 
              style={[styles.headerIconButton, { backgroundColor: cardColor }]}
              onPress={handleNotifications}
            >
              <Bell size={22} color={textColor} />
              {unreadNotificationsCount > 0 && (
                <View style={[styles.badge, { backgroundColor: '#FF3B30' }]}>
                  <Text style={styles.badgeText}>{unreadBadgeText}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.headerIconButton, { backgroundColor: cardColor }]}
              onPress={handleSettings}
            >
              <IconSymbol 
                android_material_icon_name="settings" 
                size={22} 
                color={textColor}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.profileInfo}>
          <View style={styles.avatarSection}>
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

          <View style={styles.nameSection}>
            <Text style={[styles.displayName, { color: textColor }]}>{displayName}</Text>
            {username ? (
              <Text style={[styles.username, { color: textSecondaryColor }]}>@{username}</Text>
            ) : null}
          </View>

          {bio ? (
            <View style={styles.bioSection}>
              <Text style={[styles.bio, { color: textColor }]}>{bio}</Text>
            </View>
          ) : null}

          <View style={styles.statsSection}>
            <TouchableOpacity 
              style={styles.statItem}
              onPress={() => {
                console.log('User tapped Followers');
                if (profile?.id) {
                  router.push(`/followers/${profile.id}`);
                }
              }}
            >
              <Text style={[styles.statValue, { color: textColor }]}>{followersCountText}</Text>
              <Text style={[styles.statLabel, { color: textSecondaryColor }]}>Followers</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.statItem}
              onPress={() => {
                console.log('User tapped Following');
                if (profile?.id) {
                  router.push(`/following/${profile.id}`);
                }
              }}
            >
              <Text style={[styles.statValue, { color: textColor }]}>{followingCountText}</Text>
              <Text style={[styles.statLabel, { color: textSecondaryColor }]}>Following</Text>
            </TouchableOpacity>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: textColor }]}>{momentsCountText}</Text>
              <Text style={[styles.statLabel, { color: textSecondaryColor }]}>Moments</Text>
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.editButton, { borderColor: primaryColor }]}
            onPress={handleEditProfile}
          >
            <IconSymbol 
              android_material_icon_name="edit" 
              size={20} 
              color={primaryColor}
            />
            <Text style={[styles.editButtonText, { color: primaryColor }]}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.postsSection}>
          {/* Tab switcher */}
          <View style={styles.tabSwitcher}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'moments' && styles.tabBtnActive]}
              onPress={() => {
                console.log('User tapped Moments tab');
                setActiveTab('moments');
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabBtnText, activeTab === 'moments' && styles.tabBtnTextActive]}>Moments</Text>
              {activeTab === 'moments' && <View style={styles.tabUnderline} />}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'experiences' && styles.tabBtnActive]}
              onPress={() => {
                console.log('User tapped Experiences tab');
                setActiveTab('experiences');
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabBtnText, activeTab === 'experiences' && styles.tabBtnTextActive]}>Experiences</Text>
              {activeTab === 'experiences' && <View style={styles.tabUnderline} />}
            </TouchableOpacity>
          </View>

          {activeTab === 'moments' ? (
            posts.length === 0 ? (
              <View style={styles.emptyContainer}>
                <IconSymbol android_material_icon_name="videocam" size={64} color={textSecondaryColor} />
                <Text style={[styles.emptyText, { color: textSecondaryColor }]}>{emptyText}</Text>
              </View>
            ) : (
              <View style={styles.gridContainer}>
                {posts.map((post) => {
                  if (!post) return null;
                  return (
                    <VideoGridItem
                      key={post.id}
                      post={post}
                      size={gridItemSize}
                      shouldPlay={false}
                      onPress={() => {
                        console.log('User tapped moment:', post.id);
                        router.push(`/video/${post.id}`);
                      }}
                      onLongPress={() => handleLongPress(post)}
                      showViewCount={false}
                    />
                  );
                })}
              </View>
            )
          ) : (
            experiences.length === 0 ? (
              <View style={styles.emptyContainer}>
                <IconSymbol android_material_icon_name="movie" size={64} color={textSecondaryColor} />
                <Text style={[styles.emptyText, { color: textSecondaryColor }]}>{emptyExpText}</Text>
              </View>
            ) : (
              <View style={styles.expGridContainer}>
                {experiences.map((exp) => {
                  const expThumbSource = exp.thumbnail_url ? { uri: exp.thumbnail_url } : null;
                  const expViewsText = String(exp.views_count ?? 0);
                  return (
                    <TouchableOpacity
                      key={exp.id}
                      style={[styles.expCard, { width: (width - 48) / 2 }]}
                      onPress={() => {
                        console.log('User tapped experience:', exp.id);
                        router.push(`/experience/${exp.id}` as any);
                      }}
                      activeOpacity={0.85}
                    >
                      <View style={styles.expThumb}>
                        {expThumbSource ? (
                          <Image source={expThumbSource} style={styles.expThumbImg} resizeMode="cover" />
                        ) : (
                          <View style={[styles.expThumbPlaceholder, { backgroundColor: primaryColor }]}>
                            <IconSymbol android_material_icon_name="movie" size={28} color="#fff" />
                          </View>
                        )}
                      </View>
                      <View style={styles.expInfo}>
                        <Text style={[styles.expTitle, { color: textColor }]} numberOfLines={2}>{exp.title}</Text>
                        <Text style={[styles.expViews, { color: textSecondaryColor }]}>{expViewsText} views</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )
          )}
        </View>
      </ScrollView>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={handleCancelDelete}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: cardColor }]}>
            <Text style={[styles.modalTitle, { color: textColor }]}>Delete Moment</Text>
            <Text style={[styles.modalMessage, { color: textSecondaryColor }]}>
              Are you sure you want to delete this moment? This action cannot be undone.
            </Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, { borderColor: textSecondaryColor }]}
                onPress={handleCancelDelete}
                disabled={deleting}
              >
                <Text style={[styles.cancelButtonText, { color: textColor }]}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.deleteButton, { backgroundColor: '#FF3B30' }]}
                onPress={handleDeletePost}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.deleteButtonText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  coverSection: {
    position: 'relative',
    height: 280,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
  },
  headerButtons: {
    position: 'absolute',
    top: 60,
    right: 16,
    flexDirection: 'row',
    gap: 10,
  },
  headerIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  profileInfo: {
    paddingHorizontal: 16,
    marginTop: -40,
  },
  avatarSection: {
    alignItems: 'center',
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
  nameSection: {
    alignItems: 'center',
    marginBottom: 12,
  },
  displayName: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  username: {
    fontSize: 16,
    marginTop: 4,
  },
  bioSection: {
    marginBottom: 16,
  },
  bio: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  statsSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 32,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 14,
    marginTop: 4,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    gap: 8,
    marginBottom: 24,
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  postsSection: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  tabSwitcher: {
    flexDirection: 'row',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    position: 'relative',
  },
  tabBtnActive: {},
  tabBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#999',
  },
  tabBtnTextActive: {
    color: '#FF3B7A',
  },
  tabUnderline: {
    position: 'absolute',
    bottom: -1,
    left: '20%',
    right: '20%',
    height: 2,
    backgroundColor: '#FF3B7A',
    borderRadius: 1,
  },
  expGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  expCard: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
  },
  expThumb: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#ddd',
  },
  expThumbImg: {
    width: '100%',
    height: '100%',
  },
  expThumbPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  expInfo: {
    padding: 8,
  },
  expTitle: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  expViews: {
    fontSize: 11,
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 24,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    minHeight: 44,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
