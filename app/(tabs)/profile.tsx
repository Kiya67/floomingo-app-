
import React, { useEffect, useState } from "react";
import { IconSymbol } from "@/components/IconSymbol";
import { useTheme } from "@react-navigation/native";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useColorScheme, ActivityIndicator, Image, RefreshControl, Dimensions } from "react-native";
import { colors } from "@/styles/commonStyles";
import { supabase } from "@/lib/supabase";
import { useRouter } from "expo-router";
import { VideoGridItem } from "@/components/VideoGridItem";

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
  caption: string;
  place_id: string | null;
  place_name: string | null;
  location_type: string | null;
  created_at: string;
}

const { width } = Dimensions.get('window');
const gridItemSize = (width - 48) / 3;

function resolveImageSource(source: string | number | any) {
  if (!source) return { uri: '' };
  if (typeof source === 'string') return { uri: source };
  return source;
}

export default function ProfileScreen() {
  const router = useRouter();
  const theme = useTheme();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const bgColor = isDark ? colors.backgroundDark : colors.background;
  const textColor = isDark ? colors.textDark : colors.text;
  const textSecondaryColor = isDark ? colors.textSecondaryDark : colors.textSecondary;
  const cardColor = isDark ? colors.cardDark : colors.card;
  const primaryColor = isDark ? colors.primaryDark : colors.primary;

  useEffect(() => {
    fetchProfile();
    fetchUserPosts();
  }, []);

  const fetchProfile = async () => {
    console.log('Fetching user profile');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.log('No user found');
        setLoading(false);
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
    } finally {
      setLoading(false);
    }
  };

  const fetchUserPosts = async () => {
    console.log('Fetching user posts');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.log('No user found');
        return;
      }

      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', user.id)
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
  };

  const onRefresh = async () => {
    console.log('User pulled to refresh profile');
    setRefreshing(true);
    await fetchProfile();
    await fetchUserPosts();
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
    const nameParts = name.split(' ');
    const firstInitial = nameParts[0]?.charAt(0) || '';
    const lastInitial = nameParts[1]?.charAt(0) || '';
    const initials = firstInitial + lastInitial;
    return initials.toUpperCase();
  };

  const displayName = profile?.display_name || 'User';
  const displayUsername = profile?.username || '';
  const displayBio = profile?.bio || 'No bio yet';
  const initials = getInitials(displayName);

  const postsCount = posts.length.toString();
  const followersCount = '0';
  const followingCount = '0';

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
        <View style={styles.coverContainer}>
          {profile?.cover_url ? (
            <Image source={resolveImageSource(profile.cover_url)} style={styles.coverImage} />
          ) : (
            <View style={[styles.coverPlaceholder, { backgroundColor: cardColor }]} />
          )}
          
          <TouchableOpacity 
            style={styles.settingsOverlay}
            onPress={handleSettings}
          >
            <View style={styles.settingsIconContainer}>
              <IconSymbol 
                android_material_icon_name="settings" 
                size={24} 
                color="#FFFFFF"
              />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.profileSection}>
          {profile?.avatar_url ? (
            <Image source={resolveImageSource(profile.avatar_url)} style={styles.avatarLarge} />
          ) : (
            <View style={[styles.avatarLarge, { backgroundColor: primaryColor }]}>
              <Text style={styles.avatarLargeText}>{initials}</Text>
            </View>
          )}
          
          <Text style={[styles.name, { color: textColor }]}>{displayName}</Text>
          {displayUsername ? (
            <Text style={[styles.username, { color: textSecondaryColor }]}>@{displayUsername}</Text>
          ) : null}
          {profile?.bio ? (
            <Text style={[styles.bio, { color: textSecondaryColor }]}>
              {profile.bio}
            </Text>
          ) : null}

          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: textColor }]}>{postsCount}</Text>
              <Text style={[styles.statLabel, { color: textSecondaryColor }]}>Posts</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: textColor }]}>{followersCount}</Text>
              <Text style={[styles.statLabel, { color: textSecondaryColor }]}>Followers</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: textColor }]}>{followingCount}</Text>
              <Text style={[styles.statLabel, { color: textSecondaryColor }]}>Following</Text>
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.editButton, { backgroundColor: primaryColor }]}
            onPress={handleEditProfile}
          >
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.postsSection}>
          <View style={styles.tabBar}>
            <TouchableOpacity style={styles.tab}>
              <IconSymbol 
                android_material_icon_name="grid-on" 
                size={24} 
                color={primaryColor}
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.tab}>
              <IconSymbol 
                android_material_icon_name="bookmark-border" 
                size={24} 
                color={textSecondaryColor}
              />
            </TouchableOpacity>
          </View>
          
          {posts.length === 0 ? (
            <View style={styles.emptyPostsContainer}>
              <IconSymbol 
                android_material_icon_name="videocam" 
                size={48} 
                color={textSecondaryColor}
              />
              <Text style={[styles.emptyText, { color: textSecondaryColor }]}>
                Your travel videos will appear here
              </Text>
            </View>
          ) : (
            <View style={styles.gridContainer}>
              {posts.map((post) => (
                <VideoGridItem
                  key={post.id}
                  videoUrl={post.video_url}
                  size={gridItemSize}
                  cardColor={cardColor}
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
  coverContainer: {
    height: 280,
    width: '100%',
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
  },
  settingsOverlay: {
    position: 'absolute',
    top: 48,
    right: 16,
    zIndex: 10,
  },
  settingsIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileSection: {
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: -50,
  },
  avatarLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  avatarLargeText: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: 'bold',
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  username: {
    fontSize: 16,
    marginBottom: 8,
  },
  bio: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 4,
    paddingHorizontal: 24,
  },
  statsContainer: {
    flexDirection: 'row',
    marginTop: 24,
    marginBottom: 24,
    width: '100%',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
  },
  editButton: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  postsSection: {
    marginTop: 32,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  emptyPostsContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 16,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 6,
  },
});
