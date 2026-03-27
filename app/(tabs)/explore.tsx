
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
  Share,
  Alert,
  Animated,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Film } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useVideoPlayer, VideoView } from "expo-video";
import { apiGet, authenticatedPost, authenticatedDelete } from "@/utils/api";
import { supabase } from "@/lib/supabase";
import { IconSymbol } from "@/components/IconSymbol";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";

const PINK = "#FF3B7A";
const { width, height } = Dimensions.get("window");

const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 50 };

function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: "" };
  if (typeof source === "string") return { uri: source };
  return source as ImageSourcePropType;
}

interface MomentPlace {
  id: string;
  place_id: string;
  place_name: string;
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
  user: {
    id: string;
    username: string;
    display_name?: string;
    avatar_url?: string;
  };
  created_at: string;
  view_count?: number;
}

interface PostStats {
  like_count: number;
  comment_count: number;
  share_count: number;
}

interface Comment {
  id: string;
  comment_text: string;
  created_at: string;
  user_id: string;
  profiles?: {
    display_name: string;
    avatar_url: string | null;
  };
}

// ─── VideoPlayer ──────────────────────────────────────────────────────────────

function VideoPlayer({
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
      console.log("Explore feed: video active, playing:", postId);
      const t = setTimeout(() => {
        if (isMountedRef.current) {
          try {
            player.play();
            setIsPlaying(true);
            onPlayingChange(true);
          } catch (e) {
            console.error("Explore feed: error playing video:", e);
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
    console.log("User tapped video to toggle play/pause (explore), post:", postId);
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
    <TouchableOpacity style={styles.video} activeOpacity={1} onPress={toggle}>
      <VideoView
        style={styles.video}
        player={player}
        nativeControls={false}
        contentFit="cover"
        allowsFullscreen={false}
        allowsPictureInPicture={false}
      />
      <Animated.View style={[styles.playPauseOverlay, { opacity: overlayOpacity }]}>
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

  const [feed, setFeed] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [playingMap, setPlayingMap] = useState<Map<string, boolean>>(new Map());
  const toggleFnMap = useRef<Map<string, () => void>>(new Map());
  const flatListRef = useRef<FlatList>(null);

  const [isSharing, setIsSharing] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  const [viewedPostIds, setViewedPostIds] = useState<Set<string>>(new Set());

  const [postInteractions, setPostInteractions] = useState<Map<string, {
    isLiked: boolean;
    isSaved: boolean;
    stats: PostStats;
  }>>(new Map());

  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  const [showMoreModal, setShowMoreModal] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error" | "info">("info");

  const commentsSheetRef = useRef<BottomSheet>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  // ── Auth ──
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
  }, []);

  // ── Fetch feed ──
  const fetchMoments = useCallback(
    async (isRefresh = false, cursor: string | null = null) => {
      console.log("Explore feed: fetching from Supabase posts, isRefresh:", isRefresh, "cursor:", cursor);
      try {
        let query = supabase
          .from("posts")
          .select(`
            *,
            profiles:user_id (
              id,
              username,
              display_name,
              avatar_url
            )
          `)
          .order("created_at", { ascending: false })
          .limit(20);

        if (cursor) {
          query = query.lt("created_at", cursor);
        }

        const { data, error } = await query;
        if (error) throw error;

        const posts = (data || []).map((p: any) => ({
          id: p.id,
          user_id: p.user_id,
          video_url: p.video_url,
          thumbnail_url: p.thumbnail_url,
          caption: p.caption,
          created_at: p.created_at,
          likes_count: 0,
          bookmarks_count: 0,
          is_liked: false,
          is_bookmarked: false,
          places: p.place_id ? [{ id: p.id, place_id: p.place_id, place_name: p.place_name }] : [],
          user: p.profiles ? {
            id: p.profiles.id,
            username: p.profiles.username || "",
            display_name: p.profiles.display_name,
            avatar_url: p.profiles.avatar_url,
          } : { id: p.user_id, username: "", display_name: null, avatar_url: null },
          view_count: 0,
        }));

        console.log("Explore feed: fetched", posts.length, "posts from Supabase");

        const newNextCursor = posts.length === 20 ? posts[posts.length - 1].created_at : null;

        if (isRefresh || !cursor) {
          setFeed(posts);
          setCurrentIndex(0);
        } else {
          setFeed((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            return [...prev, ...posts.filter((m) => !existingIds.has(m.id))];
          });
        }

        setNextCursor(newNextCursor);
        setHasMore(!!newNextCursor);
        setError(null);

        if ((isRefresh || !cursor) && posts[0] && currentUserId) {
          loadPostInteractions(posts[0].id, currentUserId);
        }
      } catch (e: any) {
        console.error("Explore feed: fetch error:", e);
        setError("Couldn't load videos. Check your connection.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [currentUserId]
  );

  useFocusEffect(
    useCallback(() => {
      console.log("ExploreScreen focused - loading fullscreen feed");
      setLoading(true);
      setNextCursor(null);
      setHasMore(true);
      fetchMoments(false, null);
    }, [fetchMoments])
  );

  // Pause active video when tab loses focus, resume when it regains focus
  const wasPlayingOnBlurRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      // Screen gained focus — resume if it was playing before blur
      if (wasPlayingOnBlurRef.current) {
        console.log("ExploreScreen regained focus - resuming active video");
        const moment = feed[currentIndex];
        if (moment) {
          const toggleFn = toggleFnMap.current.get(moment.id);
          const isCurrentlyPlaying = playingMap.get(moment.id);
          if (toggleFn && !isCurrentlyPlaying) {
            toggleFn();
          }
        }
        wasPlayingOnBlurRef.current = false;
      }
      return () => {
        // Screen lost focus — pause active video
        const moment = feed[currentIndex];
        if (moment) {
          const isCurrentlyPlaying = playingMap.get(moment.id);
          if (isCurrentlyPlaying) {
            console.log("ExploreScreen lost focus - pausing active video:", moment.id);
            wasPlayingOnBlurRef.current = true;
            const toggleFn = toggleFnMap.current.get(moment.id);
            if (toggleFn) toggleFn();
          }
        }
      };
    }, [feed, currentIndex, playingMap])
  );

  // ── Interactions ──
  const loadPostInteractions = useCallback(async (postId: string, userId: string) => {
    let isLiked = false;
    let isSaved = false;
    let stats: PostStats = { like_count: 0, comment_count: 0, share_count: 0 };

    try {
      const likeRes = await supabase.from("post_likes").select("*").eq("post_id", postId).eq("user_id", userId).limit(1);
      if (likeRes.error) {
        console.log("Explore feed: post_likes query error (table may not exist yet):", likeRes.error.message);
      } else {
        isLiked = !!(likeRes.data && likeRes.data.length > 0);
      }
    } catch (e) {
      console.log("Explore feed: post_likes unavailable, skipping:", e);
    }

    try {
      const statsRes = await supabase.from("post_stats").select("*").eq("post_id", postId).single();
      if (statsRes.error) {
        console.log("Explore feed: post_stats query error (table may not exist yet):", statsRes.error.message);
      } else if (statsRes.data) {
        stats = { like_count: statsRes.data.like_count || 0, comment_count: statsRes.data.comment_count || 0, share_count: statsRes.data.share_count || 0 };
      }
    } catch (e) {
      console.log("Explore feed: post_stats unavailable, skipping:", e);
    }

    try {
      const savedRes = await supabase.from("board_posts").select("id, board_id, boards!inner(user_id)").eq("post_id", postId).eq("boards.user_id", userId).limit(1);
      if (savedRes.error) {
        console.log("Explore feed: board_posts query error:", savedRes.error.message);
      } else {
        isSaved = !!(savedRes.data && savedRes.data.length > 0);
      }
    } catch (e) {
      console.log("Explore feed: board_posts unavailable, skipping:", e);
    }

    setPostInteractions((prev) => {
      const m = new Map(prev);
      m.set(postId, { isLiked, isSaved, stats });
      return m;
    });
  }, []);

  const viewableItemsHandlerRef = useRef<(info: { viewableItems: any[] }) => void>(() => {});

  useEffect(() => {
    viewableItemsHandlerRef.current = ({ viewableItems }: any) => {
      if (viewableItems.length > 0) {
        const newIndex = viewableItems[0].index;
        setCurrentIndex(newIndex);
        const moment = feed[newIndex];
        if (moment && currentUserId) {
          loadPostInteractions(moment.id, currentUserId);

          if (!viewedPostIds.has(moment.id) && moment.user_id !== currentUserId) {
            console.log("Explore feed: incrementing view count for:", moment.id);
            authenticatedPost("/api/rpc/increment-view", { postId: moment.id })
              .then(() => setViewedPostIds((prev) => new Set(prev).add(moment.id)))
              .catch((e) => console.error("Explore feed: error incrementing view count:", e));
          }

          if (moment.user_id !== currentUserId) {
            supabase
              .from("follows")
              .select("*")
              .eq("follower_id", currentUserId)
              .eq("following_id", moment.user_id)
              .limit(1)
              .then(({ data }) => setIsFollowing(!!(data && data.length > 0)));
          } else {
            setIsFollowing(false);
          }
        }
      }
    };
  }, [feed, currentUserId, loadPostInteractions, viewedPostIds]);

  const handleViewableItemsChanged = useRef((info: any) => {
    viewableItemsHandlerRef.current(info);
  }).current;

  // ── Actions ──
  const handleLike = async (moment: Moment) => {
    console.log("User tapped like button (explore) for post:", moment.id);
    if (likeLoading || !currentUserId) return;
    const current = postInteractions.get(moment.id);
    if (!current) return;

    setLikeLoading(true);
    const wasLiked = current.isLiked;

    setPostInteractions((prev) => {
      const m = new Map(prev);
      const i = m.get(moment.id);
      if (i) m.set(moment.id, { ...i, isLiked: !wasLiked, stats: { ...i.stats, like_count: wasLiked ? Math.max(0, i.stats.like_count - 1) : i.stats.like_count + 1 } });
      return m;
    });

    try {
      if (wasLiked) {
        await supabase.from("post_likes").delete().eq("post_id", moment.id).eq("user_id", currentUserId);
        console.log("Explore feed: post unliked");
      } else {
        await supabase.from("post_likes").insert({ post_id: moment.id, user_id: currentUserId });
        console.log("Explore feed: post liked");
      }
    } catch (e) {
      console.error("Explore feed: error toggling like:", e);
      setPostInteractions((prev) => {
        const m = new Map(prev);
        const i = m.get(moment.id);
        if (i) m.set(moment.id, { ...i, isLiked: wasLiked, stats: { ...i.stats, like_count: wasLiked ? i.stats.like_count + 1 : Math.max(0, i.stats.like_count - 1) } });
        return m;
      });
    } finally {
      setLikeLoading(false);
    }
  };

  const handleComment = async (moment: Moment) => {
    console.log("User tapped comment button (explore) for post:", moment.id);
    setShowCommentsModal(true);
    commentsSheetRef.current?.expand();
    setCommentsLoading(true);
    try {
      const { data, error } = await supabase
        .from("comments")
        .select("*, profiles!comments_user_id_fkey (display_name, avatar_url)")
        .eq("post_id", moment.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setComments(data || []);
      console.log("Explore feed: comments loaded:", data?.length || 0);
    } catch (e) {
      console.error("Explore feed: error loading comments:", e);
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleSubmitComment = async () => {
    const trimmed = newComment.trim();
    if (!trimmed || commentSubmitting || !currentUserId) return;
    const moment = feed[currentIndex];
    if (!moment) return;
    console.log("Explore feed: submitting comment for post:", moment.id);
    setCommentSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("comments")
        .insert({ post_id: moment.id, user_id: currentUserId, comment_text: trimmed })
        .select("*, profiles!comments_user_id_fkey (display_name, avatar_url)")
        .single();
      if (error) throw error;
      setComments((prev) => [...prev, data]);
      setNewComment("");
      setPostInteractions((prev) => {
        const m = new Map(prev);
        const i = m.get(moment.id);
        if (i) m.set(moment.id, { ...i, stats: { ...i.stats, comment_count: i.stats.comment_count + 1 } });
        return m;
      });
      console.log("Explore feed: comment submitted successfully");
    } catch (e) {
      console.error("Explore feed: error submitting comment:", e);
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleSave = (moment: Moment) => {
    console.log("User tapped save button (explore) for post:", moment.id);
    Alert.alert("Saved!", "This moment has been saved.");
  };

  const handleShare = async (moment: Moment) => {
    console.log("User tapped share button (explore) for post:", moment.id);
    if (!moment.video_url || isSharing) return;
    setIsSharing(true);
    try {
      const shareMessage = moment.caption || "";
      const result = await Share.share({ message: shareMessage, url: moment.video_url });
      if (result.action === Share.sharedAction) {
        console.log("Explore feed: share completed successfully");
        showToast("Shared", "success");
      }
    } catch (e) {
      console.error("Explore feed: error sharing:", e);
      showToast("Couldn't share", "error");
    } finally {
      setIsSharing(false);
    }
  };

  const handleFollowToggle = async (moment: Moment) => {
    console.log("User tapped follow/unfollow (explore) for user:", moment.user_id);
    if (followLoading || !currentUserId || moment.user_id === currentUserId) return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await supabase.from("follows").delete().eq("follower_id", currentUserId).eq("following_id", moment.user_id);
        setIsFollowing(false);
        console.log("Explore feed: unfollowed user:", moment.user_id);
      } else {
        await supabase.from("follows").insert({ follower_id: currentUserId, following_id: moment.user_id });
        setIsFollowing(true);
        console.log("Explore feed: followed user:", moment.user_id);
      }
    } catch (e) {
      console.error("Explore feed: error toggling follow:", e);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleMoreOptions = (moment: Moment) => {
    console.log("User tapped more options (explore) for post:", moment.id);
    if (moment.user_id === currentUserId) return;
    setShowMoreModal(true);
  };

  const handleBlockUser = async () => {
    const moment = feed[currentIndex];
    if (!moment || !currentUserId || moment.user_id === currentUserId) return;
    console.log("User tapped block/unblock (explore) for user:", moment.user_id);
    setShowMoreModal(false);
    setBlockLoading(true);
    try {
      if (isBlocked) {
        await authenticatedDelete(`/api/blocks/${moment.user_id}`);
        setIsBlocked(false);
        showToast("User unblocked", "success");
      } else {
        await authenticatedPost("/api/blocks", { blocked_id: moment.user_id });
        setIsBlocked(true);
        setIsFollowing(false);
        showToast("User blocked", "success");
        setFeed((prev) => prev.filter((m) => m.user_id !== moment.user_id));
      }
    } catch (e) {
      console.error("Explore feed: error blocking user:", e);
      showToast("Failed to update block status", "error");
    } finally {
      setBlockLoading(false);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return "??";
    const parts = name.split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const renderBackdrop = (props: any) => (
    <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} pressBehavior="close" />
  );

  // ── Render item ──
  const renderItem = useCallback(
    ({ item: moment, index }: { item: Moment; index: number }) => {
      if (!moment?.video_url) return null;

      const displayName = moment.user?.display_name || moment.user?.username || "Unknown";
      const avatarUrl = moment.user?.avatar_url || "";
      const caption = moment.caption || "";
      const isOwnVideo = currentUserId === moment.user_id;
      const initials = getInitials(displayName);
      const isActive = index === currentIndex;

      const interaction = postInteractions.get(moment.id) || {
        isLiked: false,
        isSaved: false,
        stats: { like_count: 0, comment_count: 0, share_count: 0 },
      };

      const likeCountText = String(interaction.stats.like_count);
      const commentCountText = String(interaction.stats.comment_count);
      const shareCountText = String(interaction.stats.share_count);
      const shareDisabled = !moment.video_url || isSharing;

      const placeName = moment.places?.[0]?.place_name || "";
      const placeId = moment.places?.[0]?.place_id || "";

      return (
        <View style={styles.slide}>
          <VideoPlayer
            videoUrl={moment.video_url}
            postId={moment.id}
            isActive={isActive}
            onPlayingChange={(playing) => {
              setPlayingMap((prev) => { const m = new Map(prev); m.set(moment.id, playing); return m; });
            }}
            onTogglePlayPause={(fn) => { toggleFnMap.current.set(moment.id, fn); }}
          />

          <View style={styles.overlay}>
            {/* Explore label top */}
            <View style={[styles.topControls, { paddingTop: insets.top + 8 }]}>
              <Text style={styles.exploreLabel}>Explore</Text>
            </View>

            {/* Bottom info */}
            <View style={[styles.bottomInfo, { paddingBottom: insets.bottom + 80 }]}>
              <View style={styles.infoContent}>
                {/* User row */}
                <View style={styles.userRowContainer}>
                  <TouchableOpacity
                    style={styles.userRow}
                    onPress={() => {
                      console.log("User tapped profile (explore), navigating to:", moment.user_id);
                      router.push(`/user/${moment.user_id}` as any);
                    }}
                    activeOpacity={0.7}
                  >
                    {avatarUrl ? (
                      <Image source={resolveImageSource(avatarUrl)} style={styles.avatar} />
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarInitials}>{initials}</Text>
                      </View>
                    )}
                    <Text style={styles.displayName}>{displayName}</Text>
                  </TouchableOpacity>
                  {!isOwnVideo && (
                    <TouchableOpacity
                      style={[styles.followBtn, { backgroundColor: isFollowing ? "rgba(255,255,255,0.2)" : PINK }]}
                      onPress={() => handleFollowToggle(moment)}
                      disabled={followLoading}
                      activeOpacity={0.7}
                    >
                      {followLoading ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <Text style={styles.followBtnText}>{isFollowing ? "Following" : "Follow"}</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>

                {caption ? <Text style={styles.caption} numberOfLines={3}>{caption}</Text> : null}

                {placeName ? (
                  <TouchableOpacity
                    style={styles.locationRow}
                    onPress={() => {
                      console.log("User tapped location chip (explore):", placeName);
                      if (placeId) router.push(`/location/${placeId}` as any);
                    }}
                    activeOpacity={0.7}
                  >
                    <IconSymbol android_material_icon_name="location-on" size={14} color={PINK} />
                    <Text style={styles.placeName}>{placeName}</Text>
                  </TouchableOpacity>
                ) : null}

                {/* Action buttons */}
                <View style={styles.actionButtons}>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => handleLike(moment)} disabled={likeLoading} activeOpacity={0.7}>
                    <IconSymbol
                      android_material_icon_name={interaction.isLiked ? "favorite" : "favorite-border"}
                      size={28}
                      color={interaction.isLiked ? PINK : "#FFF"}
                    />
                    <Text style={styles.actionBtnText}>{likeCountText}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.actionBtn} onPress={() => handleComment(moment)} activeOpacity={0.7}>
                    <IconSymbol android_material_icon_name="chat-bubble-outline" size={28} color="#FFF" />
                    <Text style={styles.actionBtnText}>{commentCountText}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.actionBtn} onPress={() => handleSave(moment)} activeOpacity={0.7}>
                    <IconSymbol
                      android_material_icon_name={interaction.isSaved ? "bookmark" : "bookmark-border"}
                      size={28}
                      color={interaction.isSaved ? PINK : "#FFF"}
                    />
                    <Text style={styles.actionBtnText}>Save</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, { opacity: shareDisabled ? 0.5 : 1 }]}
                    onPress={() => handleShare(moment)}
                    disabled={shareDisabled}
                    activeOpacity={0.7}
                  >
                    <IconSymbol android_material_icon_name="share" size={28} color="#FFF" />
                    <Text style={styles.actionBtnText}>{shareCountText}</Text>
                  </TouchableOpacity>

                  {!isOwnVideo && (
                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleMoreOptions(moment)} activeOpacity={0.7}>
                      <IconSymbol android_material_icon_name="more-horiz" size={28} color="#FFF" />
                      <Text style={styles.actionBtnText}>More</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          </View>
        </View>
      );
    },
    [currentIndex, currentUserId, postInteractions, isFollowing, followLoading, isSharing, insets]
  );

  const keyExtractor = useCallback((item: Moment) => item.id, []);

  // ── Loading ──
  if (loading) {
    return (
      <View style={styles.center}>
        <StatusBar hidden />
        <ActivityIndicator size="large" color={PINK} />
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <View style={styles.center}>
        <StatusBar hidden />
        <Film size={48} color="rgba(255,255,255,0.3)" strokeWidth={1.5} />
        <Text style={styles.emptyTitle}>Couldn't load videos</Text>
        <Text style={styles.emptySubtitle}>{error}</Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => {
            console.log("User tapped retry on explore feed");
            setLoading(true);
            fetchMoments(false, null);
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
      <View style={styles.center}>
        <StatusBar hidden />
        <Film size={48} color="rgba(255,255,255,0.3)" strokeWidth={1.5} />
        <Text style={styles.emptyTitle}>Nothing here yet</Text>
        <Text style={styles.emptySubtitle}>Be the first to share a moment on Floomingo</Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => {
            console.log("User tapped refresh on empty explore feed");
            setLoading(true);
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
    <GestureHandlerRootView style={styles.container}>
      <StatusBar hidden />
      <FlatList
        ref={flatListRef}
        data={feed}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={height}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={handleViewableItemsChanged}
        viewabilityConfig={VIEWABILITY_CONFIG}
        onEndReached={() => {
          if (!loadingMore && hasMore && nextCursor) {
            setLoadingMore(true);
            console.log("Explore feed: loading more moments");
            fetchMoments(false, nextCursor);
          }
        }}
        onEndReachedThreshold={0.5}
        removeClippedSubviews
        maxToRenderPerBatch={3}
        windowSize={5}
        getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
      />

      {/* Comments Bottom Sheet */}
      {showCommentsModal && (
        <BottomSheet
          ref={commentsSheetRef}
          index={0}
          snapPoints={["60%", "90%"]}
          backdropComponent={renderBackdrop}
          onClose={() => setShowCommentsModal(false)}
          backgroundStyle={{ backgroundColor: "#1A1A1A" }}
          handleIndicatorStyle={{ backgroundColor: "rgba(255,255,255,0.3)" }}
        >
          <View style={styles.commentsHeader}>
            <Text style={styles.commentsTitle}>Comments</Text>
          </View>
          <BottomSheetScrollView contentContainerStyle={styles.commentsList}>
            {commentsLoading ? (
              <ActivityIndicator color={PINK} style={{ marginTop: 20 }} />
            ) : comments.length === 0 ? (
              <Text style={styles.noComments}>No comments yet. Be the first!</Text>
            ) : (
              comments.map((c) => (
                <View key={c.id} style={styles.commentRow}>
                  <View style={styles.commentAvatar}>
                    <Text style={styles.commentAvatarText}>
                      {getInitials(c.profiles?.display_name || "?")}
                    </Text>
                  </View>
                  <View style={styles.commentBody}>
                    <Text style={styles.commentName}>{c.profiles?.display_name || "Unknown"}</Text>
                    <Text style={styles.commentText}>{c.comment_text}</Text>
                  </View>
                </View>
              ))
            )}
          </BottomSheetScrollView>
          <View style={styles.commentInputRow}>
            <View style={styles.commentInput}>
              <Text style={styles.commentInputPlaceholder} onPress={() => {}}>
                {newComment || "Add a comment…"}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.commentSendBtn, { opacity: commentSubmitting ? 0.5 : 1 }]}
              onPress={handleSubmitComment}
              disabled={commentSubmitting}
              activeOpacity={0.7}
            >
              <IconSymbol android_material_icon_name="send" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        </BottomSheet>
      )}

      {/* More Options Modal */}
      <Modal
        visible={showMoreModal}
        onClose={() => setShowMoreModal(false)}
        title="Options"
      >
        <TouchableOpacity
          style={styles.modalOption}
          onPress={handleBlockUser}
          disabled={blockLoading}
          activeOpacity={0.7}
        >
          {blockLoading ? (
            <ActivityIndicator color={PINK} />
          ) : (
            <Text style={styles.modalOptionText}>{isBlocked ? "Unblock User" : "Block User"}</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.modalOption}
          onPress={() => {
            console.log("User tapped report (explore)");
            setShowMoreModal(false);
            showToast("Report functionality coming soon", "info");
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.modalOptionText}>Report</Text>
        </TouchableOpacity>
      </Modal>

      {/* Toast */}
      <Toast
        visible={toastVisible}
        message={toastMessage}
        type={toastType}
        onHide={() => setToastVisible(false)}
      />
    </GestureHandlerRootView>
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
  slide: {
    width,
    height,
    backgroundColor: "#000",
  },
  video: {
    ...StyleSheet.absoluteFillObject,
  },
  playPauseOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  playPauseIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  playPauseIconText: {
    fontSize: 32,
    color: "#FFFFFF",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
  },
  topControls: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  exploreLabel: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  bottomInfo: {
    paddingHorizontal: 16,
  },
  infoContent: {
    flex: 1,
  },
  userRowContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#FFF",
    marginRight: 8,
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: PINK,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  avatarInitials: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFF",
  },
  displayName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFF",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  followBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginLeft: 10,
  },
  followBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFF",
  },
  caption: {
    fontSize: 14,
    color: "#FFF",
    marginBottom: 6,
    lineHeight: 20,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 10,
  },
  placeName: {
    fontSize: 13,
    color: "#FFF",
    fontWeight: "600",
  },
  actionButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    marginTop: 4,
  },
  actionBtn: {
    alignItems: "center",
    gap: 2,
  },
  actionBtnText: {
    fontSize: 12,
    color: "#FFF",
    fontWeight: "600",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  commentsHeader: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  commentsTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFF",
    textAlign: "center",
  },
  commentsList: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  noComments: {
    color: "rgba(255,255,255,0.4)",
    textAlign: "center",
    marginTop: 24,
    fontSize: 14,
  },
  commentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 10,
    gap: 10,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: PINK,
    justifyContent: "center",
    alignItems: "center",
  },
  commentAvatarText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFF",
  },
  commentBody: {
    flex: 1,
  },
  commentName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFF",
    marginBottom: 2,
  },
  commentText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
    lineHeight: 19,
  },
  commentInputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
    gap: 10,
  },
  commentInput: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  commentInputPlaceholder: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
  },
  commentSendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: PINK,
    justifyContent: "center",
    alignItems: "center",
  },
  modalOption: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  modalOptionText: {
    fontSize: 16,
    color: "#FFF",
    textAlign: "center",
  },
});
