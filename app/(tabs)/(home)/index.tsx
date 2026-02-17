
import React, { useEffect, useState } from "react";
import { StyleSheet, View, Text, ScrollView, useColorScheme, ActivityIndicator, Dimensions, RefreshControl, TouchableOpacity } from "react-native";
import { IconSymbol } from "@/components/IconSymbol";
import { colors } from "@/styles/commonStyles";
import { supabase } from "@/lib/supabase";
import { VideoGridItem } from "@/components/VideoGridItem";
import { useRouter, useLocalSearchParams } from "expo-router";
import { FilterModal } from "@/components/FilterModal";

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
  profiles?: {
    display_name: string;
    avatar_url: string | null;
  };
}

const windowWidth = Dimensions.get('window').width;
const gridItemSize = (windowWidth - 48) / 3;
const MAX_PLAYING_VIDEOS = 2;

export default function HomeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const bgColor = isDark ? colors.backgroundDark : colors.background;
  const textColor = isDark ? colors.textDark : colors.text;
  const textSecondaryColor = isDark ? colors.textSecondaryDark : colors.textSecondary;
  const primaryColor = isDark ? colors.primaryDark : colors.primary;

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});

  // Filter state
  const [filterPlaceId, setFilterPlaceId] = useState<string | null>(null);
  const [filterPlaceName, setFilterPlaceName] = useState<string | null>(null);
  const [filterKeywords, setFilterKeywords] = useState<string | null>(null);

  // Calculate active filters count
  const activeFiltersCount = [filterPlaceId, filterKeywords].filter(Boolean).length;

  // Listen for filter params from location search
  useEffect(() => {
    if (params.filterPlaceId) {
      console.log('Received filter location from search:', params.filterPlaceName);
      setFilterPlaceId(params.filterPlaceId as string);
      setFilterPlaceName(params.filterPlaceName as string);
      setFilterModalVisible(true);
    }
  }, [params.filterPlaceId, params.filterPlaceName]);

  useEffect(() => {
    fetchPosts();
    checkFollowingStatus();
  }, [filterPlaceId, filterKeywords]);

  const checkFollowingStatus = async () => {
    console.log('Checking following status for all users');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);

      if (error) {
        console.error('Error checking following status:', error);
      } else if (data) {
        const map: Record<string, boolean> = {};
        data.forEach(follow => {
          map[follow.following_id] = true;
        });
        setFollowingMap(map);
        console.log('Following status loaded:', Object.keys(map).length, 'users');
      }
    } catch (error) {
      console.error('Error in checkFollowingStatus:', error);
    }
  };

  const fetchPosts = async () => {
    console.log('Fetching posts with filters:', { filterPlaceId, filterKeywords });
    try {
      let query = supabase
        .from('posts')
        .select(`
          *,
          profiles!posts_user_id_fkey (
            display_name,
            avatar_url
          )
        `);

      // Apply location filter
      if (filterPlaceId) {
        console.log('Applying place_id filter:', filterPlaceId);
        query = query.eq('place_id', filterPlaceId);
      }

      // Apply keyword filter (client-side for now)
      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching posts:', error);
        setPosts([]);
      } else {
        let filteredData = data || [];

        // Apply keyword filter client-side
        if (filterKeywords && filterKeywords.trim()) {
          const keywords = filterKeywords
            .toLowerCase()
            .split(/[\s,]+/)
            .filter(k => k.length > 0);
          
          console.log('Applying keyword filters:', keywords);

          filteredData = filteredData.filter(post => {
            const caption = (post.caption || '').toLowerCase();
            const placeName = (post.place_name || '').toLowerCase();
            const searchText = `${caption} ${placeName}`;

            // All keywords must be present
            return keywords.every(keyword => searchText.includes(keyword));
          });
        }

        console.log('Posts fetched successfully:', filteredData.length);
        setPosts(filteredData);
      }
    } catch (error) {
      console.error('Error in fetchPosts:', error);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    console.log('User pulled to refresh posts');
    setRefreshing(true);
    await fetchPosts();
    setRefreshing(false);
  };

  const handleGridItemPress = (post: Post) => {
    console.log('User tapped grid item, opening full screen:', post.id);
    router.push(`/video/${post.id}`);
  };

  const handleFilterPress = () => {
    console.log('User tapped filter icon');
    setFilterModalVisible(true);
  };

  const handleFavoritePress = () => {
    console.log('User tapped favorite icon');
    // TODO: Implement favorites functionality
  };

  const handleApplyFilters = (placeId: string | null, placeName: string | null, keywords: string | null) => {
    console.log('Applying filters:', { placeId, placeName, keywords });
    setFilterPlaceId(placeId);
    setFilterPlaceName(placeName);
    setFilterKeywords(keywords);
    setFilterModalVisible(false);
  };

  const handleClearFilters = () => {
    console.log('Clearing all filters');
    setFilterPlaceId(null);
    setFilterPlaceName(null);
    setFilterKeywords(null);
    setFilterModalVisible(false);
  };

  const handleFollowToggle = async (userId: string, isCurrentlyFollowing: boolean) => {
    console.log('User toggled follow for user:', userId, 'Currently following:', isCurrentlyFollowing);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('No authenticated user');
        return;
      }

      if (isCurrentlyFollowing) {
        console.log('Unfollowing user:', userId);
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', userId);

        if (error) throw error;

        setFollowingMap(prev => {
          const newMap = { ...prev };
          delete newMap[userId];
          return newMap;
        });
        console.log('Successfully unfollowed user');
      } else {
        console.log('Following user:', userId);
        const { error } = await supabase
          .from('follows')
          .insert({
            follower_id: user.id,
            following_id: userId,
          });

        if (error) throw error;

        setFollowingMap(prev => ({ ...prev, [userId]: true }));
        console.log('Successfully followed user');
      }
    } catch (error: any) {
      console.error('Error toggling follow:', error);
    }
  };

  const emptyText = activeFiltersCount > 0 
    ? 'No videos found. Try clearing filters.' 
    : 'No videos yet. Be the first to post!';

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: bgColor }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={primaryColor} />
          <Text style={[styles.loadingText, { color: textColor }]}>Loading videos...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={[styles.headerBar, { backgroundColor: bgColor }]}>
        <TouchableOpacity 
          style={styles.iconButton}
          onPress={handleFavoritePress}
          activeOpacity={0.7}
        >
          <IconSymbol 
            android_material_icon_name="favorite" 
            size={28} 
            color={primaryColor}
          />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.iconButton}
          onPress={handleFilterPress}
          activeOpacity={0.7}
        >
          <View>
            <IconSymbol 
              android_material_icon_name="filter-list" 
              size={28} 
              color={textColor}
            />
            {activeFiltersCount > 0 && (
              <View style={[styles.badge, { backgroundColor: primaryColor }]}>
                <Text style={styles.badgeText}>{activeFiltersCount}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.feed} 
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
                onPress={() => handleGridItemPress(post)}
                shouldPlay={index < MAX_PLAYING_VIDEOS}
                showFollowButton={true}
                onFollowToggle={handleFollowToggle}
                isFollowing={followingMap[post.user_id] || false}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <FilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        onApply={handleApplyFilters}
        onClear={handleClearFilters}
        initialPlaceId={filterPlaceId}
        initialPlaceName={filterPlaceName}
        initialKeywords={filterKeywords}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  iconButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  feed: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    paddingTop: 12,
    gap: 6,
  },
});
