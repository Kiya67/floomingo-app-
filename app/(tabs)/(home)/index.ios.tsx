
import React, { useState, useCallback, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  useWindowDimensions,
  ImageSourcePropType,
} from "react-native";
import { supabase } from "@/lib/supabase";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { FilterModal } from "@/components/FilterModal";
import { authenticatedApiCall } from "@/utils/api";
import { OnboardingTooltip, shouldShowOnboardingTooltip } from "@/components/OnboardingTooltip";
import { VideoGridItem } from "@/components/VideoGridItem";

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

export default function HomeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { width: screenWidth } = useWindowDimensions();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [showOnboardingTooltip, setShowOnboardingTooltip] = useState(false);

  // Filter state
  const [filterPlaceId, setFilterPlaceId] = useState<string | null>(null);
  const [filterPlaceName, setFilterPlaceName] = useState<string | null>(null);
  const [filterKeywords, setFilterKeywords] = useState<string | null>(null);

  const activeFiltersCount = [filterPlaceId, filterKeywords].filter(Boolean).length;

  const GRID_COLUMNS = 3;
  const GRID_GAP = 1;
  const itemSize = (screenWidth - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

  useFocusEffect(
    useCallback(() => {
      const checkOnboarding = async () => {
        const shouldShow = await shouldShowOnboardingTooltip();
        console.log('HomeScreen (iOS) - Should show onboarding tooltip:', shouldShow);
        if (shouldShow) {
          setTimeout(() => setShowOnboardingTooltip(true), 500);
        }
      };
      checkOnboarding();
    }, [])
  );

  const fetchPosts = useCallback(async () => {
    console.log('Fetching moments (iOS) with filters:', { filterPlaceId, filterKeywords });
    try {
      let blockedUserIds: string[] = [];
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        try {
          const blocksData = await authenticatedApiCall<any[]>('/api/blocks', { method: 'GET' });
          console.log('[API iOS] Blocked users fetched for feed filtering:', blocksData.length);
          blockedUserIds = blocksData.map((block: any) =>
            block.blockerId === user.id ? block.blockedId : block.blockerId
          );
        } catch (error) {
          console.error('[API iOS] Error fetching blocked users:', error);
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

      if (filterPlaceId) {
        console.log('Applying place_id filter (iOS):', filterPlaceId);
        query = query.eq('place_id', filterPlaceId);
      }

      if (blockedUserIds.length > 0) {
        console.log('Filtering out blocked users from feed (iOS):', blockedUserIds.length);
        query = query.not('user_id', 'in', `(${blockedUserIds.join(',')})`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching moments (iOS):', error);
        setPosts([]);
      } else {
        let filteredData = Array.isArray(data) ? data : [];

        try {
          if (filterKeywords && filterKeywords.trim()) {
            const keywords = filterKeywords.toLowerCase().split(/[\s,]+/).filter(k => k.length > 0);
            console.log('Applying keyword filters (iOS):', keywords);
            filteredData = filteredData.filter(post => {
              const caption = (post?.caption ?? '').toLowerCase();
              const placeName = (post?.place_name ?? '').toLowerCase();
              const searchText = `${caption} ${placeName}`;
              return keywords.every(keyword => searchText.includes(keyword));
            });
          }

          console.log('Moments fetched successfully (iOS):', filteredData.length);
          setPosts(filteredData);
        } catch (filterError) {
          console.error('Error applying filter (iOS):', filterError);
          setPosts(filteredData);
        }
      }
    } catch (error) {
      console.error('Error in fetchPosts (iOS):', error);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [filterPlaceId, filterKeywords]);

  useEffect(() => {
    const hasPlaceFilter = params.filterPlaceId && params.filterPlaceId !== '';
    const hasKeywordsFilter = params.filterKeywords && params.filterKeywords !== '';
    if (hasPlaceFilter || hasKeywordsFilter) {
      console.log('Received filters from navigation (iOS):', { filterPlaceId: params.filterPlaceId, filterPlaceName: params.filterPlaceName, filterKeywords: params.filterKeywords });
      if (hasPlaceFilter) {
        setFilterPlaceId(params.filterPlaceId as string);
        setFilterPlaceName(params.filterPlaceName as string);
      } else {
        setFilterPlaceId(null);
        setFilterPlaceName(null);
      }
      if (hasKeywordsFilter) {
        setFilterKeywords(params.filterKeywords as string);
      } else {
        setFilterKeywords(null);
      }
    } else if (params.filterPlaceId === '' && params.filterPlaceName === '' && params.filterKeywords === '') {
      console.log('Received clear filters signal from navigation (iOS)');
      setFilterPlaceId(null);
      setFilterPlaceName(null);
      setFilterKeywords(null);
    }
  }, [params.filterPlaceId, params.filterPlaceName, params.filterKeywords]);

  useFocusEffect(
    useCallback(() => {
      console.log('HomeScreen (iOS) focused - re-fetching moments');
      fetchPosts();
    }, [fetchPosts])
  );

  const onRefresh = async () => {
    console.log('User pulled to refresh moments (iOS)');
    setRefreshing(true);
    await fetchPosts();
    setRefreshing(false);
  };

  const handleApplyFilters = (placeId: string | null, placeName: string | null, keywords: string | null) => {
    console.log('Applying filters (iOS):', { placeId, placeName, keywords });
    try {
      setFilterPlaceId(placeId);
      setFilterPlaceName(placeName);
      setFilterKeywords(keywords);
      setFilterModalVisible(false);
    } catch (error) {
      console.error('Error applying filters (iOS):', error);
      setFilterModalVisible(false);
    }
  };

  const handleClearFilters = () => {
    console.log('Clearing all filters (iOS)');
    try {
      setFilterPlaceId(null);
      setFilterPlaceName(null);
      setFilterKeywords(null);
      setFilterModalVisible(false);
    } catch (error) {
      console.error('Error clearing filters (iOS):', error);
      setFilterModalVisible(false);
    }
  };

  const handleDismissOnboarding = () => {
    console.log('HomeScreen (iOS) - Dismissing onboarding tooltip');
    setShowOnboardingTooltip(false);
  };

  const handlePostPress = (post: Post) => {
    console.log('User tapped video grid item (iOS):', post.id);
    router.push(`/video/${post.id}` as any);
  };

  const emptyText = activeFiltersCount > 0
    ? 'No moments found. Try clearing filters.'
    : 'No moments yet';

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B8A" />
      </View>
    );
  }

  if (posts.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.emptyText}>{emptyText}</Text>
        <Text style={styles.emptySubtext}>Check back soon for travel moments</Text>
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

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        numColumns={GRID_COLUMNS}
        renderItem={({ item }) => (
          <VideoGridItem
            post={item}
            size={itemSize}
            onPress={() => handlePostPress(item)}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: GRID_GAP }} />}
        columnWrapperStyle={{ gap: GRID_GAP }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FF6B8A"
            colors={['#FF6B8A']}
          />
        }
      />

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
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  emptyText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptySubtext: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 15,
    marginTop: 8,
    textAlign: 'center',
  },
});
