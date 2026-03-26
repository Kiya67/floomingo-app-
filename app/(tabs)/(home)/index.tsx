
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
  ScrollView,
  useWindowDimensions,
  RefreshControl,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import {
  Heart,
  MessageCircle,
  Bookmark,
  Share2,
  MapPin,
  Film,
  SlidersHorizontal,
  Play,
  Pause,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { FilterModal } from "@/components/FilterModal";

const PINK = "#FF3B7A";
const TAB_BAR_HEIGHT = 83;
const PAGE_SIZE = 10;

interface PostProfile {
  id: string;
  username: string;
  avatar_url?: string | null;
}

interface PostLike {
  user_id: string;
}

interface PostStats {
  likes_count: number;
  comments_count: number;
  bookmarks_count: number;
}

interface Post {
  id: string;
  video_url: string;
  thumbnail_url?: string | null;
  caption?: string | null;
  created_at: string;
  view_count?: number | null;
  user_id: string;
  profiles: PostProfile | null;
  post_likes: PostLike[];
  post_stats: PostStats | null;
}

interface InteractionState {
  is_liked: boolean;
  is_bookmarked: boolean;
  likes_count: number;
  comments_count: number;
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
  item: Post;
  isActive: boolean;
  screenHeight: number;
  screenWidth: number;
  insetTop: number;
  interaction: InteractionState;
  onLike: (post: Post) => void;
  onBookmark: (post: Post) => void;
  onShare: (post: Post) => void;
  onComment: (post: Post) => void;
  onProfilePress: (userId: string) => void;
  onFilterPress: () => void;
}

function FeedItem({
  item,
  isActive,
  screenHeight,
  screenWidth,
  insetTop,
  interaction,
  onLike,
  onBookmark,
  onShare,
  onComment,
  onProfilePress,
  onFilterPress,
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
            console.log("FeedItem: playing video for post:", item.id);
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
    console.log("User tapped video - toggling play/pause, post:", item.id);
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
      "User tapped pink play/pause button, post:",
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

  const username = item.profiles?.username || "unknown";
  const avatarUrl = item.profiles?.avatar_url || "";
  const initials = getInitials(username);
  const likeColor = interaction.is_liked ? PINK : "#FFFFFF";
  const bookmarkColor = interaction.is_bookmarked ? PINK : "#FFFFFF";
  const likesText = String(Number(interaction.likes_count) || 0);
  const commentsText = String(Number(interaction.comments_count) || 0);
  const bookmarksText = String(Number(interaction.bookmarks_count) || 0);
  const captionText = item.caption || "";
  const PlayPauseIcon = isPlaying ? Pause : Play;
  const filterBtnTop = insetTop + 12;

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

      {/* TOP-LEFT: Filter button */}
      <TouchableOpacity
        style={[styles.filterBtn, { top: filterBtnTop }]}
        onPress={onFilterPress}
        activeOpacity={0.8}
      >
        <SlidersHorizontal size={20} color="#FFFFFF" strokeWidth={2} />
      </TouchableOpacity>

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
            onPress={() => onComment(item)}
            activeOpacity={0.8}
          >
            <MessageCircle size={28} color="#FFFFFF" strokeWidth={2} />
            <Text style={styles.actionCount}>{commentsText}</Text>
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

  const [feed, setFeed] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [interactions, setInteractions] = useState<Map<string, InteractionState>>(new Map());
  const [filterVisible, setFilterVisible] = useState(false);
  const [filterPlaceId, setFilterPlaceId] = useState<string | null>(null);
  const [filterPlaceName, setFilterPlaceName] = useState<string | null>(null);
  const [filterKeywords, setFilterKeywords] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
  }, []);

  const buildInteractions = useCallback(
    (posts: Post[], userId: string | null): Map<string, InteractionState> => {
      const m = new Map<string, InteractionState>();
      posts.forEach((post) => {
        const isLiked = userId
          ? (post.post_likes || []).some((l) => l.user_id === userId)
          : false;
        const stats = post.post_stats;
        m.set(post.id, {
          is_liked: isLiked,
          is_bookmarked: false,
          likes_count: Number(stats?.likes_count) || 0,
          comments_count: Number(stats?.comments_count) || 0,
          bookmarks_count: Number(stats?.bookmarks_count) || 0,
        });
      });
      return m;
    },
    []
  );

  const fetchBookmarkStates = useCallback(
    async (posts: Post[], userId: string) => {
      if (!posts.length) return;
      const postIds = posts.map((p) => p.id);
      try {
        const { data } = await supabase
          .from("board_posts")
          .select("post_id, boards!inner(user_id)")
          .in("post_id", postIds)
          .eq("boards.user_id", userId);

        if (data && data.length > 0) {
          const savedIds = new Set(data.map((d: any) => d.post_id));
          setInteractions((prev) => {
            const m = new Map(prev);
            savedIds.forEach((id) => {
              const existing = m.get(id as string);
              if (existing) {
                m.set(id as string, { ...existing, is_bookmarked: true });
              }
            });
            return m;
          });
        }
      } catch (e) {
        console.error("Home: fetchBookmarkStates error:", e);
      }
    },
    []
  );

  const fetchPosts = useCallback(
    async (isRefresh = false, currentOffset = 0) => {
      console.log(
        "Home: fetching posts from Supabase, isRefresh:",
        isRefresh,
        "offset:",
        currentOffset
      );
      try {
        const { data, error: fetchError } = await supabase
          .from("posts")
          .select(
            `
            id, video_url, thumbnail_url, caption, created_at, view_count,
            user_id,
            profiles:user_id (id, username, avatar_url),
            post_likes (user_id),
            post_stats (likes_count, comments_count, bookmarks_count)
          `
          )
          .order("created_at", { ascending: false })
          .range(currentOffset, currentOffset + PAGE_SIZE - 1);

        if (fetchError) {
          console.error("Home: Supabase fetch error:", fetchError);
          throw fetchError;
        }

        const posts = (data || []) as unknown as Post[];
        console.log("Home: fetched", posts.length, "posts");

        const { data: { user } } = await supabase.auth.getUser();
        const uid = user?.id || null;
        if (uid && !currentUserId) setCurrentUserId(uid);

        const newInteractions = buildInteractions(posts, uid);

        if (isRefresh || currentOffset === 0) {
          setFeed(posts);
          setInteractions(newInteractions);
        } else {
          setFeed((prev) => {
            const existingIds = new Set(prev.map((p) => p.id));
            const unique = posts.filter((p) => !existingIds.has(p.id));
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

        setHasMore(posts.length === PAGE_SIZE);
        setOffset(currentOffset + posts.length);
        setError(null);

        if (uid && posts.length > 0) {
          fetchBookmarkStates(posts, uid);
        }
      } catch (e: any) {
        console.error("Home: fetch error:", e);
        setError("Couldn't load feed. Check your connection.");
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [buildInteractions, fetchBookmarkStates, currentUserId]
  );

  const fetchMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    console.log("Home: loading more posts, offset:", offset);
    await fetchPosts(false, offset);
  }, [loadingMore, hasMore, offset, fetchPosts]);

  useFocusEffect(
    useCallback(() => {
      isMountedRef.current = true;
      console.log("HomeScreen focused - fetching posts from Supabase");
      setLoading(true);
      setOffset(0);
      setHasMore(true);
      setCurrentIndex(0);
      fetchPosts(false, 0);
      return () => {
        isMountedRef.current = false;
      };
    }, [fetchPosts])
  );

  const handleRefresh = useCallback(() => {
    console.log("User pulled to refresh feed");
    setRefreshing(true);
    setOffset(0);
    setHasMore(true);
    setCurrentIndex(0);
    fetchPosts(true, 0);
  }, [fetchPosts]);

  const handleViewableItemsChanged = useCallback(
    ({ viewableItems }: any) => {
      if (viewableItems.length > 0) {
        const newIndex = viewableItems[0].index ?? 0;
        setCurrentIndex(newIndex);
        console.log("Home: visible post index:", newIndex);
      }
    },
    []
  );

  const handleLike = useCallback(
    async (post: Post) => {
      console.log("User tapped like on post:", post.id);
      if (!currentUserId) {
        console.log("Home: like skipped - not authenticated");
        return;
      }
      const cur = interactions.get(post.id);
      if (!cur) return;
      const wasLiked = cur.is_liked;

      // Optimistic update
      setInteractions((prev) => {
        const m = new Map(prev);
        m.set(post.id, {
          ...cur,
          is_liked: !wasLiked,
          likes_count: wasLiked
            ? Math.max(0, cur.likes_count - 1)
            : cur.likes_count + 1,
        });
        return m;
      });

      try {
        if (wasLiked) {
          console.log("Home: unliking post via Supabase:", post.id);
          const { error } = await supabase
            .from("post_likes")
            .delete()
            .eq("post_id", post.id)
            .eq("user_id", currentUserId);
          if (error) throw error;
        } else {
          console.log("Home: liking post via Supabase:", post.id);
          const { error } = await supabase
            .from("post_likes")
            .insert({ post_id: post.id, user_id: currentUserId });
          if (error) throw error;
        }
      } catch (e) {
        console.error("Home: like error:", e);
        // Revert
        setInteractions((prev) => {
          const m = new Map(prev);
          m.set(post.id, cur);
          return m;
        });
      }
    },
    [currentUserId, interactions]
  );

  const handleBookmark = useCallback(
    async (post: Post) => {
      console.log("User tapped bookmark on post:", post.id);
      if (!currentUserId) {
        console.log("Home: bookmark skipped - not authenticated");
        return;
      }
      const cur = interactions.get(post.id);
      if (!cur) return;
      const wasBookmarked = cur.is_bookmarked;

      // Optimistic update
      setInteractions((prev) => {
        const m = new Map(prev);
        m.set(post.id, {
          ...cur,
          is_bookmarked: !wasBookmarked,
          bookmarks_count: wasBookmarked
            ? Math.max(0, cur.bookmarks_count - 1)
            : cur.bookmarks_count + 1,
        });
        return m;
      });

      try {
        if (wasBookmarked) {
          console.log("Home: removing bookmark via Supabase:", post.id);
          const { error } = await supabase
            .from("board_posts")
            .delete()
            .eq("post_id", post.id);
          if (error) throw error;
        } else {
          // Get or create default board for user
          console.log("Home: bookmarking post via Supabase:", post.id);
          let { data: boards } = await supabase
            .from("boards")
            .select("id")
            .eq("user_id", currentUserId)
            .limit(1);

          let boardId: string | null = boards?.[0]?.id || null;

          if (!boardId) {
            const { data: newBoard, error: boardError } = await supabase
              .from("boards")
              .insert({ user_id: currentUserId, name: "Saved" })
              .select("id")
              .single();
            if (boardError) throw boardError;
            boardId = newBoard?.id || null;
          }

          if (boardId) {
            const { error } = await supabase
              .from("board_posts")
              .insert({ board_id: boardId, post_id: post.id });
            if (error) throw error;
          }
        }
      } catch (e) {
        console.error("Home: bookmark error:", e);
        // Revert
        setInteractions((prev) => {
          const m = new Map(prev);
          m.set(post.id, cur);
          return m;
        });
      }
    },
    [currentUserId, interactions]
  );

  const handleShare = useCallback(async (post: Post) => {
    console.log("User tapped share on post:", post.id);
    try {
      const text = post.caption || "Check out this post on Floomingo!";
      await Share.share({ message: text, url: post.video_url });
    } catch (e) {
      console.error("Home: share error:", e);
    }
  }, []);

  const handleComment = useCallback(
    (post: Post) => {
      console.log("User tapped comment on post:", post.id, "- navigating to video");
      router.push(`/video/${post.id}` as any);
    },
    [router]
  );

  const handleProfilePress = useCallback(
    (userId: string) => {
      console.log("User tapped profile, userId:", userId);
      router.push(`/user/${userId}` as any);
    },
    [router]
  );

  const handleFilterPress = useCallback(() => {
    console.log("User tapped filter button");
    setFilterVisible(true);
  }, []);

  const handleFilterClose = useCallback(() => {
    console.log("User closed filter modal");
    setFilterVisible(false);
  }, []);

  const handleFilterApply = useCallback(
    (
      placeId: string | null,
      placeName: string | null,
      keywords: string | null
    ) => {
      console.log(
        "User applied filters — placeId:",
        placeId,
        "placeName:",
        placeName,
        "keywords:",
        keywords
      );
      setFilterPlaceId(placeId);
      setFilterPlaceName(placeName);
      setFilterKeywords(keywords);
      setFilterVisible(false);
      setLoading(true);
      setOffset(0);
      setHasMore(true);
      setCurrentIndex(0);
      fetchPosts(false, 0);
    },
    [fetchPosts]
  );

  const handleFilterClear = useCallback(() => {
    console.log("User cleared filters");
    setFilterPlaceId(null);
    setFilterPlaceName(null);
    setFilterKeywords(null);
    setFilterVisible(false);
    setLoading(true);
    setOffset(0);
    setHasMore(true);
    setCurrentIndex(0);
    fetchPosts(false, 0);
  }, [fetchPosts]);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const renderItem = useCallback(
    ({ item, index }: { item: Post; index: number }) => {
      if (!item?.video_url) return null;
      const isActive = index === currentIndex;
      const interaction = interactions.get(item.id) ?? {
        is_liked: false,
        is_bookmarked: false,
        likes_count: 0,
        comments_count: 0,
        bookmarks_count: 0,
      };
      return (
        <FeedItem
          item={item}
          isActive={isActive}
          screenHeight={height}
          screenWidth={width}
          insetTop={insets.top}
          interaction={interaction}
          onLike={handleLike}
          onBookmark={handleBookmark}
          onShare={handleShare}
          onComment={handleComment}
          onProfilePress={handleProfilePress}
          onFilterPress={handleFilterPress}
        />
      );
    },
    [
      currentIndex,
      interactions,
      height,
      width,
      insets.top,
      handleLike,
      handleBookmark,
      handleShare,
      handleComment,
      handleProfilePress,
      handleFilterPress,
    ]
  );

  const hasActiveFilter = !!(filterPlaceId || filterKeywords);

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
            setOffset(0);
            fetchPosts(false, 0);
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
          Be the first to share a post on Floomingo
        </Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => {
            console.log("User tapped refresh on empty feed");
            setLoading(true);
            setOffset(0);
            fetchPosts(false, 0);
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.retryBtnText}>Refresh</Text>
        </TouchableOpacity>
        <FilterModal
          visible={filterVisible}
          onClose={handleFilterClose}
          onApply={handleFilterApply}
          onClear={handleFilterClear}
          initialPlaceId={filterPlaceId}
          initialPlaceName={filterPlaceName}
          initialKeywords={filterKeywords}
        />
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

      {/* Active filter indicator */}
      {hasActiveFilter ? (
        <View style={[styles.activeFilterBadge, { top: insets.top + 12 }]} />
      ) : null}

      <FilterModal
        visible={filterVisible}
        onClose={handleFilterClose}
        onApply={handleFilterApply}
        onClear={handleFilterClear}
        initialPlaceId={filterPlaceId}
        initialPlaceName={filterPlaceName}
        initialKeywords={filterKeywords}
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
  filterBtn: {
    position: "absolute",
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
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
  activeFilterBadge: {
    position: "absolute",
    left: 44,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: PINK,
    borderWidth: 1.5,
    borderColor: "#000",
  },
});
