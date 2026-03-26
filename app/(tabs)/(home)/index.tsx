
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
import { Heart, Bookmark, Share2, MapPin, Film, Zap } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiGet, authenticatedPost } from "@/utils/api";
import { supabase } from "@/lib/supabase";

const PINK = "#FF3B7A";
const TAB_BAR_HEIGHT = 83;

type PostType = "moment" | "experience";

interface Place {
  id: string;
  place_id: string;
  place_name: string;
  place_address?: string;
}

interface UserSummary {
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

interface LinkedMoment {
  id: string;
  video_url: string;
  thumbnail_url?: string;
  caption?: string;
}

interface FeedPost {
  type: PostType;
  id: string;
  user_id: string;
  video_url: string;
  thumbnail_url?: string;
  caption?: string;
  title?: string;
  description?: string;
  linked_experience_id?: string;
  linked_moment_id?: string;
  linked_experience?: LinkedExperience;
  linked_moment?: LinkedMoment;
  likes_count: number;
  bookmarks_count: number;
  is_liked: boolean;
  is_bookmarked: boolean;
  places: Place[];
  user: UserSummary;
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
  item: FeedPost;
  isActive: boolean;
  screenHeight: number;
  screenWidth: number;
  insetTop: number;
  interaction: InteractionState;
  onLike: (post: FeedPost) => void;
  onBookmark: (post: FeedPost) => void;
  onShare: (post: FeedPost) => void;
  onProfilePress: (userId: string) => void;
  onPlacePress: (place: Place) => void;
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
  onProfilePress,
  onPlacePress,
}: FeedItemProps) {
  const isMountedRef = useRef(true);
  const [displayPost, setDisplayPost] = useState<FeedPost>(item);

  // Reset display post when item changes (e.g. feed refresh)
  useEffect(() => {
    setDisplayPost(item);
  }, [item.id]);

  const player = useVideoPlayer(displayPost.video_url || "", (p) => {
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
            console.log("FeedItem: playing video for post:", displayPost.id, "type:", displayPost.type);
          } catch (e) {
            console.error("FeedItem: error playing video:", e);
          }
        }
      }, 300);
      return () => clearTimeout(t);
    } else {
      try {
        player.pause();
      } catch {}
    }
  }, [isActive, player, displayPost.id]);

  const handleTap = useCallback(() => {
    console.log("User tapped video - toggling play/pause, post:", displayPost.id);
    if (!player) return;
    try {
      if (player.playing) player.pause();
      else player.play();
    } catch {}
  }, [player, displayPost.id]);

  // Switcher logic
  const hasLinked =
    item.type === "moment"
      ? !!item.linked_experience_id
      : !!item.linked_moment_id;

  const handleSwitch = useCallback(() => {
    if (displayPost.type === "moment" && displayPost.linked_experience) {
      console.log("User tapped switcher - switching to Experience:", displayPost.linked_experience.id);
      setDisplayPost({
        ...displayPost,
        type: "experience",
        video_url: displayPost.linked_experience.video_url,
        thumbnail_url: displayPost.linked_experience.thumbnail_url,
        title: displayPost.linked_experience.title,
      });
    } else if (displayPost.type === "experience" && displayPost.linked_moment) {
      console.log("User tapped switcher - switching to Moment:", displayPost.linked_moment.id);
      setDisplayPost({
        ...displayPost,
        type: "moment",
        video_url: displayPost.linked_moment.video_url,
        thumbnail_url: displayPost.linked_moment.thumbnail_url,
        caption: displayPost.linked_moment.caption,
      });
    } else if (displayPost.type === "moment" && item.linked_experience_id) {
      // linked_experience object not populated, just show indicator
      console.log("User tapped switcher - linked experience not loaded yet");
    }
  }, [displayPost, item]);

  const username = displayPost.user?.username || "unknown";
  const avatarUrl = displayPost.user?.avatar_url || "";
  const initials = getInitials(username);
  const likeColor = interaction.is_liked ? PINK : "#FFFFFF";
  const bookmarkColor = interaction.is_bookmarked ? PINK : "#FFFFFF";
  const likesText = String(Number(interaction.likes_count) || 0);
  const bookmarksText = String(Number(interaction.bookmarks_count) || 0);

  const isMoment = displayPost.type === "moment";
  const captionText = isMoment ? (displayPost.caption || "") : (displayPost.title || "");
  const descriptionText = isMoment ? "" : (displayPost.description || "");
  const typeLabel = isMoment ? "Moment" : "Experience";
  const switcherLabel = isMoment ? "Experience" : "Moment";
  const SwitcherIcon = isMoment ? Film : Zap;

  if (!displayPost.video_url) return null;

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

      {/* Top bar: type label + switcher */}
      <View style={[styles.topBar, { paddingTop: insetTop + 12 }]}>
        <View style={styles.typeLabelPill}>
          <Text style={styles.typeLabelText}>{typeLabel}</Text>
        </View>
        {hasLinked ? (
          <TouchableOpacity
            style={styles.switcherBtn}
            onPress={handleSwitch}
            activeOpacity={0.85}
          >
            <SwitcherIcon size={13} color="#FFFFFF" strokeWidth={2} />
            <Text style={styles.switcherBtnText}>{switcherLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Bottom overlay */}
      <View style={[styles.bottomSection, { paddingBottom: TAB_BAR_HEIGHT + 16 }]}>
        {/* Left: user info + caption + places */}
        <View style={styles.leftContent}>
          <TouchableOpacity
            style={styles.userRow}
            onPress={() => onProfilePress(displayPost.user_id)}
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

          {descriptionText ? (
            <Text style={styles.description} numberOfLines={2}>
              {descriptionText}
            </Text>
          ) : null}

          {displayPost.places && displayPost.places.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.placesScroll}
              contentContainerStyle={styles.placesScrollContent}
            >
              {displayPost.places.map((place) => (
                <TouchableOpacity
                  key={place.id}
                  style={styles.placePill}
                  onPress={() => onPlacePress(place)}
                  activeOpacity={0.8}
                >
                  <MapPin size={12} color={PINK} strokeWidth={2} />
                  <Text style={styles.placePillText}>{place.place_name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
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

  const [feed, setFeed] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [momentsCursor, setMomentsCursor] = useState<string | null>(null);
  const [experiencesCursor, setExperiencesCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [interactions, setInteractions] = useState<Map<string, InteractionState>>(new Map());

  const flatListRef = useRef<FlatList>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
  }, []);

  const mergeFeed = useCallback(
    (moments: any[], experiences: any[]): FeedPost[] => {
      const momentPosts: FeedPost[] = moments.map((m) => ({
        type: "moment" as PostType,
        id: m.id,
        user_id: m.user_id,
        video_url: m.video_url,
        thumbnail_url: m.thumbnail_url,
        caption: m.caption,
        linked_experience_id: m.linked_experience_id,
        linked_experience: m.linked_experience,
        likes_count: Number(m.likes_count) || 0,
        bookmarks_count: Number(m.bookmarks_count) || 0,
        is_liked: !!m.is_liked,
        is_bookmarked: !!m.is_bookmarked,
        places: Array.isArray(m.places) ? m.places : [],
        user: m.user || { id: m.user_id, username: "unknown" },
        created_at: m.created_at,
      }));

      const experiencePosts: FeedPost[] = experiences.map((e) => ({
        type: "experience" as PostType,
        id: e.id,
        user_id: e.user_id,
        video_url: e.video_url,
        thumbnail_url: e.thumbnail_url,
        title: e.title,
        description: e.description,
        linked_moment_id: e.linked_moment_id,
        linked_moment: e.linked_moment,
        likes_count: Number(e.likes_count) || 0,
        bookmarks_count: Number(e.bookmarks_count) || 0,
        is_liked: !!e.is_liked,
        is_bookmarked: !!e.is_bookmarked,
        places: Array.isArray(e.places) ? e.places : [],
        user: e.user || { id: e.user_id, username: "unknown" },
        created_at: e.created_at,
      }));

      const combined = [...momentPosts, ...experiencePosts];
      combined.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      return combined;
    },
    []
  );

  const initInteractions = useCallback((posts: FeedPost[]) => {
    setInteractions((prev) => {
      const m = new Map(prev);
      posts.forEach((post) => {
        if (!m.has(post.id)) {
          m.set(post.id, {
            is_liked: post.is_liked,
            is_bookmarked: post.is_bookmarked,
            likes_count: post.likes_count,
            bookmarks_count: post.bookmarks_count,
          });
        }
      });
      return m;
    });
  }, []);

  const fetchFeed = useCallback(async (isRefresh = false) => {
    console.log("Home: fetching unified feed, isRefresh:", isRefresh);
    try {
      const [momentsData, experiencesData] = await Promise.all([
        apiGet<{ moments: any[]; next_cursor: string | null }>(
          "/api/moments?limit=20"
        ).catch((e) => {
          console.error("Home: fetch moments error:", e);
          return { moments: [], next_cursor: null };
        }),
        apiGet<{ experiences: any[]; next_cursor: string | null }>(
          "/api/experiences?limit=20"
        ).catch((e) => {
          console.error("Home: fetch experiences error:", e);
          return { experiences: [], next_cursor: null };
        }),
      ]);

      const moments = Array.isArray(momentsData?.moments) ? momentsData.moments : [];
      const experiences = Array.isArray(experiencesData?.experiences) ? experiencesData.experiences : [];

      console.log("Home: fetched moments:", moments.length, "experiences:", experiences.length);

      const merged = mergeFeed(moments, experiences);
      setFeed(merged);
      setMomentsCursor(momentsData?.next_cursor ?? null);
      setExperiencesCursor(experiencesData?.next_cursor ?? null);
      initInteractions(merged);
      setError(null);
    } catch (e: any) {
      console.error("Home: fetch feed error:", e);
      setError("Couldn't load feed. Check your connection.");
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [mergeFeed, initInteractions]);

  const fetchMore = useCallback(async () => {
    if (loadingMore || (!momentsCursor && !experiencesCursor)) return;
    setLoadingMore(true);
    console.log("Home: loading more — momentsCursor:", momentsCursor, "experiencesCursor:", experiencesCursor);
    try {
      const [momentsData, experiencesData] = await Promise.all([
        momentsCursor
          ? apiGet<{ moments: any[]; next_cursor: string | null }>(
              `/api/moments?limit=20&cursor=${momentsCursor}`
            ).catch(() => ({ moments: [], next_cursor: null }))
          : Promise.resolve({ moments: [], next_cursor: null }),
        experiencesCursor
          ? apiGet<{ experiences: any[]; next_cursor: string | null }>(
              `/api/experiences?limit=20&cursor=${experiencesCursor}`
            ).catch(() => ({ experiences: [], next_cursor: null }))
          : Promise.resolve({ experiences: [], next_cursor: null }),
      ]);

      const moments = Array.isArray(momentsData?.moments) ? momentsData.moments : [];
      const experiences = Array.isArray(experiencesData?.experiences) ? experiencesData.experiences : [];
      const newPosts = mergeFeed(moments, experiences);

      setFeed((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const unique = newPosts.filter((p) => !existingIds.has(p.id));
        return [...prev, ...unique];
      });
      setMomentsCursor(momentsData?.next_cursor ?? null);
      setExperiencesCursor(experiencesData?.next_cursor ?? null);
      initInteractions(newPosts);
    } catch (e) {
      console.error("Home: load more error:", e);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, momentsCursor, experiencesCursor, mergeFeed, initInteractions]);

  useFocusEffect(
    useCallback(() => {
      isMountedRef.current = true;
      console.log("HomeScreen focused - fetching unified feed");
      setLoading(true);
      setCurrentIndex(0);
      fetchFeed(false);
      return () => {
        isMountedRef.current = false;
      };
    }, [fetchFeed])
  );

  const handleRefresh = useCallback(() => {
    console.log("User pulled to refresh unified feed");
    setRefreshing(true);
    setCurrentIndex(0);
    fetchFeed(true);
  }, [fetchFeed]);

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
    async (post: FeedPost) => {
      console.log("User tapped like on post:", post.id, "type:", post.type);
      if (!currentUserId) {
        console.log("Home: like skipped - not authenticated");
        return;
      }
      const cur = interactions.get(post.id) ?? {
        is_liked: post.is_liked,
        is_bookmarked: post.is_bookmarked,
        likes_count: post.likes_count,
        bookmarks_count: post.bookmarks_count,
      };
      const wasLiked = cur.is_liked;
      // Optimistic update
      setInteractions((prev) => {
        const m = new Map(prev);
        m.set(post.id, {
          ...cur,
          is_liked: !wasLiked,
          likes_count: wasLiked ? Math.max(0, cur.likes_count - 1) : cur.likes_count + 1,
        });
        return m;
      });
      const endpoint =
        post.type === "moment"
          ? `/api/moments/${post.id}/like`
          : `/api/experiences/${post.id}/like`;
      try {
        console.log("Home: POST", endpoint);
        const res = await authenticatedPost<{ liked: boolean; likes_count: number }>(endpoint, {});
        setInteractions((prev) => {
          const m = new Map(prev);
          const existing = m.get(post.id) ?? cur;
          m.set(post.id, {
            ...existing,
            is_liked: res.liked,
            likes_count: Number(res.likes_count) || 0,
          });
          return m;
        });
      } catch (e) {
        console.error("Home: like error:", e);
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
    async (post: FeedPost) => {
      console.log("User tapped bookmark on post:", post.id, "type:", post.type);
      if (!currentUserId) {
        console.log("Home: bookmark skipped - not authenticated");
        return;
      }
      const cur = interactions.get(post.id) ?? {
        is_liked: post.is_liked,
        is_bookmarked: post.is_bookmarked,
        likes_count: post.likes_count,
        bookmarks_count: post.bookmarks_count,
      };
      const wasBookmarked = cur.is_bookmarked;
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
      const endpoint =
        post.type === "moment"
          ? `/api/moments/${post.id}/bookmark`
          : `/api/experiences/${post.id}/bookmark`;
      try {
        console.log("Home: POST", endpoint);
        const res = await authenticatedPost<{ bookmarked: boolean; bookmarks_count: number }>(endpoint, {});
        setInteractions((prev) => {
          const m = new Map(prev);
          const existing = m.get(post.id) ?? cur;
          m.set(post.id, {
            ...existing,
            is_bookmarked: res.bookmarked,
            bookmarks_count: Number(res.bookmarks_count) || 0,
          });
          return m;
        });
      } catch (e) {
        console.error("Home: bookmark error:", e);
        setInteractions((prev) => {
          const m = new Map(prev);
          m.set(post.id, cur);
          return m;
        });
      }
    },
    [currentUserId, interactions]
  );

  const handleShare = useCallback(async (post: FeedPost) => {
    console.log("User tapped share on post:", post.id, "type:", post.type);
    try {
      const text =
        post.type === "moment"
          ? post.caption || "Check out this moment on Floomingo!"
          : post.title || "Check out this experience on Floomingo!";
      await Share.share({ message: text, url: post.video_url });
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
    (place: Place) => {
      console.log("User tapped place pill:", place.place_name, "place_id:", place.place_id);
      router.push(`/location/${place.place_id}` as any);
    },
    [router]
  );

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const renderItem = useCallback(
    ({ item, index }: { item: FeedPost; index: number }) => {
      if (!item?.video_url) return null;
      const isActive = index === currentIndex;
      const interaction = interactions.get(item.id) ?? {
        is_liked: item.is_liked,
        is_bookmarked: item.is_bookmarked,
        likes_count: item.likes_count,
        bookmarks_count: item.bookmarks_count,
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
      insets.top,
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
            fetchFeed(false);
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
          Be the first to share a moment or experience
        </Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => {
            console.log("User tapped refresh on empty feed");
            setLoading(true);
            fetchFeed(false);
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
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  typeLabelPill: {
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  typeLabelText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFF",
    letterSpacing: 0.5,
  },
  switcherBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: PINK,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: PINK,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
  },
  switcherBtnText: {
    fontSize: 13,
    color: "#FFF",
    fontWeight: "700",
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
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#333" },
  avatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 19,
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
  description: {
    fontSize: 13,
    color: "rgba(255,255,255,0.75)",
    lineHeight: 18,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  placesScroll: { maxHeight: 32 },
  placesScrollContent: { gap: 8, paddingRight: 8 },
  placePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,59,122,0.2)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(255,59,122,0.4)",
  },
  placePillText: { fontSize: 12, color: "#FFF", fontWeight: "600" },
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
