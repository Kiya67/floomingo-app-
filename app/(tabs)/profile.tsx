
import React, { useEffect, useState } from "react";
import { useTheme } from "@react-navigation/native";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useColorScheme, ActivityIndicator, Image, RefreshControl, Dimensions } from "react-native";
import { colors } from "@/styles/commonStyles";
import { VideoGridItem } from "@/components/VideoGridItem";
import { supabase } from "@/lib/supabase";
import { useRouter } from "expo-router";
import { IconSymbol } from "@/components/IconSymbol";

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
  const theme = useTheme();
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
  const [stats, setStats] = useState<ProfileStats>({ follower_count: 0, following_count: 0, post_count: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchProfile();
    fetchUserPosts();
    fetchStats();
  }, []);

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
    console.log('Fetching user posts');
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
        console.error('Error fetching posts:', error);
      } else {
        console.log('User posts fetched successfully:', data?.length || 0);
        setPosts(data || []);
      }
    } catch (error) {
      console.error('Error in fetchUserPosts:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    console.log('Fetching profile stats');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.error('No authenticated user');
        return;
      }

      const { data, error } = await supabase
        .from('profile_stats')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching stats:', error);
      } else {
        console.log('Profile stats fetched successfully:', data);
        setStats(data || { follower_count: 0, following_count: 0, post_count: 0 });
      }
    } catch (error) {
      console.error('Error in fetchStats:', error);
    }
  };

  const onRefresh = async () => {
    console.log('User pulled to refresh profile');
    setRefreshing(true);
    await fetchProfile();
    await fetchUserPosts();
    await fetchStats();
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
  const postsCount = stats.post_count;
  const followersCount = stats.follower_count;
  const followingCount = stats.following_count;
  const postsCountText = postsCount.toString();
  const followersCountText = followersCount.toString();
  const followingCountText = followingCount.toString();
  const emptyText = 'No travel videos yet';

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
          
          <TouchableOpacity 
            style={[styles.settingsButton, { backgroundColor: cardColor }]}
            onPress={handleSettings}
          >
            <IconSymbol 
              android_material_icon_name="settings" 
              size={24} 
              color={textColor}
            />
          </TouchableOpacity>
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
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: textColor }]}>{postsCountText}</Text>
              <Text style={[styles.statLabel, { color: textSecondaryColor }]}>Posts</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: textColor }]}>{followersCountText}</Text>
              <Text style={[styles.statLabel, { color: textSecondaryColor }]}>Followers</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: textColor }]}>{followingCountText}</Text>
              <Text style={[styles.statLabel, { color: textSecondaryColor }]}>Following</Text>
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
          <View style={styles.postsSectionHeader}>
            <IconSymbol 
              android_material_icon_name="videocam" 
              size={24} 
              color={textColor}
            />
            <Text style={[styles.postsSectionTitle, { color: textColor }]}>Videos</Text>
          </View>

          {posts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <IconSymbol 
                android_material_icon_name="videocam" 
                size={64} 
                color={textSecondaryColor}
              />
              <Text style={[styles.emptyText, { color: textSecondaryColor }]}>
                {emptyText}
              </Text>
            </View>
          ) : (
            <View style={styles.gridContainer}>
              {posts.map((post, index) => (
                <VideoGridItem
                  key={post.id}
                  post={post}
                  size={gridItemSize}
                  shouldPlay={false}
                  onPress={() => {
                    console.log('User tapped video:', post.id);
                    router.push(`/video/${post.id}`);
                  }}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
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
  settingsButton: {
    position: 'absolute',
    top: 16,
    right: 16,
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
    gap: 40,
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
  postsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  postsSectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
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
});
