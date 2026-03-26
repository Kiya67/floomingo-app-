
import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
  Dimensions,
  StatusBar,
  Image,
  ImageSourcePropType,
  FlatList,
  Share,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { supabase } from "@/lib/supabase";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { FilterModal } from "@/components/FilterModal";
import { SaveToTripsModal } from "@/components/SaveToTripsModal";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { IconSymbol } from "@/components/IconSymbol";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { authenticatedGet, authenticatedPost, authenticatedDelete, apiGet, authenticatedApiCall } from "@/utils/api";
import { colors } from "@/styles/commonStyles";
import { OnboardingTooltip, shouldShowOnboardingTooltip } from "@/components/OnboardingTooltip";

interface Post {
  id: string;
  user_id: string;
  video_url: string;
  caption: string;
  place_id: string | null;
  place_name: string | null;
  location_type: string | null;
  created_at: string;
  view_count?: number;
  profiles?: {
    display_name: string;
    avatar_url: string | null;
  };
}

interface PostLocation {
  id: string;
  post_id: string;
  place_id: string;
  place_name: string;
  location_type: string;
  display_order: number;
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

const { width, height } = Dimensions.get("window");

function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: "" };
  if (typeof source === "string") return { uri: source };
  return source as ImageSourcePropType;
}

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
      const t = setTimeout(() => {
        if (isMountedRef.current) {
          try {
            player.play();
            setIsPlaying(true);
            onPlayingChange(true);
            console.log("Video playing for post:", postId);
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
    console.log("User tapped play/pause button");
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
    } catch {}
  }, [player, isPlaying, onPlayingChange]);

  useEffect(() => {
    onTogglePlayPause(toggle);
  }, [toggle]);

  const handleTap = () => {
    console.log("User tapped video - toggling play/pause");
    toggle();
  };

  if (!videoUrl) return null;

  return (
    <TouchableOpacity style={styles.video} activeOpacity={1} onPress={handleTap}>
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
          <IconSymbol android_material_icon_name="play-arrow" size={64} color="#FFFFFF" />
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [playingMap, setPlayingMap] = useState<Map<string, boolean>>(new Map());
  const toggleFnMap = useRef<Map<string, () => void>>(new Map());
  const [viewedPostIds, setViewedPostIds] = useState<Set<string>>(new Set());

  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterPlaceId, setFilterPlaceId] = useState<string | null>(null);
  const [filterPlaceName, setFilterPlaceName] = useState<string | null>(null);
  const [filterKeywords, setFilterKeywords] = useState<string | null>(null);

  const [showMoreModal, setShowMoreModal] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error" | "info">("info");

  const [postInteractions, setPostInteractions] = useState<
    Map<string, { isLiked: boolean; isSaved: boolean; stats: PostStats }>
  >(new Map());
  const [postLocations, setPostLocations] = useState<Map<string, PostLocation[]>>(new Map());
  const [likeLoading, setLikeLoading] = useState(false);

  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [deleteCommentId, setDeleteCommentId] = useState<string | null>(null);
  const [showDeleteCommentModal, setShowDeleteCommentModal] = useState(false);

  const [showOnboardingTooltip, setShowOnboardingTooltip] = useState(false);

  const commentsSheetRef = useRef<BottomSheet>(null);
  const flatListRef = useRef<FlatList>(null);
  const isMountedRef = useRef(true);

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  useFocusEffect(
    useCallback(() => {
      const checkOnboarding = async () => {
        const shouldShow = await shouldShowOnboardingTooltip();
        if (shouldShow) setTimeout(() => setShowOnboardingTooltip(true), 500);
      };
      checkOnboarding();
    }, [])
  );

  const loadPostLocations = useCallback(async (postId: string) => {
    try {
      const data = await apiGet<PostLocation[]>(`/api/posts/${postId}/locations`);
      setPostLocations((prev) => {
        const m = new Map(prev);
        m.set(postId, data && data.length > 0 ? data : []);
        return m;
      });
    } catch {
      setPostLocations((prev) => {
        const m = new Map(prev);
        m.set(postId, []);
        return m;
      });
    }
  }, []);

  const loadPostInteractions = useCallback(
    async (postId: string, userId: string) => {
      try {
        const [{ data: likeData }, { data: statsData }, { data: savedData }] = await Promise.all([
          supabase.from("post_likes").select("*").eq("post_id", postId).eq("user_id", userId).limit(1),
          supabase.from("post_stats").select("*").eq("post_id", postId).single(),
          supabase
            .from("board_posts")
            .select("id, board_id, boards!inner(user_id)")
            .eq("post_id", postId)
            .eq("boards.user_id", userId)
            .limit(1),
        ]);
        const isLiked = !!(likeData && likeData.length > 0);
        const isSaved = !!(savedData && savedData.length > 0);
        const stats = statsData
          ? { like_count: statsData.like_count || 0, comment_count: statsData.comment_count || 0, share_count: statsData.share_count || 0 }
          : { like_count: 0, comment_count: 0, share_count: 0 };
        setPostInteractions((prev) => {
          const m = new Map(prev);
          m.set(postId, { isLiked, isSaved, stats });
          return m;
        });
        await loadPostLocations(postId);
      } catch {
        setPostInteractions((prev) => {
          const m = new Map(prev);
          m.set(postId, { isLiked: false, isSaved: false, stats: { like_count: 0, comment_count: 0, share_count: 0 } });
          return m;
        });
      }
    },
    [loadPostLocations]
  );

  const checkBlockStatus = useCallback(async (targetUserId: string) => {
    try {
      const data = await authenticatedGet<{ isBlocked: boolean }>(`/api/blocks/check/${targetUserId}`);
      setIsBlocked(data.isBlocked || false);
    } catch {
      setIsBlocked(false);
    }
  }, []);

  const fetchPosts = useCallback(async () => {
    console.log("HomeScreen: Fetching posts with filters:", { filterPlaceId, filterKeywords });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);

      let blockedUserIds: string[] = [];
      if (user) {
        try {
          const blocksData = await authenticatedApiCall<any[]>("/api/blocks", { method: "GET" });
          blockedUserIds = blocksData.map((b: any) => (b.blockerId === user.id ? b.blockedId : b.blockerId));
        } catch {}
      }

      let query = supabase
        .from("posts")
        .select(`*, profiles!posts_user_id_fkey (display_name, avatar_url)`)
        .order("created_at", { ascending: false });

      if (filterPlaceId) query = query.eq("place_id", filterPlaceId);
      if (blockedUserIds.length > 0) query = query.not("user_id", "in", `(${blockedUserIds.join(",")})`);

      const { data, error } = await query;
      if (error) {
        console.error("HomeScreen: Error fetching posts:", error);
        setPosts([]);
      } else {
        let filtered = Array.isArray(data) ? data : [];
        if (filterKeywords && filterKeywords.trim()) {
          const kws = filterKeywords.toLowerCase().split(/[\s,]+/).filter((k) => k.length > 0);
          filtered = filtered.filter((p) => {
            const text = `${(p?.caption ?? "").toLowerCase()} ${(p?.place_name ?? "").toLowerCase()}`;
            return kws.every((k) => text.includes(k));
          });
        }
        console.log("HomeScreen: Posts fetched:", filtered.length);
        setPosts(filtered);
        if (user && filtered[0]) {
          await loadPostInteractions(filtered[0].id, user.id);
        }
      }
    } catch (e) {
      console.error("HomeScreen: fetchPosts error:", e);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [filterPlaceId, filterKeywords, loadPostInteractions]);

  useEffect(() => {
    const hasPlace = params.filterPlaceId && params.filterPlaceId !== "";
    const hasKw = params.filterKeywords && params.filterKeywords !== "";
    if (hasPlace || hasKw) {
      if (hasPlace) { setFilterPlaceId(params.filterPlaceId as string); setFilterPlaceName(params.filterPlaceName as string); }
      else { setFilterPlaceId(null); setFilterPlaceName(null); }
      if (hasKw) setFilterKeywords(params.filterKeywords as string);
      else setFilterKeywords(null);
    } else if (params.filterPlaceId === "" && params.filterPlaceName === "" && params.filterKeywords === "") {
      setFilterPlaceId(null); setFilterPlaceName(null); setFilterKeywords(null);
    }
  }, [params.filterPlaceId, params.filterPlaceName, params.filterKeywords]);

  useFocusEffect(
    useCallback(() => {
      isMountedRef.current = true;
      console.log("HomeScreen focused - fetching posts");
      fetchPosts();
      return () => { isMountedRef.current = false; };
    }, [fetchPosts])
  );

  const incrementViewCount = useCallback(
    async (postId: string, postOwnerId: string) => {
      if (viewedPostIds.has(postId) || !currentUserId || currentUserId === postOwnerId) return;
      try {
        await authenticatedPost<{ view_count: number | null }>("/api/rpc/increment-view", { postId });
        setViewedPostIds((prev) => new Set(prev).add(postId));
      } catch {}
    },
    [currentUserId, viewedPostIds]
  );

  const handleViewableItemsChanged = useCallback(
    ({ viewableItems }: any) => {
      if (viewableItems.length > 0) {
        const idx = viewableItems[0].index;
        setCurrentIndex(idx);
        const post = posts[idx];
        if (post && currentUserId) {
          loadPostInteractions(post.id, currentUserId);
          checkBlockStatus(post.user_id);
          incrementViewCount(post.id, post.user_id);
          if (post.user_id !== currentUserId) {
            supabase
              .from("follows")
              .select("*")
              .eq("follower_id", currentUserId)
              .eq("following_id", post.user_id)
              .limit(1)
              .then(({ data }) => setIsFollowing(!!(data && data.length > 0)));
          } else {
            setIsFollowing(false);
          }
        }
      }
    },
    [posts, currentUserId, loadPostInteractions, checkBlockStatus, incrementViewCount]
  );

  const viewabilityConfig = { itemVisiblePercentThreshold: 50 };

  const handleFilterPress = () => {
    console.log("User tapped filter button on home screen");
    setShowFilterModal(true);
  };

  const handleApplyFilters = (placeId: string | null, placeName: string | null, keywords: string | null) => {
    console.log("User applied filters on home screen:", { placeId, placeName, keywords });
    setFilterPlaceId(placeId);
    setFilterPlaceName(placeName);
    setFilterKeywords(keywords);
    setShowFilterModal(false);
  };

  const handleClearFilters = () => {
    console.log("User cleared filters on home screen");
    setFilterPlaceId(null);
    setFilterPlaceName(null);
    setFilterKeywords(null);
    setShowFilterModal(false);
  };

  const handleProfilePress = (post: Post) => {
    if (post?.user_id) {
      console.log("User tapped profile:", post.user_id);
      router.push(`/user/${post.user_id}` as any);
    }
  };

  const handleLocationPress = (post: Post) => {
    if (post?.place_id) {
      console.log("User tapped location:", post.place_id);
      router.push(`/location/${post.place_id}` as any);
    }
  };

  const handleFollowToggle = async (post: Post) => {
    console.log("User tapped follow/unfollow");
    if (followLoading || !post?.user_id || !currentUserId || post.user_id === currentUserId) return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await supabase.from("follows").delete().eq("follower_id", currentUserId).eq("following_id", post.user_id);
        setIsFollowing(false);
      } else {
        await supabase.from("follows").insert({ follower_id: currentUserId, following_id: post.user_id });
        setIsFollowing(true);
      }
    } catch (e) {
      console.error("Error toggling follow:", e);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleLike = async (post: Post) => {
    console.log("User tapped like for post:", post.id);
    if (likeLoading || !currentUserId) return;
    const cur = postInteractions.get(post.id);
    if (!cur) return;
    setLikeLoading(true);
    const wasLiked = cur.isLiked;
    setPostInteractions((prev) => {
      const m = new Map(prev);
      const i = m.get(post.id);
      if (i) m.set(post.id, { ...i, isLiked: !wasLiked, stats: { ...i.stats, like_count: wasLiked ? Math.max(0, i.stats.like_count - 1) : i.stats.like_count + 1 } });
      return m;
    });
    try {
      if (wasLiked) {
        await supabase.from("post_likes").delete().eq("post_id", post.id).eq("user_id", currentUserId);
      } else {
        await supabase.from("post_likes").insert({ post_id: post.id, user_id: currentUserId });
      }
    } catch {
      setPostInteractions((prev) => {
        const m = new Map(prev);
        const i = m.get(post.id);
        if (i) m.set(post.id, { ...i, isLiked: wasLiked, stats: { ...i.stats, like_count: wasLiked ? i.stats.like_count + 1 : Math.max(0, i.stats.like_count - 1) } });
        return m;
      });
    } finally {
      setLikeLoading(false);
    }
  };

  const handleComment = async (post: Post) => {
    console.log("User tapped comment button");
    setShowCommentsModal(true);
    commentsSheetRef.current?.expand();
    setCommentsLoading(true);
    try {
      const { data, error } = await supabase
        .from("comments")
        .select(`*, profiles!comments_user_id_fkey (display_name, avatar_url)`)
        .eq("post_id", post.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setComments(data || []);
    } catch {
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleSubmitComment = async () => {
    const trimmed = newComment.trim();
    if (!trimmed || commentSubmitting || !currentUserId) return;
    const post = posts[currentIndex];
    if (!post) return;
    console.log("Submitting comment:", trimmed);
    setCommentSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("comments")
        .insert({ post_id: post.id, user_id: currentUserId, comment_text: trimmed })
        .select(`*, profiles!comments_user_id_fkey (display_name, avatar_url)`)
        .single();
      if (error) throw error;
      setComments((prev) => [...prev, data]);
      setPostInteractions((prev) => {
        const m = new Map(prev);
        const i = m.get(post.id);
        if (i) m.set(post.id, { ...i, stats: { ...i.stats, comment_count: i.stats.comment_count + 1 } });
        return m;
      });
      setNewComment("");
    } catch (e) {
      console.error("Error submitting comment:", e);
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleDeleteComment = (commentId: string, commentUserId: string) => {
    if (commentUserId !== currentUserId) return;
    setDeleteCommentId(commentId);
    setShowDeleteCommentModal(true);
  };

  const confirmDeleteComment = async () => {
    if (!deleteCommentId || !currentUserId) return;
    try {
      await supabase.from("comments").delete().eq("id", deleteCommentId).eq("user_id", currentUserId);
      setComments((prev) => prev.filter((c) => c.id !== deleteCommentId));
      const post = posts[currentIndex];
      if (post) {
        setPostInteractions((prev) => {
          const m = new Map(prev);
          const i = m.get(post.id);
          if (i) m.set(post.id, { ...i, stats: { ...i.stats, comment_count: Math.max(0, i.stats.comment_count - 1) } });
          return m;
        });
      }
    } catch {}
    setShowDeleteCommentModal(false);
    setDeleteCommentId(null);
  };

  const handleSave = (post: Post) => {
    console.log("User tapped save for post:", post.id);
    setSelectedPost(post);
    setShowSaveModal(true);
  };

  const handleSaveModalClose = () => {
    setShowSaveModal(false);
    setSelectedPost(null);
    const post = posts[currentIndex];
    if (post && currentUserId) loadPostInteractions(post.id, currentUserId);
  };

  const handleShare = async (post: Post) => {
    console.log("User tapped share for post:", post.id);
    if (!post.video_url || isSharing) return;
    setIsSharing(true);
    try {
      let msg = post.caption || "";
      if (post.place_name) msg = msg ? `${msg} • ${post.place_name}` : post.place_name;
      const result = await Share.share({ message: msg, url: post.video_url });
      if (result.action === Share.sharedAction) {
        console.log("User completed share");
        if (currentUserId) {
          await supabase.from("post_shares").insert({ post_id: post.id, user_id: currentUserId, share_target: "system" });
          await loadPostInteractions(post.id, currentUserId);
        }
        showToast("Shared", "success");
      }
    } catch (e) {
      console.error("Error sharing:", e);
      showToast("Couldn't share", "error");
    } finally {
      setIsSharing(false);
    }
  };

  const handleMoreOptions = (post: Post) => {
    console.log("User tapped more options");
    if (post.user_id === currentUserId) return;
    setShowMoreModal(true);
  };

  const handleBlockUser = async () => {
    console.log("User tapped block user");
    const post = posts[currentIndex];
    if (!post || !currentUserId || post.user_id === currentUserId) return;
    setShowMoreModal(false);
    setBlockLoading(true);
    try {
      if (isBlocked) {
        await authenticatedDelete<{ success: boolean }>(`/api/blocks/${post.user_id}`);
        setIsBlocked(false);
        showToast("User unblocked", "success");
      } else {
        await authenticatedPost<{ success: boolean }>("/api/blocks", { blocked_id: post.user_id });
        await supabase.from("follows").delete().or(`and(follower_id.eq.${currentUserId},following_id.eq.${post.user_id}),and(follower_id.eq.${post.user_id},following_id.eq.${currentUserId})`);
        setIsBlocked(true);
        setIsFollowing(false);
        showToast("User blocked", "success");
        setTimeout(() => fetchPosts(), 1000);
      }
    } catch {
      showToast("Failed to update block status", "error");
    } finally {
      setBlockLoading(false);
    }
  };

  const handleReportUser = () => {
    console.log("User tapped report user");
    setShowMoreModal(false);
    showToast("Report functionality coming soon", "info");
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

  const renderVideoItem = ({ item: post, index }: { item: Post; index: number }) => {
    if (!post?.video_url) return null;

    const displayName = post?.profiles?.display_name || "Unknown User";
    const avatarUrl = post?.profiles?.avatar_url || "";
    const caption = post?.caption || "";
    const placeName = post?.place_name || "";
    const isOwnVideo = currentUserId === post?.user_id;
    const initials = getInitials(displayName);
    const interaction = postInteractions.get(post.id) || { isLiked: false, isSaved: false, stats: { like_count: 0, comment_count: 0, share_count: 0 } };
    const likeCountText = String(interaction.stats.like_count);
    const commentCountText = String(interaction.stats.comment_count);
    const shareCountText = String(interaction.stats.share_count);
    const shareDisabled = !post.video_url || isSharing;
    const isActive = index === currentIndex;
    const locations = postLocations.get(post.id) || [];
    const followBg = isFollowing ? "rgba(255, 255, 255, 0.2)" : "#FF69B4";
    const likeColor = interaction.isLiked ? "#FF69B4" : "#FFFFFF";
    const likeIcon = interaction.isLiked ? "favorite" : "favorite-border";
    const saveColor = interaction.isSaved ? "#FF69B4" : "#FFFFFF";
    const saveIcon = interaction.isSaved ? "bookmark" : "bookmark-border";
    const isVideoPlaying = playingMap.get(post.id) ?? false;
    const playPauseIcon = isVideoPlaying ? "pause" : "play-arrow";

    return (
      <View style={styles.videoSlide}>
        <VideoPlayer
          videoUrl={post.video_url}
          postId={post.id}
          isActive={isActive}
          onPlayingChange={(playing) => {
            setPlayingMap((prev) => { const m = new Map(prev); m.set(post.id, playing); return m; });
          }}
          onTogglePlayPause={(fn) => { toggleFnMap.current.set(post.id, fn); }}
        />

        <View style={styles.overlay}>
          <View style={styles.topControls}>
            <TouchableOpacity style={styles.filterButton} onPress={handleFilterPress} accessibilityLabel="Filter videos">
              <IconSymbol android_material_icon_name="filter-list" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.playPauseButton}
              onPress={() => { console.log("User tapped play/pause overlay button"); toggleFnMap.current.get(post.id)?.(); }}
              activeOpacity={0.7}
            >
              <IconSymbol android_material_icon_name={playPauseIcon} size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.bottomInfo}>
            <View style={styles.infoContent}>
              <View style={styles.userRowContainer}>
                <TouchableOpacity style={styles.userRow} onPress={() => handleProfilePress(post)} activeOpacity={0.7}>
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
                    style={[styles.followButtonSmall, { backgroundColor: followBg }]}
                    onPress={() => handleFollowToggle(post)}
                    disabled={followLoading}
                    activeOpacity={0.7}
                  >
                    {followLoading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.followButtonSmallText}>{isFollowing ? "Following" : "Follow"}</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>

              {caption ? <Text style={styles.caption} numberOfLines={3}>{caption}</Text> : null}

              {locations.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.locationsScroll} contentContainerStyle={styles.locationsScrollContent}>
                  {locations.map((loc) => (
                    <TouchableOpacity
                      key={loc.id}
                      style={styles.locationChipVideo}
                      onPress={() => { console.log("User tapped location chip:", loc.place_name); router.push(`/location/${loc.place_id}` as any); }}
                      activeOpacity={0.7}
                    >
                      <IconSymbol android_material_icon_name="location-on" size={14} color="#FF69B4" />
                      <Text style={styles.locationChipVideoText}>{loc.place_name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : placeName ? (
                <TouchableOpacity style={styles.locationRow} onPress={() => handleLocationPress(post)} activeOpacity={0.7}>
                  <IconSymbol android_material_icon_name="location-on" size={16} color="#FF69B4" />
                  <Text style={styles.placeName}>{placeName}</Text>
                </TouchableOpacity>
              ) : null}

              <View style={styles.actionButtons}>
                <TouchableOpacity style={styles.actionButton} onPress={() => handleLike(post)} disabled={likeLoading} activeOpacity={0.7}>
                  <IconSymbol android_material_icon_name={likeIcon} size={28} color={likeColor} />
                  <Text style={styles.actionButtonText}>{likeCountText}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={() => handleComment(post)} activeOpacity={0.7}>
                  <IconSymbol android_material_icon_name="chat-bubble-outline" size={28} color="#FFFFFF" />
                  <Text style={styles.actionButtonText}>{commentCountText}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={() => handleSave(post)} activeOpacity={0.7}>
                  <IconSymbol android_material_icon_name={saveIcon} size={28} color={saveColor} />
                  <Text style={styles.actionButtonText}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionButton, { opacity: shareDisabled ? 0.5 : 1 }]} onPress={() => handleShare(post)} disabled={shareDisabled} activeOpacity={0.7}>
                  <IconSymbol android_material_icon_name="share" size={28} color="#FFFFFF" />
                  <Text style={styles.actionButtonText}>{shareCountText}</Text>
                </TouchableOpacity>
                {!isOwnVideo && (
                  <TouchableOpacity style={styles.actionButton} onPress={() => handleMoreOptions(post)} activeOpacity={0.7}>
                    <IconSymbol android_material_icon_name="more-horiz" size={28} color="#FFFFFF" />
                    <Text style={styles.actionButtonText}>More</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const blockButtonText = isBlocked ? "Unblock User" : "Block User";
  const blockIconName = isBlocked ? "check-circle" : "block";
  const blockTextColor = isBlocked ? colors.primary : "#FF3B30";

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar hidden />
        <ActivityIndicator size="large" color="#FF69B4" />
      </View>
    );
  }

  if (posts.length === 0) {
    const emptyText = filterPlaceId || filterKeywords ? "No moments found. Try clearing filters." : "No moments yet";
    return (
      <View style={styles.loadingContainer}>
        <StatusBar hidden />
        <TouchableOpacity style={styles.filterButtonEmpty} onPress={handleFilterPress}>
          <IconSymbol android_material_icon_name="filter-list" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.emptyText}>{emptyText}</Text>
        <Text style={styles.emptySubtext}>Check back soon for travel moments</Text>
        <FilterModal
          visible={showFilterModal}
          onClose={() => setShowFilterModal(false)}
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
    <GestureHandlerRootView style={styles.container}>
      <StatusBar hidden />

      <FlatList
        ref={flatListRef}
        data={posts}
        renderItem={renderVideoItem}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={height}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={handleViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        removeClippedSubviews
        maxToRenderPerBatch={2}
        windowSize={3}
      />

      <Modal visible={showMoreModal} onClose={() => setShowMoreModal(false)} title="More Options">
        <View style={{ gap: 12, marginBottom: 20 }}>
          <TouchableOpacity style={styles.modalOptionButton} onPress={handleBlockUser} disabled={blockLoading} activeOpacity={0.7}>
            {blockLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <IconSymbol android_material_icon_name={blockIconName} size={24} color={blockTextColor} />
                <Text style={[styles.modalOptionText, { color: blockTextColor }]}>{blockButtonText}</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.modalOptionButton} onPress={handleReportUser} activeOpacity={0.7}>
            <IconSymbol android_material_icon_name="flag" size={24} color="#FFFFFF" />
            <Text style={[styles.modalOptionText, { color: "#FFFFFF" }]}>Report User</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {showCommentsModal && (
        <BottomSheet
          ref={commentsSheetRef}
          index={0}
          snapPoints={["75%"]}
          enablePanDownToClose
          onClose={() => setShowCommentsModal(false)}
          backdropComponent={renderBackdrop}
          backgroundStyle={{ backgroundColor: "#1C1C1E" }}
          handleIndicatorStyle={{ backgroundColor: "rgba(255,255,255,0.4)" }}
        >
          <View style={styles.commentsContainer}>
            <Text style={styles.commentsTitle}>Comments</Text>
            <BottomSheetScrollView style={styles.commentsList}>
              {commentsLoading ? (
                <ActivityIndicator size="large" color="#FF69B4" style={{ marginTop: 20 }} />
              ) : comments.length === 0 ? (
                <Text style={styles.noCommentsText}>No comments yet. Be the first to comment!</Text>
              ) : (
                comments.map((comment) => {
                  const cName = comment.profiles?.display_name || "Unknown User";
                  const cAvatar = comment.profiles?.avatar_url || "";
                  const cInitials = getInitials(cName);
                  const cText = comment.comment_text || "";
                  const isOwn = comment.user_id === currentUserId;
                  return (
                    <TouchableOpacity
                      key={comment.id}
                      style={styles.commentItem}
                      onLongPress={() => isOwn ? handleDeleteComment(comment.id, comment.user_id) : null}
                      activeOpacity={isOwn ? 0.7 : 1}
                    >
                      <View style={styles.commentHeader}>
                        {cAvatar ? (
                          <Image source={resolveImageSource(cAvatar)} style={styles.commentAvatar} />
                        ) : (
                          <View style={styles.commentAvatarPlaceholder}>
                            <Text style={styles.commentAvatarInitials}>{cInitials}</Text>
                          </View>
                        )}
                        <View style={styles.commentContent}>
                          <View style={styles.commentAuthorRow}>
                            <Text style={styles.commentAuthor}>{cName}</Text>
                            {isOwn && <Text style={styles.commentYouBadge}>You</Text>}
                          </View>
                          <Text style={styles.commentText}>{cText}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </BottomSheetScrollView>
            <View style={styles.commentInputContainer}>
              <TextInput
                style={styles.commentInput}
                placeholder="Add a comment..."
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={newComment}
                onChangeText={setNewComment}
                multiline
              />
              <TouchableOpacity
                style={[styles.commentSendButton, { opacity: !newComment.trim() || commentSubmitting ? 0.5 : 1 }]}
                onPress={handleSubmitComment}
                disabled={commentSubmitting || !newComment.trim()}
              >
                {commentSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <IconSymbol android_material_icon_name="send" size={20} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </BottomSheet>
      )}

      <Modal
        visible={showDeleteCommentModal}
        onClose={() => { setShowDeleteCommentModal(false); setDeleteCommentId(null); }}
        title="Delete Comment?"
        message="This will permanently delete your comment."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDeleteComment}
        confirmColor="#FF3B30"
      />

      {selectedPost && (
        <SaveToTripsModal isVisible={showSaveModal} onClose={handleSaveModalClose} post={selectedPost} />
      )}

      <Toast message={toastMessage} visible={toastVisible} onHide={() => setToastVisible(false)} type={toastType} />

      <FilterModal
        visible={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        onApply={handleApplyFilters}
        onClear={handleClearFilters}
        initialPlaceId={filterPlaceId}
        initialPlaceName={filterPlaceName}
        initialKeywords={filterKeywords}
      />

      <OnboardingTooltip visible={showOnboardingTooltip} onDismiss={() => setShowOnboardingTooltip(false)} />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000000",
  },
  emptyText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 16,
  },
  emptySubtext: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 15,
    marginTop: 8,
    textAlign: "center",
  },
  filterButtonEmpty: {
    position: "absolute",
    top: 60,
    left: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 20,
    padding: 8,
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  videoSlide: {
    width,
    height,
    backgroundColor: "#000000",
  },
  video: {
    width,
    height,
  },
  playPauseIndicator: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: [{ translateX: -32 }, { translateY: -32 }],
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 40,
    padding: 12,
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
  },
  topControls: {
    paddingTop: 60,
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  playPauseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  bottomInfo: {
    paddingBottom: 100,
    paddingHorizontal: 16,
  },
  infoContent: {
    gap: 8,
  },
  userRowContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#333",
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FF69B4",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitials: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  displayName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  followButtonSmall: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 72,
    justifyContent: "center",
    alignItems: "center",
  },
  followButtonSmallText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  caption: {
    fontSize: 14,
    color: "#FFFFFF",
    lineHeight: 20,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  placeName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  locationsScroll: {
    maxHeight: 36,
  },
  locationsScrollContent: {
    gap: 8,
    paddingRight: 16,
  },
  locationChipVideo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    gap: 4,
    borderWidth: 1,
    borderColor: "rgba(255,105,180,0.4)",
  },
  locationChipVideoText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "flex-start",
    paddingTop: 4,
    paddingBottom: 4,
    gap: 20,
  },
  actionButton: {
    alignItems: "center",
    gap: 2,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  commentsContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  commentsTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
    color: "#FFFFFF",
  },
  commentsList: {
    flex: 1,
  },
  noCommentsText: {
    textAlign: "center",
    marginTop: 20,
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
  },
  commentItem: {
    marginBottom: 16,
  },
  commentHeader: {
    flexDirection: "row",
    gap: 10,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#333",
  },
  commentAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FF69B4",
    justifyContent: "center",
    alignItems: "center",
  },
  commentAvatarInitials: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  commentContent: {
    flex: 1,
  },
  commentAuthorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  commentYouBadge: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FF69B4",
  },
  commentText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#FFFFFF",
  },
  commentInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  commentInput: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 80,
    backgroundColor: "#333",
    color: "#FFFFFF",
  },
  commentSendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FF69B4",
    justifyContent: "center",
    alignItems: "center",
  },
  modalOptionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  modalOptionText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
