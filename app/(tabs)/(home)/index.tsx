
import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  FlatList,
  useWindowDimensions,
  Image,
  ImageSourcePropType,
  Share,
} from "react-native";
import { supabase } from "@/lib/supabase";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { FilterModal } from "@/components/FilterModal";
import { authenticatedApiCall, authenticatedPost, authenticatedDelete } from "@/utils/api";
import { OnboardingTooltip, shouldShowOnboardingTooltip } from "@/components/OnboardingTooltip";
import { useVideoPlayer, VideoView } from "expo-video";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Heart, MessageCircle, Bookmark, Send, MoreHorizontal, MapPin } from "lucide-react-native";

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

function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: '' };
  if (typeof source === 'string') return { uri: source };
  return source as ImageSourcePropType;
}

interface MomentItemProps {
  item: Post;
  isVisible: boolean;
  screenHeight: number;
  screenWidth: number;
  insets: { top: number; bottom: number };
  onFilterPress: () => void;
}

function MomentItem({ item, isVisible, screenHeight, screenWidth, insets }: MomentItemProps) {
  const router = useRouter();
  const player = useVideoPlayer(item.video_url || '', (p) => {
    p.loop = true;
    p.muted = false;
  });

  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    if (isVisible) {
      player.play();
    } else {
      player.pause();
    }
  }, [isVisible]);

  const displayName = item.profiles?.display_name || 'Unknown';
  const avatarUrl = item.profiles?.avatar_url || '';
  const placeName = item.place_name || '';
  const caption = item.caption || '';
  const avatarInitial = displayName.charAt(0).toUpperCase();

  const likeIconColor = liked ? '#FF6B8A' : '#FFFFFF';
  const followPillStyle = following ? styles.followPillActive : styles.followPill;
  const followTextStyle = following ? styles.followTextActive : styles.followText;
  const followLabel = following ? 'Following' : 'Follow';

  const handleUserPress = () => {
    console.log('User tapped avatar/username, navigating to user:', item.user_id);
    router.push(`/user/${item.user_id}`);
  };

  const handleLikePress = () => {
    const newLiked = !liked;
    const newCount = newLiked ? likeCount + 1 : Math.max(0, likeCount - 1);
    console.log('User tapped like on moment:', item.id, '— liked:', newLiked);
    setLiked(newLiked);
    setLikeCount(newCount);
    authenticatedPost('/api/rpc/toggle-like', { post_id: item.id }).catch((err) => {
      console.error('Error toggling like:', err);
    });
  };

  const handleCommentPress = () => {
    console.log('User tapped comment on moment:', item.id);
    router.push(`/video/${item.id}`);
  };

  const handleBookmarkPress = () => {
    console.log('User tapped bookmark on moment:', item.id);
    router.push(`/video/${item.id}`);
  };

  const handleSharePress = async () => {
    console.log('User tapped share on moment:', item.id);
    try {
      await Share.share({
        message: 'Check out this moment on Floomingo!',
        url: `https://floomingo.app/video/${item.id}`,
      });
    } catch (err) {
      console.error('Error sharing moment:', err);
    }
  };

  const handleMorePress = () => {
    console.log('User tapped more on moment:', item.id);
    router.push(`/video/${item.id}`);
  };

  const handleFollowPress = () => {
    const newFollowing = !following;
    console.log('User tapped follow on moment:', item.id, 'user:', item.user_id, '— following:', newFollowing);
    setFollowing(newFollowing);
    if (newFollowing) {
      authenticatedPost('/api/follows', { followingId: item.user_id }).catch((err) => {
        console.error('Error following user:', err);
        setFollowing(false);
      });
    } else {
      authenticatedDelete(`/api/follows/${item.user_id}`).catch((err) => {
        console.error('Error unfollowing user:', err);
        setFollowing(true);
      });
    }
  };

  const handleLocationPress = () => {
    if (!item.place_id) return;
    const encodedName = encodeURIComponent(item.place_name || '');
    console.log('User tapped location:', item.place_name, '— navigating to location:', item.place_id);
    router.push(`/location/${item.place_id}?name=${encodedName}`);
  };

  const bottomPadding = insets.bottom + 60;

  return (
    <View style={{ width: screenWidth, height: screenHeight }}>
      {/* Full-screen video */}
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
      />

      {/* Top gradient */}
      <LinearGradient
        colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0)']}
        style={[styles.topGradient, { height: screenHeight * 0.15 }]}
        pointerEvents="none"
      />

      {/* Bottom gradient */}
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.7)']}
        style={[styles.bottomGradient, { height: screenHeight * 0.4 }]}
        pointerEvents="none"
      />

      {/* Location pill — absolutely positioned top-right of bottom overlay */}
      {placeName ? (
        <TouchableOpacity
          style={[styles.locationPill, { bottom: bottomPadding + 80 }]}
          onPress={handleLocationPress}
          activeOpacity={0.7}
        >
          <MapPin size={13} color="#FF6B8A" />
          <Text style={styles.locationText}>{placeName}</Text>
        </TouchableOpacity>
      ) : null}

      {/* Bottom overlay */}
      <View style={[styles.bottomOverlay, { bottom: bottomPadding }]}>
        {/* Row 1: user info */}
        <View style={styles.userRow}>
          <TouchableOpacity onPress={handleUserPress} activeOpacity={0.8}>
            {avatarUrl ? (
              <Image source={resolveImageSource(avatarUrl)} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>{avatarInitial}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={handleUserPress} activeOpacity={0.8}>
            <Text style={styles.username}>{displayName}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={followPillStyle} onPress={handleFollowPress} activeOpacity={0.7}>
            <Text style={followTextStyle}>{followLabel}</Text>
          </TouchableOpacity>
        </View>

        {/* Row 2: caption */}
        {caption ? (
          <Text style={styles.captionText} numberOfLines={2}>{caption}</Text>
        ) : null}

        {/* Row 3: action buttons */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleLikePress} activeOpacity={0.7}>
            <Heart size={24} color={likeIconColor} fill={liked ? '#FF6B8A' : 'transparent'} />
            <Text style={styles.actionCount}>{likeCount}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={handleCommentPress} activeOpacity={0.7}>
            <MessageCircle size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={handleBookmarkPress} activeOpacity={0.7}>
            <Bookmark size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={handleSharePress} activeOpacity={0.7}>
            <Send size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={handleMorePress} activeOpacity={0.7}>
            <MoreHorizontal size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [showOnboardingTooltip, setShowOnboardingTooltip] = useState(false);
  const [visibleIndex, setVisibleIndex] = useState(0);

  // Filter state
  const [filterPlaceId, setFilterPlaceId] = useState<string | null>(null);
  const [filterPlaceName, setFilterPlaceName] = useState<string | null>(null);
  const [filterKeywords, setFilterKeywords] = useState<string | null>(null);

  const activeFiltersCount = [filterPlaceId, filterKeywords].filter(Boolean).length;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 80 }).current;

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setVisibleIndex(viewableItems[0].index ?? 0);
    }
  }).current;

  useFocusEffect(
    useCallback(() => {
      const checkOnboarding = async () => {
        const shouldShow = await shouldShowOnboardingTooltip();
        console.log('HomeScreen - Should show onboarding tooltip:', shouldShow);
        if (shouldShow) {
          setTimeout(() => setShowOnboardingTooltip(true), 500);
        }
      };
      checkOnboarding();
    }, [])
  );

  const fetchPosts = useCallback(async () => {
    console.log('Fetching moments with filters:', { filterPlaceId, filterKeywords });
    try {
      let blockedUserIds: string[] = [];
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        try {
          const blocksData = await authenticatedApiCall<any[]>('/api/blocks', { method: 'GET' });
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

      if (filterPlaceId) {
        console.log('Applying place_id filter:', filterPlaceId);
        query = query.eq('place_id', filterPlaceId);
      }

      if (blockedUserIds.length > 0) {
        console.log('Filtering out blocked users from feed:', blockedUserIds.length);
        query = query.not('user_id', 'in', `(${blockedUserIds.join(',')})`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching moments:', error);
        setPosts([]);
      } else {
        let filteredData = Array.isArray(data) ? data : [];

        try {
          if (filterKeywords && filterKeywords.trim()) {
            const keywords = filterKeywords.toLowerCase().split(/[\s,]+/).filter(k => k.length > 0);
            console.log('Applying keyword filters:', keywords);
            filteredData = filteredData.filter(post => {
              const caption = (post?.caption ?? '').toLowerCase();
              const placeName = (post?.place_name ?? '').toLowerCase();
              const searchText = `${caption} ${placeName}`;
              return keywords.every(keyword => searchText.includes(keyword));
            });
          }

          console.log('Moments fetched successfully:', filteredData.length);
          setPosts(filteredData);
        } catch (filterError) {
          console.error('Error applying filter:', filterError);
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

  useEffect(() => {
    if (params.filterPlaceId) {
      console.log('Received filter location from search:', params.filterPlaceName);
      setFilterPlaceId(params.filterPlaceId as string);
      setFilterPlaceName(params.filterPlaceName as string);
      setFilterModalVisible(true);
    }
  }, [params.filterPlaceId, params.filterPlaceName]);

  useFocusEffect(
    useCallback(() => {
      console.log('HomeScreen focused - re-fetching moments');
      fetchPosts();
    }, [fetchPosts])
  );

  const onRefresh = async () => {
    console.log('User pulled to refresh moments');
    setRefreshing(true);
    await fetchPosts();
    setRefreshing(false);
  };

  const handleFilterPress = () => {
    console.log('User tapped filter icon on feed');
    setFilterModalVisible(true);
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
    ? 'No moments found. Try clearing filters.'
    : 'No moments yet';

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: '#000' }]}>
        <ActivityIndicator size="large" color="#FF6B8A" />
      </View>
    );
  }

  if (posts.length === 0) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: '#000' }]}>
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
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <MomentItem
            item={item}
            isVisible={index === visibleIndex}
            screenHeight={screenHeight}
            screenWidth={screenWidth}
            insets={insets}
            onFilterPress={handleFilterPress}
          />
        )}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={screenHeight}
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FF6B8A"
            colors={['#FF6B8A']}
          />
        }
        getItemLayout={(_, index) => ({
          length: screenHeight,
          offset: screenHeight * index,
          index,
        })}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  bottomOverlay: {
    position: 'absolute',
    left: 12,
    right: 12,
    gap: 8,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF6B8A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  username: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  followPill: {
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  followPillActive: {
    borderWidth: 1.5,
    borderColor: '#FF6B8A',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: '#FF6B8A',
  },
  followText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  followTextActive: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  captionText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginTop: 4,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionCount: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  locationPill: {
    position: 'absolute',
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    color: '#FF6B8A',
    fontSize: 13,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
