
import React, { useState, useCallback, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  useWindowDimensions,
  RefreshControl,
  ImageSourcePropType,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Film } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiGet } from "@/utils/api";
import { VideoGridItem } from "@/components/VideoGridItem";

const PINK = "#FF3B7A";
const NUM_COLUMNS = 3;
const GRID_GAP = 2;

interface MomentPlace {
  id: string;
  place_id: string;
  place_name: string;
}

interface MomentUser {
  id: string;
  username: string;
  avatar_url?: string;
}

interface Moment {
  id: string;
  user_id: string;
  video_url: string;
  thumbnail_url?: string;
  caption?: string;
  likes_count: number;
  bookmarks_count: number;
  is_liked: boolean;
  is_bookmarked: boolean;
  places: MomentPlace[];
  user: MomentUser;
  created_at: string;
  view_count?: number;
}

// Adapter: map Moment to the Post shape VideoGridItem expects
function momentToPost(moment: Moment) {
  return {
    id: moment.id,
    user_id: moment.user_id,
    video_url: moment.video_url,
    thumbnail_url: moment.thumbnail_url || "",
    caption: moment.caption || "",
    place_id: moment.places?.[0]?.place_id ?? null,
    place_name: moment.places?.[0]?.place_name ?? null,
    location_type: null,
    created_at: moment.created_at,
    view_count: moment.view_count,
  };
}

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [feed, setFeed] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const itemSize = (width - GRID_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

  const fetchMoments = useCallback(
    async (isRefresh = false, cursor: string | null = null) => {
      const cursorParam = cursor ? `&cursor=${encodeURIComponent(cursor)}` : "&cursor=";
      const endpoint = `/api/moments?limit=30${cursorParam}`;
      console.log(
        "Home grid: fetching moments from API, isRefresh:",
        isRefresh,
        "cursor:",
        cursor
      );
      try {
        const data = await apiGet<{ moments: Moment[]; next_cursor: string | null }>(endpoint);
        const moments = data.moments || [];
        const newNextCursor = data.next_cursor ?? null;
        console.log("Home grid: fetched", moments.length, "moments, next_cursor:", newNextCursor);

        if (isRefresh || !cursor) {
          setFeed(moments);
        } else {
          setFeed((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const unique = moments.filter((m) => !existingIds.has(m.id));
            return [...prev, ...unique];
          });
        }

        setNextCursor(newNextCursor);
        setHasMore(!!newNextCursor);
        setError(null);
      } catch (e: any) {
        console.error("Home grid: fetch moments error:", e);
        setError("Couldn't load videos. Check your connection.");
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    []
  );

  const fetchMore = useCallback(async () => {
    if (loadingMore || !hasMore || !nextCursor) return;
    setLoadingMore(true);
    console.log("Home grid: loading more moments, cursor:", nextCursor);
    await fetchMoments(false, nextCursor);
  }, [loadingMore, hasMore, nextCursor, fetchMoments]);

  useFocusEffect(
    useCallback(() => {
      console.log("HomeScreen focused - fetching moments grid from API");
      setLoading(true);
      setNextCursor(null);
      setHasMore(true);
      fetchMoments(false, null);
    }, [fetchMoments])
  );

  const handleRefresh = useCallback(() => {
    console.log("User pulled to refresh home grid");
    setRefreshing(true);
    setNextCursor(null);
    setHasMore(true);
    fetchMoments(true, null);
  }, [fetchMoments]);

  const handleItemPress = useCallback(
    (moment: Moment) => {
      console.log("User tapped video grid item, moment id:", moment.id);
      router.push(`/video/${moment.id}` as any);
    },
    [router]
  );

  const renderItem = useCallback(
    ({ item }: { item: Moment }) => {
      if (!item?.video_url && !item?.thumbnail_url) return null;
      const post = momentToPost(item);
      return (
        <VideoGridItem
          post={post}
          size={itemSize}
          onPress={() => handleItemPress(item)}
          showViewCount
        />
      );
    },
    [itemSize, handleItemPress]
  );

  const keyExtractor = useCallback((item: Moment) => item.id, []);

  const ItemSeparator = useCallback(
    () => <View style={{ height: GRID_GAP }} />,
    []
  );

  // ── Loading state ──
  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={PINK} />
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  // ── Error state ──
  if (error) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Film size={48} color="rgba(255,255,255,0.3)" strokeWidth={1.5} />
        <Text style={styles.emptyTitle}>Couldn't load videos</Text>
        <Text style={styles.emptySubtitle}>{error}</Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => {
            console.log("User tapped retry on home grid");
            setLoading(true);
            setNextCursor(null);
            fetchMoments(false, null);
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.retryBtnText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Empty state ──
  if (feed.length === 0) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Film size={48} color="rgba(255,255,255,0.3)" strokeWidth={1.5} />
        <Text style={styles.emptyTitle}>Nothing here yet</Text>
        <Text style={styles.emptySubtitle}>
          Be the first to share a moment on Floomingo
        </Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => {
            console.log("User tapped refresh on empty home grid");
            setLoading(true);
            setNextCursor(null);
            fetchMoments(false, null);
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.retryBtnText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <FlatList
        data={feed}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        numColumns={NUM_COLUMNS}
        columnWrapperStyle={styles.row}
        ItemSeparatorComponent={ItemSeparator}
        showsVerticalScrollIndicator={false}
        onEndReached={fetchMore}
        onEndReachedThreshold={0.5}
        removeClippedSubviews
        maxToRenderPerBatch={12}
        windowSize={5}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={PINK}
          />
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color={PINK} />
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  center: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
  },
  row: {
    gap: GRID_GAP,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFF",
    marginTop: 16,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
    marginTop: 8,
    textAlign: "center",
    lineHeight: 20,
  },
  retryBtn: {
    marginTop: 20,
    backgroundColor: PINK,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFF",
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: "center",
  },
});
