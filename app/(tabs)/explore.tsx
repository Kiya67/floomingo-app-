
import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Image,
  ImageSourcePropType,
  Animated,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Film } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useVideoPlayer, VideoView } from "expo-video";
import { apiGet } from "@/utils/api";
import { LinearGradient } from "expo-linear-gradient";
import { IconSymbol } from "@/components/IconSymbol";

const PINK = "#FF0080";
const ORANGE = "#FF6B00";
const BG = "#0a0a0a";
const CARD_BG = "#1a1a1a";

const { width } = Dimensions.get("window");
const VIDEO_ASPECT = 9 / 16;
const VIDEO_HEIGHT = width * VIDEO_ASPECT;
const GRADIENT_WIDTH = 4;

const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 60 };

function resolveImageSource(
  source: string | number | ImageSourcePropType | undefined
): ImageSourcePropType {
  if (!source) return { uri: "" };
  if (typeof source === "string") return { uri: source };
  return source as ImageSourcePropType;
}

interface ExperiencePlace {
  id: string;
  place_id: string;
  place_name: string;
}

interface Experience {
  id: string;
  user_id: string;
  video_url: string;
  thumbnail_url?: string;
  title: string;
  description?: string;
  places: ExperiencePlace[];
  user: {
    id: string;
    username: string;
    display_name?: string;
    avatar_url?: string;
  };
  created_at: string;
  view_count?: number;
}

// ─── VideoCard ────────────────────────────────────────────────────────────────

function VideoCard({
  videoUrl,
  postId,
  isActive,
  onPlayingChange,
  onTogglePlayPause,
}: {
  videoUrl: string;
  postId: string;
  isActive: boolean;
  onPlayingChange: (playing: boolean) => void;
  onTogglePlayPause: (toggle: () => void) => void;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const isMountedRef = useRef(true);
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const overlayIconRef = useRef<"play" | "pause">("play");
  const fadeOutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showOverlay = (icon: "play" | "pause") => {
    overlayIconRef.current = icon;
    if (fadeOutTimerRef.current) clearTimeout(fadeOutTimerRef.current);
    overlayOpacity.setValue(1);
    fadeOutTimerRef.current = setTimeout(() => {
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }, 800);
  };

  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop = true;
  });

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (fadeOutTimerRef.current) clearTimeout(fadeOutTimerRef.current);
      try {
        if (player && player.playing) player.pause();
      } catch {}
    };
  }, [player]);

  useEffect(() => {
    if (!player) return;
    if (isActive) {
      console.log("Explore feed: experience video active, playing:", postId);
      const t = setTimeout(() => {
        if (isMountedRef.current) {
          try {
            player.play();
            setIsPlaying(true);
            onPlayingChange(true);
          } catch (e) {
            console.error("Explore feed: error playing experience video:", e);
          }
        }
      }, 300);
      return () => clearTimeout(t);
    } else {
      try {
        player.pause();
        setIsPlaying(false);
        onPlayingChange(false);
      } catch {}
    }
  }, [player, postId, isActive]);

  const toggle = useCallback(() => {
    console.log("User tapped experience video to toggle play/pause (explore), id:", postId);
    if (!player) return;
    try {
      if (isPlaying) {
        player.pause();
        setIsPlaying(false);
        onPlayingChange(false);
        showOverlay("pause");
      } else {
        player.play();
        setIsPlaying(true);
        onPlayingChange(true);
        showOverlay("play");
      }
    } catch (e) {
      console.error("Explore feed: error toggling play/pause:", e);
    }
  }, [player, isPlaying, onPlayingChange, postId]);

  useEffect(() => {
    onTogglePlayPause(toggle);
  }, [toggle]);

  if (!videoUrl) return null;

  const overlayIcon = overlayIconRef.current === "pause" ? "⏸" : "▶";

  return (
    <TouchableOpacity
      style={styles.videoContainer}
      activeOpacity={1}
      onPress={toggle}
    >
      <VideoView
        style={styles.video}
        player={player}
        nativeControls={false}
        contentFit="cover"
        allowsFullscreen={false}
        allowsPictureInPicture={false}
      />
      {/* Pink-to-orange gradient left edge */}
      <LinearGradient
        colors={[PINK, ORANGE]}
        style={styles.gradientLeft}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        pointerEvents="none"
      />
      {/* Pink-to-orange gradient right edge */}
      <LinearGradient
        colors={[PINK, ORANGE]}
        style={styles.gradientRight}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        pointerEvents="none"
      />
      <Animated.View
        style={[styles.playPauseOverlay, { opacity: overlayOpacity }]}
        pointerEvents="none"
      >
        <View style={styles.playPauseIconCircle}>
          <Text style={styles.playPauseIconText}>{overlayIcon}</Text>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ExploreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [feed, setFeed] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [playingMap, setPlayingMap] = useState<Map<string, boolean>>(new Map());
  const toggleFnMap = useRef<Map<string, () => void>>(new Map());
  const flatListRef = useRef<FlatList>(null);

  // ── Fetch experiences ──
  const fetchExperiences = useCallback(
    async (isRefresh = false, cursor: string | null = null) => {
      console.log(
        "Explore feed: fetching experiences from /api/experiences, isRefresh:",
        isRefresh,
        "cursor:",
        cursor
      );
      try {
        const params = new URLSearchParams({ limit: "20" });
        if (cursor) params.set("cursor", cursor);
        const url = `/api/experiences?${params.toString()}`;
        console.log("Explore feed: GET", url);
        const data = await apiGet<any>(url);

        const items: Experience[] = (
          Array.isArray(data) ? data : data?.experiences ?? data?.items ?? []
        ).map((e: any) => ({
          id: e.id,
          user_id: e.user_id,
          video_url: e.video_url || "",
          thumbnail_url: e.thumbnail_url,
          title: e.title || "Untitled Experience",
          description: e.description,
          created_at: e.created_at,
          view_count: e.view_count ?? 0,
          places: Array.isArray(e.places)
            ? e.places
            : e.place_id
            ? [{ id: e.id, place_id: e.place_id, place_name: e.place_name }]
            : [],
          user: e.user
            ? {
                id: e.user.id,
                username: e.user.username || "",
                display_name: e.user.display_name,
                avatar_url: e.user.avatar_url,
              }
            : e.profiles
            ? {
                id: e.profiles.id,
                username: e.profiles.username || "",
                display_name: e.profiles.display_name,
                avatar_url: e.profiles.avatar_url,
              }
            : { id: e.user_id, username: "", display_name: null, avatar_url: null },
        }));

        console.log("Explore feed: fetched", items.length, "experiences");

        const newNextCursor =
          items.length === 20 ? items[items.length - 1].created_at : null;

        if (isRefresh || !cursor) {
          setFeed(items);
          setCurrentIndex(0);
        } else {
          setFeed((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            return [...prev, ...items.filter((m) => !existingIds.has(m.id))];
          });
        }

        setNextCursor(newNextCursor);
        setHasMore(!!newNextCursor);
        setError(null);
      } catch (e: any) {
        console.error("Explore feed: fetch experiences error:", e);
        setError("Couldn't load experiences. Check your connection.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      console.log("ExploreScreen focused - loading experiences feed");
      setLoading(true);
      setNextCursor(null);
      setHasMore(true);
      fetchExperiences(false, null);
    }, [fetchExperiences])
  );

  // Pause on tab blur, resume on focus
  const wasPlayingOnBlurRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (wasPlayingOnBlurRef.current) {
        console.log("ExploreScreen regained focus - resuming active experience video");
        const exp = feed[currentIndex];
        if (exp) {
          const toggleFn = toggleFnMap.current.get(exp.id);
          const isCurrentlyPlaying = playingMap.get(exp.id);
          if (toggleFn && !isCurrentlyPlaying) toggleFn();
        }
        wasPlayingOnBlurRef.current = false;
      }
      return () => {
        const exp = feed[currentIndex];
        if (exp) {
          const isCurrentlyPlaying = playingMap.get(exp.id);
          if (isCurrentlyPlaying) {
            console.log("ExploreScreen lost focus - pausing experience video:", exp.id);
            wasPlayingOnBlurRef.current = true;
            const toggleFn = toggleFnMap.current.get(exp.id);
            if (toggleFn) toggleFn();
          }
        }
      };
    }, [feed, currentIndex, playingMap])
  );

  // ── Viewability ──
  const viewableItemsHandlerRef = useRef<(info: { viewableItems: any[] }) => void>(() => {});

  useEffect(() => {
    viewableItemsHandlerRef.current = ({ viewableItems }: any) => {
      if (viewableItems.length > 0) {
        const newIndex = viewableItems[0].index;
        console.log("Explore feed: visible experience index changed to:", newIndex);
        setCurrentIndex(newIndex);
      }
    };
  }, [feed]);

  const handleViewableItemsChanged = useRef((info: any) => {
    viewableItemsHandlerRef.current(info);
  }).current;

  const getInitials = (name: string) => {
    if (!name) return "??";
    const parts = name.split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  // ── Render item ──
  const renderItem = useCallback(
    ({ item: exp, index }: { item: Experience; index: number }) => {
      if (!exp?.video_url) return null;

      const isActive = index === currentIndex;
      const displayName = exp.user?.display_name || exp.user?.username || "Unknown";
      const avatarUrl = exp.user?.avatar_url || "";
      const initials = getInitials(displayName);
      const placeName = exp.places?.[0]?.place_name || "";
      const placeId = exp.places?.[0]?.place_id || "";
      const viewCountText = String(exp.view_count ?? 0);

      return (
        <View style={styles.card}>
          {/* 16:9 video player */}
          <VideoCard
            videoUrl={exp.video_url}
            postId={exp.id}
            isActive={isActive}
            onPlayingChange={(playing) => {
              setPlayingMap((prev) => {
                const m = new Map(prev);
                m.set(exp.id, playing);
                return m;
              });
            }}
            onTogglePlayPause={(fn) => {
              toggleFnMap.current.set(exp.id, fn);
            }}
          />

          {/* Card info */}
          <View style={styles.cardInfo}>
            {/* Title */}
            <Text style={styles.cardTitle} numberOfLines={2}>
              {exp.title}
            </Text>

            {/* User row */}
            <TouchableOpacity
              style={styles.userRow}
              onPress={() => {
                console.log(
                  "User tapped profile on explore experience card, navigating to:",
                  exp.user_id
                );
                router.push(`/user/${exp.user_id}` as any);
              }}
              activeOpacity={0.7}
            >
              {avatarUrl ? (
                <Image
                  source={resolveImageSource(avatarUrl)}
                  style={styles.avatar}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitials}>{initials}</Text>
                </View>
              )}
              <Text style={styles.displayName} numberOfLines={1}>
                {displayName}
              </Text>
            </TouchableOpacity>

            {/* Location + views row */}
            <View style={styles.metaRow}>
              {placeName ? (
                <TouchableOpacity
                  style={styles.locationChip}
                  onPress={() => {
                    console.log(
                      "User tapped location chip on explore experience card:",
                      placeName
                    );
                    if (placeId) router.push(`/location/${placeId}` as any);
                  }}
                  activeOpacity={0.7}
                >
                  <IconSymbol
                    android_material_icon_name="location-on"
                    size={13}
                    color={PINK}
                  />
                  <Text style={styles.locationText} numberOfLines={1}>
                    {placeName}
                  </Text>
                </TouchableOpacity>
              ) : null}
              <View style={styles.viewsChip}>
                <IconSymbol
                  android_material_icon_name="visibility"
                  size={13}
                  color="rgba(255,255,255,0.5)"
                />
                <Text style={styles.viewsText}>{viewCountText}</Text>
              </View>
            </View>
          </View>
        </View>
      );
    },
    [currentIndex, router]
  );

  const keyExtractor = useCallback((item: Experience) => item.id, []);

  // ── Loading ──
  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={BG} />
        <ActivityIndicator size="large" color={PINK} />
        <Text style={styles.loadingText}>Loading experiences…</Text>
      </View>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={BG} />
        <Film size={48} color="rgba(255,255,255,0.3)" strokeWidth={1.5} />
        <Text style={styles.emptyTitle}>Couldn't load experiences</Text>
        <Text style={styles.emptySubtitle}>{error}</Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => {
            console.log("User tapped retry on explore experiences feed");
            setLoading(true);
            fetchExperiences(false, null);
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.retryBtnText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Empty ──
  if (feed.length === 0) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={BG} />
        <Film size={48} color="rgba(255,255,255,0.3)" strokeWidth={1.5} />
        <Text style={styles.emptyTitle}>No experiences yet</Text>
        <Text style={styles.emptySubtitle}>
          Be the first to share an experience on Floomingo
        </Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => {
            console.log("User tapped refresh on empty explore experiences feed");
            setLoading(true);
            fetchExperiences(false, null);
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
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.headerTitle}>Explore</Text>
      </View>

      <FlatList
        ref={flatListRef}
        data={feed}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 80 },
        ]}
        onViewableItemsChanged={handleViewableItemsChanged}
        viewabilityConfig={VIEWABILITY_CONFIG}
        onEndReached={() => {
          if (!loadingMore && hasMore && nextCursor) {
            setLoadingMore(true);
            console.log("Explore feed: loading more experiences");
            fetchExperiences(false, nextCursor);
          }
        }}
        onEndReachedThreshold={0.5}
        removeClippedSubviews
        maxToRenderPerBatch={4}
        windowSize={7}
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator
              color={PINK}
              style={{ marginVertical: 20 }}
            />
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  center: {
    flex: 1,
    backgroundColor: BG,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: BG,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
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
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 4,
    gap: 16,
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  videoContainer: {
    width: "100%",
    height: VIDEO_HEIGHT,
    backgroundColor: "#000",
    overflow: "hidden",
  },
  video: {
    ...StyleSheet.absoluteFillObject,
  },
  gradientLeft: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: GRADIENT_WIDTH,
  },
  gradientRight: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: GRADIENT_WIDTH,
  },
  playPauseOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  playPauseIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  playPauseIconText: {
    fontSize: 26,
    color: "#FFFFFF",
  },
  cardInfo: {
    padding: 14,
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    lineHeight: 22,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  avatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: PINK,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitials: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFF",
  },
  displayName: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.75)",
    flex: 1,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  locationChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    flex: 1,
  },
  locationText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.55)",
    fontWeight: "500",
    flex: 1,
  },
  viewsChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  viewsText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
    fontWeight: "500",
  },
});
