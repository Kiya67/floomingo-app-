
import React, { useEffect, useState, useCallback } from "react";
import { StyleSheet, View, Text, ScrollView, useColorScheme, ActivityIndicator, Dimensions, RefreshControl, TouchableOpacity } from "react-native";
import { IconSymbol } from "@/components/IconSymbol";
import { colors } from "@/styles/commonStyles";
import { supabase } from "@/lib/supabase";
import { VideoGridItem } from "@/components/VideoGridItem";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { FilterModal } from "@/components/FilterModal";
import { authenticatedApiCall } from "@/utils/api";
import { OnboardingTooltip, shouldShowOnboardingTooltip } from "@/components/OnboardingTooltip";

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
const gridItemHeight = gridItemSize * 1.5;
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
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [showOnboardingTooltip, setShowOnboardingTooltip] = useState(false);

  // Filter state
  const [filterPlaceId, setFilterPlaceId] = useState<string | null>(null);
  const [filterPlaceName, setFilterPlaceName] = useState<string | null>(null);
  const [filterKeywords, setFilterKeywords] = useState<string | null>(null);

  // Calculate active filters count
  const activeFiltersCount = [filterPlaceId, filterKeywords].filter(Boolean).length;

  // Check if we should show onboarding tooltip when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      const checkOnboarding = async () => {
        const shouldShow = await shouldShowOnboardingTooltip();
        console.log('HomeScreen - Should show onboarding tooltip:', shouldShow);
        if (shouldShow) {
          // Delay slightly to ensure UI is ready
          setTimeout(() => {
            setShowOnboardingTooltip(true);
          }, 500);
        }
      };
      
      checkOnboarding();
    }, [])
  );

  const fetchUnreadNotifications = useCallback(async () => {
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
  }, []);

  const fetchPosts = useCallback(async () => {
    console.log('Fetching posts with filters:', { filterPlaceId, filterKeywords });
    try {
      // Fetch blocked users list from API
      let blockedUserIds: string[] = [];
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        try {
          // authenticatedApiCall returns parsed JSON directly, not a Response object
          const blocksData = await authenticatedApiCall<any[]>('/api/blocks', {
            method: 'GET',
          });
          console.log('[API] Blocked users fetched for feed filtering:', blocksData.length);
          blockedUserIds = blocksData.map((block: any) =>
            block.blockerId === user.id ? block.blockedId : block.blockerId
          );
        } catch (error) {
          console.error('[API] Error fetching blocked users:', error);
        }
      }

      let query = supabase
        .from('posts')
        .select(`
          *,
          profiles!posts_user_id_fkey (
            display_name,
            avatar_url
          )
        `)
        .order('created_at', { ascending: false });

      // Apply location filter
      if (filterPlaceId) {
        console.log('Applying place_id filter:', filterPlaceId);
        query = query.eq('place_id', filterPlaceId);
      }

      // Filter out blocked users
      if (blockedUserIds.length > 0) {
        console.log('Filtering out blocked users from feed:', blockedUserIds.length);
        query = query.not('user_id', 'in', `(${blockedUserIds.join(',')})`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching posts:', error);
        setPosts([]);
      } else {
        let filteredData = Array.isArray(data) ? data : [];

        try {
          // Apply keyword filter client-side
          if (filterKeywords && filterKeywords.trim()) {
            const keywords = filterKeywords
              .toLowerCase()
              .split(/[\s,]+/)
              .filter(k => k.length > 0);
            
            console.log('Applying keyword filters:', keywords);

            filteredData = filteredData.filter(post => {
              const caption = (post?.caption ?? '').toLowerCase();
              const placeName = (post?.place_name ?? '').toLowerCase();
              const searchText = `${caption} ${placeName}`;

              return keywords.every(keyword => searchText.includes(keyword));
            });
          }

          console.log('Posts fetched successfully:', filteredData.length);
          setPosts(filteredData);
        } catch (filterError) {
          console.error('Error applying video filter:', filterError);
          setPosts(filteredData);
        }
      }
    } catch (error) {
      console.error('Error in fetchPosts:', error);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [filterPlaceId, filterKeywords]);

  // Listen for filter params from location search
  useEffect(() => {
    if (params.filterPlaceId) {
      console.log('Received filter location from search:', params.filterPlaceName);
      setFilterPlaceId(params.filterPlaceId as string);
      setFilterPlaceName(params.filterPlaceName as string);
      setFilterModalVisible(true);
    }
  }, [params.filterPlaceId, params.filterPlaceName]);

  // Re-fetch posts every time the home screen comes into focus (covers mount + tab re-focus + post-navigation return).
  // Also re-runs when filter deps change because fetchPosts is memoized on them.
  useFocusEffect(
    useCallback(() => {
      console.log('HomeScreen focused - re-fetching posts');
      fetchPosts();
      fetchUnreadNotifications();
    }, [fetchPosts, fetchUnreadNotifications])
  );

  const onRefresh = async () => {
    console.log('User pulled to refresh posts');
    setRefreshing(true);
    await fetchPosts();
    await fetchUnreadNotifications();
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

  const handleNotificationsPress = () => {
    console.log('User tapped notifications icon - navigating to notifications tab');
    router.push('/(tabs)/notifications');
  };

  const handleApplyFilters = (placeId: string | null, placeName: string | null, keywords: string | null) => {
    console.log('Applying filters:', { placeId, placeName, keywords });
    
    try {
      setFilterPlaceId(placeId);
      setFilterPlaceName(placeName);
      setFilterKeywords(keywords);
      setFilterModalVisible(false);
    } catch (error) {
      console.error('Error applying filters:', error);
      setFilterModalVisible(false);
    }
  };

  const handleClearFilters = () => {
    console.log('Clearing all filters');
    
    try {
      setFilterPlaceId(null);
      setFilterPlaceName(null);
      setFilterKeywords(null);
      setFilterModalVisible(false);
    } catch (error) {
      console.error('Error clearing filters:', error);
      setFilterModalVisible(false);
    }
  };

  const handleDismissOnboarding = () => {
    console.log('HomeScreen - Dismissing onboarding tooltip');
    setShowOnboardingTooltip(false);
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
        <View style={styles.headerLeft}>
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={handleNotificationsPress}
            activeOpacity={0.7}
          >
            <View>
              <IconSymbol 
                android_material_icon_name="favorite" 
                size={28} 
                color={primaryColor}
              />
              {unreadNotificationsCount > 0 && (
                <View style={[styles.badge, { backgroundColor: '#FF3B30' }]}>
                  <Text style={styles.badgeText}>
                    {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>
        <View style={styles.headerRight}>
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
        {!Array.isArray(posts) || posts.length === 0 ? (
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
              post && post.id ? (
                <VideoGridItem
                  key={post.id}
                  post={post}
                  size={gridItemSize}
                  onPress={() => handleGridItemPress(post)}
                  shouldPlay={index < MAX_PLAYING_VIDEOS}
                  showFollowButton={false}
                />
              ) : null
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

      <OnboardingTooltip
        visible={showOnboardingTooltip}
        onDismiss={handleDismissOnboarding}
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
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
