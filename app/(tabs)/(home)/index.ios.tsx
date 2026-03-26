
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
  TextInput,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Film } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useVideoPlayer, VideoView } from "expo-video";
import * as Haptics from "expo-haptics";
import { apiGet, authenticatedPost, authenticatedDelete } from "@/utils/api";
import { supabase } from "@/lib/supabase";
import { IconSymbol } from "@/components/IconSymbol";
import { SaveToTripsModal } from "@/components/SaveToTripsModal";
import { FilterModal } from "@/components/FilterModal";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from "@gorhom/bottom-sheet";

const PINK = "#FF3B7A";
const { width, height } = Dimensions.get("window");

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

  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop = true;
  });

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      try {
        if (player && player.playing) player.pause();
      } catch {}
    };
  }, [player]);

  useEffect(() => {
    if (!player) return;
    if (isActive) {
      console.log("Home feed (iOS): video active, playing:", postId);
      const t = setTimeout(() => {
        if (isMountedRef.current) {
          try {
            player.play();
            setIsPlaying(true);
            onPlayingChange(true);
          } catch (e) {
            console.error("Error playing video:", e);
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
    console.log("User tapped video to toggle play/pause (iOS), post:", postId);
    if (!player) return;
    try {
      if (isPlaying) {
        player.pause();
        setIsPlaying(false);
        onPlayingChange(false);
      } else {
        player.play();
        setIsPlaying(true);
        onPlayingChange(true);
      }
    } catch (e) {
      console.error("Error toggling play/pause:", e);
    }
  }, [player, isPlaying, onPlayingChange, postId]);

  useEffect(() => {
    onTogglePlayPause(toggle);
  }, [toggle]);

  if (!videoUrl) return null;

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
      {!isPlaying && (
        <View style={styles.playPauseIndicator}>
          <IconSymbol ios_icon_name="play.fill" android_material_icon_name="play-arrow" size={64} color="#FFFFFF" />
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
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

  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterPlaceId, setFilterPlaceId] = useState<string | null>(null);
  const [filterPlaceName, setFilterPlaceName] = useState<string | null>(null);
  const [filterKeywords, setFilterKeywords] = useState<string | null>(null);

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [selectedMoment, setSelectedMoment] = useState<Moment | null>(null);

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

  const commentsSheetRef = useRef<BottomSheet>(null);

  // ── Auth ──
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
  }, []);

  // ── Fetch feed ──
  const fetchMoments = useCallback(
    async (isRefresh = false, cursor: string | null = null) => {
      let endpoint = `/api/moments?limit=20`;
      if (cursor) endpoint += `&cursor=${encodeURIComponent(cursor)}`;
      if (filterPlaceId) endpoint += `&place_id=${encodeURIComponent(filterPlaceId)}`;
      if (filterKeywords) endpoint += `&keywords=${encodeURIComponent(filterKeywords)}`;

      console.log("Home feed (iOS): fetching moments, isRefresh:", isRefresh, "cursor:", cursor);
      try {
        const data = await apiGet<{ moments: Moment[]; next_cursor: string | null }>(endpoint);
        const moments = data.moments || [];
        const newNextCursor = data.next_cursor ?? null;
        console.log("Home feed (iOS): fetched", moments.length, "moments");

        if (isRefresh || !cursor) {
          setFeed(moments);
          setCurrentIndex(0);
        } else {
          setFeed((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            return [...prev, ...moments.filter((m) => !existingIds.has(m.id))];
          });
        }

        setNextCursor(newNextCursor);
        setHasMore(!!newNextCursor);
        setError(null);

        if ((isRefresh || !cursor) && moments[0] && currentUserId) {
          loadPostInteractions(moments[0].id, currentUserId);
        }
      } catch (e: any) {
        console.error("Home feed (iOS): fetch error:", e);
        setError("Couldn't load videos. Check your connection.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [filterPlaceId, filterKeywords, currentUserId]
  );

  useFocusEffect(
    useCallback(() => {
      console.log("HomeScreen (iOS) focused - loading fullscreen feed");
      setLoading(true);
      setNextCursor(null);
      setHasMore(true);
      fetchMoments(false, null);
    }, [fetchMoments])
  );

  // ── Interactions ──
  const loadPostInteractions = useCallback(async (postId: string, userId: string) => {
    try {
      const [likeRes, statsRes, savedRes] = await Promise.all([
        supabase.from("post_likes").select("*").eq("post_id", postId).eq("user_id", userId).limit(1),
        supabase.from("post_stats").select("*").eq("post_id", postId).single(),
        supabase.from("board_posts").select("id, board_id, boards!inner(user_id)").eq("post_id", postId).eq("boards.user_id", userId).limit(1),
      ]);

      const isLiked = !!(likeRes.data && likeRes.data.length > 0);
      const isSaved = !!(savedRes.data && savedRes.data.length > 0);
      const stats = statsRes.data
        ? { like_count: statsRes.data.like_count || 0, comment_count: statsRes.data.comment_count || 0, share_count: statsRes.data.share_count || 0 }
        : { like_count: 0, comment_count: 0, share_count: 0 };

      setPostInteractions((prev) => {
        const m = new Map(prev);
        m.set(postId, { isLiked, isSaved, stats });
        return m;
      });
    } catch (e) {
      console.error("Error loading post interactions:", e);
    }
  }, []);

  const handleViewableItemsChanged = useCallback(
    ({ viewableItems }: any) => {
      if (viewableItems.length > 0) {
        const newIndex = viewableItems[0].index;
        setCurrentIndex(newIndex);
        const moment = feed[newIndex];
        if (moment && currentUserId) {
          loadPostInteractions(moment.id, currentUserId);

          if (!viewedPostIds.has(moment.id) && moment.user_id !== currentUserId) {
            console.log("Home feed (iOS): incrementing view count for:", moment.id);
            authenticatedPost("/api/rpc/increment-view", { postId: moment.id })
              .then(() => setViewedPostIds((prev) => new Set(prev).add(moment.id)))
              .catch((e) => console.error("Error incrementing view count:", e));
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
    },
    [feed, currentUserId, loadPostInteractions, viewedPostIds]
  );

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  // ── Actions ──
  const handleLike = async (moment: Moment) => {
    console.log("User tapped like button for post (iOS):", moment.id);
    if (likeLoading || !currentUserId) return;
    const current = postInteractions.get(moment.id);
    if (!current) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
        console.log("Post unliked");
      } else {
        await supabase.from("post_likes").insert({ post_id: moment.id, user_id: currentUserId });
        console.log("Post liked");
      }
    } catch (e) {
      console.error("Error toggling like:", e);
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
    console.log("User tapped comment button for post (iOS):", moment.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
      console.log("Comments loaded:", data?.length || 0);
    } catch (e) {
      console.error("Error loading comments:", e);
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
    console.log("Submitting comment for post (iOS):", moment.id);
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
      console.log("Comment submitted successfully");
    } catch (e) {
      console.error("Error submitting comment:", e);
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleSave = (moment: Moment) => {
    console.log("User tapped save button for post (iOS):", moment.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedMoment(moment);
    setShowSaveModal(true);
  };

  const handleSaveModalClose = () => {
    console.log("Closing save modal (iOS)");
    setShowSaveModal(false);
    setSelectedMoment(null);
    const moment = feed[currentIndex];
    if (moment && currentUserId) loadPostInteractions(moment.id, currentUserId);
  };

  const handleShare = async (moment: Moment) => {
    console.log("User tapped share button for post (iOS):", moment.id);
    if (!moment.video_url || isSharing) return;
    setIsSharing(true);
    try {
      const shareMessage = moment.caption || "";
      const result = await Share.share({ message: shareMessage, url: moment.video_url });
      if (result.action === Share.sharedAction) {
        console.log("Share completed successfully");
      }
    } catch (e) {
      console.error("Error sharing:", e);
      Alert.alert("Couldn't share");
    } finally {
      setIsSharing(false);
    }
  };

  const handleFollowToggle = async (moment: Moment) => {
    console.log("User tapped follow/unfollow for user (iOS):", moment.user_id);
    if (followLoading || !currentUserId || moment.user_id === currentUserId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await supabase.from("follows").delete().eq("follower_id", currentUserId).eq("following_id", moment.user_id);
        setIsFollowing(false);
        console.log("Unfollowed user:", moment.user_id);
      } else {
        await supabase.from("follows").insert({ follower_id: currentUserId, following_id: moment.user_id });
        setIsFollowing(true);
        console.log("Followed user:", moment.user_id);
      }
    } catch (e) {
      console.error("Error toggling follow:", e);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleMoreOptions = (moment: Moment) => {
    console.log("User tapped more options for post (iOS):", moment.id);
    if (moment.user_id === currentUserId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert("Options", undefined, [
      {
        text: "Block User",
        style: "destructive",
        onPress: async () => {
          console.log("User confirmed block for user:", moment.user_id);
          try {
            await authenticatedPost("/api/blocks", { blocked_id: moment.user_id });
            setIsFollowing(false);
            setFeed((prev) => prev.filter((m) => m.user_id !== moment.user_id));
            console.log("User blocked successfully");
          } catch (e) {
            console.error("Error blocking user:", e);
            Alert.alert("Error", "Failed to block user");
          }
        },
      },
      {
        text: "Report",
        onPress: () => {
          console.log("User tapped report for post:", moment.id);
          Alert.alert("Report", "Report functionality coming soon");
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleFilterPress = () => {
    console.log("User tapped filter button on home feed (iOS)");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowFilterModal(true);
  };

  const handleApplyFilters = (placeId: string | null, placeName: string | null, keywords: string | null) => {
    console.log("User applied filters (iOS):", { placeId, placeName, keywords });
    setFilterPlaceId(placeId);
    setFilterPlaceName(placeName);
    setFilterKeywords(keywords);
    setShowFilterModal(false);
  };

  const handleClearFilters = () => {
    console.log("User cleared filters on home feed (iOS)");
    setFilterPlaceId(null);
    setFilterPlaceName(null);
    setFilterKeywords(null);
    setShowFilterModal(false);
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
            {/* Filter button top-left */}
            <View style={[styles.topControls, { paddingTop: insets.top + 8 }]}>
              <TouchableOpacity style={styles.filterButton} onPress={handleFilterPress} activeOpacity={0.8}>
                <IconSymbol ios_icon_name="line.3.horizontal.decrease.circle" android_material_icon_name="filter-list" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Bottom info */}
            <View style={[styles.bottomInfo, { paddingBottom: insets.bottom + 80 }]}>
              <View style={styles.infoContent}>
                {/* User row */}
                <View style={styles.userRowContainer}>
                  <TouchableOpacity
                    style={styles.userRow}
                    onPress={() => {
                      console.log("User tapped profile (iOS), navigating to:", moment.user_id);
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
                      console.log("User tapped location chip (iOS):", placeName);
                      if (placeId) router.push(`/location/${placeId}` as any);
                    }}
                    activeOpacity={0.7}
                  >
                    <IconSymbol ios_icon_name="mappin.circle.fill" android_material_icon_name="location-on" size={14} color={PINK} />
                    <Text style={styles.placeName}>{placeName}</Text>
                  </TouchableOpacity>
                ) : null}

                {/* Action buttons */}
                <View style={styles.actionButtons}>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => handleLike(moment)} disabled={likeLoading} activeOpacity={0.7}>
                    <IconSymbol
                      ios_icon_name={interaction.isLiked ? "heart.fill" : "heart"}
                      android_material_icon_name={interaction.isLiked ? "favorite" : "favorite-border"}
                      size={28}
                      color={interaction.isLiked ? PINK : "#FFF"}
                    />
                    <Text style={styles.actionBtnText}>{likeCountText}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.actionBtn} onPress={() => handleComment(moment)} activeOpacity={0.7}>
                    <IconSymbol ios_icon_name="bubble.left" android_material_icon_name="chat-bubble-outline" size={28} color="#FFF" />
                    <Text style={styles.actionBtnText}>{commentCountText}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.actionBtn} onPress={() => handleSave(moment)} activeOpacity={0.7}>
                    <IconSymbol
                      ios_icon_name={interaction.isSaved ? "bookmark.fill" : "bookmark"}
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
                    <IconSymbol ios_icon_name="square.and.arrow.up" android_material_icon_name="share" size={28} color="#FFF" />
                    <Text style={styles.actionBtnText}>{shareCountText}</Text>
                  </TouchableOpacity>

                  {!isOwnVideo && (
                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleMoreOptions(moment)} activeOpacity={0.7}>
                      <IconSymbol ios_icon_name="ellipsis" android_material_icon_name="more-horiz" size={28} color="#FFF" />
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
            console.log("User tapped retry on home feed (iOS)");
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
            console.log("User tapped refresh on empty home feed (iOS)");
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
        viewabilityConfig={viewabilityConfig}
        onEndReached={() => {
          if (!loadingMore && hasMore && nextCursor) {
            setLoadingMore(true);
            console.log("Home feed (iOS): loading more moments");
            fetchMoments(false, nextCursor);
          }
        }}
        onEndReachedThreshold={0.5}
        removeClippedSubviews
        maxToRenderPerBatch={3}
        windowSize={5}
        getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
      />

      {/* Filter Modal */}
      <FilterModal
        visible={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        onApply={handleApplyFilters}
        onClear={handleClearFilters}
        currentPlaceId={filterPlaceId}
        currentPlaceName={filterPlaceName}
        currentKeywords={filterKeywords}
      />

      {/* Save Modal */}
      {showSaveModal && selectedMoment && (
        <SaveToTripsModal
          visible={showSaveModal}
          onClose={handleSaveModalClose}
          post={{
            id: selectedMoment.id,
            user_id: selectedMoment.user_id,
            video_url: selectedMoment.video_url,
            caption: selectedMoment.caption || "",
            place_id: selectedMoment.places?.[0]?.place_id ?? null,
            place_name: selectedMoment.places?.[0]?.place_name ?? null,
            location_type: null,
            created_at: selectedMoment.created_at,
          }}
        />
      )}

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
            <TextInput
              style={styles.commentInput}
              value={newComment}
              onChangeText={setNewComment}
              placeholder="Add a comment…"
              placeholderTextColor="rgba(255,255,255,0.4)"
              returnKeyType="send"
              onSubmitEditing={handleSubmitComment}
            />
            <TouchableOpacity
              style={[styles.commentSendBtn, { opacity: commentSubmitting ? 0.5 : 1 }]}
              onPress={handleSubmitComment}
              disabled={commentSubmitting}
              activeOpacity={0.7}
            >
              <IconSymbol ios_icon_name="paperplane.fill" android_material_icon_name="send" size={18} color="#FFF" />
            </TouchableOpacity>
          </View>
        </BottomSheet>
      )}
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
  playPauseIndicator: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
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
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
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
    color: "#FFF",
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
});
