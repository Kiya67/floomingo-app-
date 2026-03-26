
import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
  StatusBar,
  Image,
  ImageSourcePropType,
  FlatList,
  Share,
  TouchableOpacity,
  useWindowDimensions,
  RefreshControl,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import {
  Heart,
  Bookmark,
  Share2,
  MapPin,
  Film,
  Play,
  Pause,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiGet, apiCall, BACKEND_URL } from "@/utils/api";

const PINK = "#FF3B7A";
const TAB_BAR_HEIGHT = 83;

interface MomentPlace {
  id: string;
  place_id: string;
  place_name: string;
  place_address?: string;
}

interface MomentUser {
  id: string;
  username: string;
  avatar_url?: string;
}

interface LinkedExperience {
  id: string;
  video_url: string;
  thumbnail_url?: string;
  title: string;
}

interface Moment {
  id: string;
  user_id: string;
  video_url: string;
  thumbnail_url?: string;
  caption?: string;
  linked_experience_id?: string;
  linked_experience?: LinkedExperience;
  likes_count: number;
  bookmarks_count: number;
  is_liked: boolean;
  is_bookmarked: boolean;
  places: MomentPlace[];
  user: MomentUser;
  created_at: string;
}

interface InteractionState {
  is_liked: boolean;
  is_bookmarked: boolean;
  likes_count: number;
  bookmarks_count: number;
}

function resolveImageSource(
  source: string | number | ImageSourcePropType | undefined
): ImageSourcePropType {
  if (!source) return { uri: "" };
  if (typeof source === "string") return { uri: source };
  return source as ImageSourcePropType;
}

function getInitials(name: string): string {
  if (!name) return "?";
  const parts = name.split(/[\s_]+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

// ─── FeedItem ────────────────────────────────────────────────────────────────

interface FeedItemProps {
  item: Moment;
  isActive: boolean;
  screenHeight: number;
  screenWidth: number;
  interaction: InteractionState;
  onLike: (moment: Moment) => void;
  onBookmark: (moment: Moment) => void;
  onShare: (moment: Moment) => void;
  onProfilePress: (userId: string) => void;
  onPlacePress: (placeId: string) => void;
}

function FeedItem({
  item,
  isActive,
  screenHeight,
  screenWidth,
  interaction,
  onLike,
  onBookmark,
  onShare,
  onProfilePress,
  onPlacePress,
}: FeedItemProps) {
  const isMountedRef = useRef(true);
  const [isPlaying, setIsPlaying] = useState(false);

  const player = useVideoPlayer(item.video_url || "", (p) => {
    p.loop = true;
    p.muted = false;
  });

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      try {
        if (player?.playing) player.pause();
      } catch {}
    };
  }, [player]);

  useEffect(() => {
    if (!player) return;
    if (isActive) {
      const t = setTimeout(() => {
        if (isMountedRef.current) {
          try {
            player.play();
            setIsPlaying(true);
            console.log("FeedItem: playing video for moment:", item.id);
          } catch (e) {
            console.error("FeedItem: error playing video:", e);
          }
        }
      }, 300);
      return () => clearTimeout(t);
    } else {
      try {
        player.pause();
        setIsPlaying(false);
      } catch {}
    }
  }, [isActive, player, item.id]);

  const handleTap = useCallback(() => {
    console.log("User tapped video - toggling play/pause, moment:", item.id);
    if (!player) return;
    try {
      if (player.playing) {
        player.pause();
        setIsPlaying(false);
      } else {
        player.play();
        setIsPlaying(true);
      }
    } catch {}
  }, [player, item.id]);

  const handlePlayPauseBtn = useCallback(() => {
    console.log(
      "User tapped pink play/pause button, moment:",
      item.id,
      "currently playing:",
      isPlaying
    );
    if (!player) return;
    try {
      if (player.playing) {
        player.pause();
        setIsPlaying(false);
      } else {
        player.play();
        setIsPlaying(true);
      }
    } catch {}
  }, [player, item.id, isPlaying]);

  const username = item.user?.username || "unknown";
  const avatarUrl = item.user?.avatar_url || "";
  const initials = getInitials(username);
  const likeColor = interaction.is_liked ? PINK : "#FFFFFF";
  const bookmarkColor = interaction.is_bookmarked ? PINK : "#FFFFFF";
  const likesText = String(Number(interaction.likes_count) || 0);
  const bookmarksText = String(Number(interaction.bookmarks_count) || 0);
  const captionText = item.caption || "";
  const PlayPauseIcon = isPlaying ? Pause : Play;
  const places = item.places || [];

  if (!item.video_url) return null;

  return (
    <View style={[styles.slide, { width: screenWidth, height: screenHeight }]}>
      {/* Video */}
      <TouchableOpacity
        style={[styles.videoContainer, { height: screenHeight }]}
        activeOpacity={1}
        onPress={handleTap}
      >
        <VideoView
          style={[styles.video, { height: screenHeight }]}
          player={player}
          nativeControls={false}
          contentFit="cover"
          allowsFullscreen={false}
          allowsPictureInPicture={false}
        />
      </TouchableOpacity>

      {/* Gradient overlay */}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.85)"]}
        style={styles.gradient}
        pointerEvents="none"
      />

      {/* RIGHT-CENTER: Pink play/pause button */}
      <TouchableOpacity
        style={styles.playPauseBtn}
        onPress={handlePlayPauseBtn}
        activeOpacity={0.85}
      >
        <PlayPauseIcon size={24} color="#FFFFFF" fill="#FFFFFF" strokeWidth={0} />
      </TouchableOpacity>

      {/* Bottom overlay */}
      <View style={[styles.bottomSection, { paddingBottom: TAB_BAR_HEIGHT + 16 }]}>
        {/* Left: user info + caption + places */}
        <View style={styles.leftContent}>
          <TouchableOpacity
            style={styles.userRow}
            onPress={() => onProfilePress(item.user_id)}
            activeOpacity={0.8}
          >
            {avatarUrl ? (
              <Image
                source={resolveImageSource(avatarUrl)}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            )}
            <Text style={styles.username}>@{username}</Text>
          </TouchableOpacity>

          {captionText ? (
            <Text style={styles.caption} numberOfLines={3}>
              {captionText}
            </Text>
          ) : null}

          {places.length > 0 ? (
            <View style={styles.placesRow}>
              {places.map((place) => (
                <TouchableOpacity
                  key={place.id}
                  style={styles.placePill}
                  onPress={() => onPlacePress(place.place_id)}
                  activeOpacity={0.8}
                >
                  <MapPin size={11} color="#FFFFFF" strokeWidth={2} />
                  <Text style={styles.placePillText} numberOfLines={1}>
                    {place.place_name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </View>

        {/* Right: action buttons */}
        <View style={styles.rightActions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => onLike(item)}
            activeOpacity={0.8}
          >
            <Heart
              size={28}
              color={likeColor}
              fill={interaction.is_liked ? PINK : "transparent"}
              strokeWidth={2}
            />
            <Text style={styles.actionCount}>{likesText}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => onBookmark(item)}
            activeOpacity={0.8}
          >
            <Bookmark
              size={28}
              color={bookmarkColor}
              fill={interaction.is_bookmarked ? PINK : "transparent"}
              strokeWidth={2}
            />
            <Text style={styles.actionCount}>{bookmarksText}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => onShare(item)}
            activeOpacity={0.8}
          >
            <Share2 size={28} color="#FFFFFF" strokeWidth={2} />
            <Text style={styles.actionCount}>Share</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── HomeScreen ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [feed, setFeed] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [interactions, setInteractions] = useState<Map<string, InteractionState>>(new Map());

  const flatListRef = useRef<FlatList>(null);
  const isMountedRef = useRef(true);

  const buildInteractions = useCallback(
    (moments: Moment[]): Map<string, InteractionState> => {
      const m = new Map<string, InteractionState>();
      moments.forEach((moment) => {
        m.set(moment.id, {
          is_liked: !!moment.is_liked,
          is_bookmarked: !!moment.is_bookmarked,
          likes_count: Number(moment.likes_count) || 0,
          bookmarks_count: Number(moment.bookmarks_count) || 0,
        });
      });
      return m;
    },
    []
  );

  const fetchMoments = useCallback(
    async (isRefresh = false, cursor: string | null = null) => {
      const cursorParam = cursor ? `&cursor=${encodeURIComponent(cursor)}` : "&cursor=";
      const endpoint = `/api/moments?limit=20${cursorParam}`;
      console.log(
        "Home: fetching moments from API, isRefresh:",
        isRefresh,
        "cursor:",
        cursor
      );
      try {
        const data = await apiGet<{ moments: Moment[]; next_cursor: string | null }>(endpoint);

        const moments = data.moments || [];
        const newNextCursor = data.next_cursor ?? null;
        console.log("Home: fetched", moments.length, "moments, next_cursor:", newNextCursor);

        const newInteractions = buildInteractions(moments);

        if (isRefresh || !cursor) {
          setFeed(moments);
          setInteractions(newInteractions);
        } else {
          setFeed((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const unique = moments.filter((m) => !existingIds.has(m.id));
            return [...prev, ...unique];
          });
          setInteractions((prev) => {
            const m = new Map(prev);
            newInteractions.forEach((v, k) => {
              if (!m.has(k)) m.set(k, v);
            });
            return m;
          });
        }

        setNextCursor(newNextCursor);
        setHasMore(!!newNextCursor);
        setError(null);
      } catch (e: any) {
        console.error("Home: fetch moments error:", e);
        setError("Couldn't load feed. Check your connection.");
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [buildInteractions]
  );

  const fetchMore = useCallback(async () => {
    if (loadingMore || !hasMore || !nextCursor) return;
    setLoadingMore(true);
    console.log("Home: loading more moments, cursor:", nextCursor);
    await fetchMoments(false, nextCursor);
  }, [loadingMore, hasMore, nextCursor, fetchMoments]);

  useFocusEffect(
    useCallback(() => {
      isMountedRef.current = true;
      console.log("HomeScreen focused - fetching moments from API");
      setLoading(true);
      setNextCursor(null);
      setHasMore(true);
      setCurrentIndex(0);
      fetchMoments(false, null);
      return () => {
        isMountedRef.current = false;
      };
    }, [fetchMoments])
  );

  const handleRefresh = useCallback(() => {
    console.log("User pulled to refresh feed");
    setRefreshing(true);
    setNextCursor(null);
    setHasMore(true);
    setCurrentIndex(0);
    fetchMoments(true, null);
  }, [fetchMoments]);

  const handleViewableItemsChanged = useCallback(
    ({ viewableItems }: any) => {
      if (viewableItems.length > 0) {
        const newIndex = viewableItems[0].index ?? 0;
        setCurrentIndex(newIndex);
        console.log("Home: visible moment index:", newIndex);
      }
    },
    []
  );

  const handleLike = useCallback(
    async (moment: Moment) => {
      console.log("User tapped like on moment:", moment.id);
      const cur = interactions.get(moment.id);
      if (!cur) return;
      const wasLiked = cur.is_liked;

      // Optimistic update
      setInteractions((prev) => {
        const m = new Map(prev);
        m.set(moment.id, {
          ...cur,
          is_liked: !wasLiked,
          likes_count: wasLiked
            ? Math.max(0, cur.likes_count - 1)
            : cur.likes_count + 1,
        });
        return m;
      });

      try {
        console.log("Home: POST /api/moments/:id/like, moment:", moment.id);
        const result = await apiCall<{ liked: boolean; likes_count: number }>(
          `/api/moments/${moment.id}/like`,
          { method: "POST" }
        );
        console.log("Home: like result:", result);
        setInteractions((prev) => {
          const m = new Map(prev);
          const existing = m.get(moment.id);
          if (existing) {
            m.set(moment.id, {
              ...existing,
              is_liked: result.liked,
              likes_count: Number(result.likes_count) || existing.likes_count,
            });
          }
          return m;
        });
      } catch (e) {
        console.error("Home: like error:", e);
        // Revert
        setInteractions((prev) => {
          const m = new Map(prev);
          m.set(moment.id, cur);
          return m;
        });
      }
    },
    [interactions]
  );

  const handleBookmark = useCallback(
    async (moment: Moment) => {
      console.log("User tapped bookmark on moment:", moment.id);
      const cur = interactions.get(moment.id);
      if (!cur) return;
      const wasBookmarked = cur.is_bookmarked;

      // Optimistic update
      setInteractions((prev) => {
        const m = new Map(prev);
        m.set(moment.id, {
          ...cur,
          is_bookmarked: !wasBookmarked,
          bookmarks_count: wasBookmarked
            ? Math.max(0, cur.bookmarks_count - 1)
            : cur.bookmarks_count + 1,
        });
        return m;
      });

      try {
        console.log("Home: POST /api/moments/:id/bookmark, moment:", moment.id);
        const result = await apiCall<{ bookmarked: boolean; bookmarks_count: number }>(
          `/api/moments/${moment.id}/bookmark`,
          { method: "POST" }
        );
        console.log("Home: bookmark result:", result);
        setInteractions((prev) => {
          const m = new Map(prev);
          const existing = m.get(moment.id);
          if (existing) {
            m.set(moment.id, {
              ...existing,
              is_bookmarked: result.bookmarked,
              bookmarks_count: Number(result.bookmarks_count) || existing.bookmarks_count,
            });
          }
          return m;
        });
      } catch (e) {
        console.error("Home: bookmark error:", e);
        // Revert
        setInteractions((prev) => {
          const m = new Map(prev);
          m.set(moment.id, cur);
          return m;
        });
      }
    },
    [interactions]
  );

  const handleShare = useCallback(async (moment: Moment) => {
    console.log("User tapped share on moment:", moment.id);
    try {
      const text = moment.caption || "Check out this moment on Floomingo!";
      await Share.share({ message: text, url: moment.video_url });
    } catch (e) {
      console.error("Home: share error:", e);
    }
  }, []);

  const handleProfilePress = useCallback(
    (userId: string) => {
      console.log("User tapped profile, userId:", userId);
      router.push(`/user/${userId}` as any);
    },
    [router]
  );

  const handlePlacePress = useCallback(
    (placeId: string) => {
      console.log("User tapped place pill, placeId:", placeId);
      router.push(`/location/${placeId}` as any);
    },
    [router]
  );

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const renderItem = useCallback(
    ({ item, index }: { item: Moment; index: number }) => {
      if (!item?.video_url) return null;
      const isActive = index === currentIndex;
      const interaction = interactions.get(item.id) ?? {
        is_liked: false,
        is_bookmarked: false,
        likes_count: 0,
        bookmarks_count: 0,
      };
      return (
        <FeedItem
          item={item}
          isActive={isActive}
          screenHeight={height}
          screenWidth={width}
          interaction={interaction}
          onLike={handleLike}
          onBookmark={handleBookmark}
          onShare={handleShare}
          onProfilePress={handleProfilePress}
          onPlacePress={handlePlacePress}
        />
      );
    },
    [
      currentIndex,
      interactions,
      height,
      width,
      handleLike,
      handleBookmark,
      handleShare,
      handleProfilePress,
      handlePlacePress,
    ]
  );


  // ── Loading state ──
  if (loading) {
    return (
      <View style={styles.center}>
        <StatusBar hidden />
        <ActivityIndicator size="large" color={PINK} />
        <Text style={styles.loadingText}>Loading feed…</Text>
      </View>
    );
  }

  // ── Error state ──
  if (error) {
    return (
      <View style={styles.center}>
        <StatusBar hidden />
        <Film size={48} color="rgba(255,255,255,0.3)" strokeWidth={1.5} />
        <Text style={styles.emptyTitle}>Couldn't load feed</Text>
        <Text style={styles.emptySubtitle}>{error}</Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => {
            console.log("User tapped retry on feed");
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
      <View style={styles.center}>
        <StatusBar hidden />
        <Film size={48} color="rgba(255,255,255,0.3)" strokeWidth={1.5} />
        <Text style={styles.emptyTitle}>Nothing here yet</Text>
        <Text style={styles.emptySubtitle}>
          Be the first to share a moment on Floomingo
        </Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => {
            console.log("User tapped refresh on empty feed");
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
    <View style={styles.container}>
      <StatusBar hidden />
      <FlatList
        ref={flatListRef}
        data={feed}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={height}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={handleViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onEndReached={fetchMore}
        onEndReachedThreshold={0.5}
        removeClippedSubviews
        maxToRenderPerBatch={2}
        windowSize={3}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={PINK}
          />
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={[styles.footerLoader, { height }]}>
              <ActivityIndicator size="large" color={PINK} />
            </View>
          ) : null
        }
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
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
  slide: { backgroundColor: "#000" },
  videoContainer: { width: "100%", position: "absolute" },
  video: { width: "100%", position: "absolute" },
  gradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "50%",
  },
  playPauseBtn: {
    position: "absolute",
    right: 16,
    top: "50%",
    transform: [{ translateY: -28 }],
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: PINK,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: PINK,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
  },
  bottomSection: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    gap: 12,
  },
  leftContent: { flex: 1, gap: 8 },
  userRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#333" },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: PINK,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitials: { fontSize: 13, fontWeight: "700", color: "#FFF" },
  username: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFF",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  caption: {
    fontSize: 14,
    color: "rgba(255,255,255,0.92)",
    lineHeight: 20,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  placesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  placePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: PINK,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  placePillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFF",
    maxWidth: 120,
  },
  rightActions: { gap: 22, alignItems: "center", paddingBottom: 4 },
  actionBtn: { alignItems: "center", gap: 4 },
  actionCount: {
    fontSize: 12,
    color: "#FFF",
    fontWeight: "600",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
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
  retryBtnText: { fontSize: 15, fontWeight: "700", color: "#FFF" },
  footerLoader: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
});
