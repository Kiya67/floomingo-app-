
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
  Modal,
  Alert,
} from "react-native";
import { supabase } from "@/lib/supabase";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { FilterModal } from "@/components/FilterModal";
import { SaveToTripsModal } from "@/components/SaveToTripsModal";
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
  isMuted,
  onToggleMute,
  isActive,
}: {
  videoUrl: string;
  postId: string;
  isMuted: boolean;
  onToggleMute: () => void;
  isActive: boolean;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const isMountedRef = useRef(true);

  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop = true;
    p.muted = isMuted;
  });

  useEffect(() => {
    if (player) player.muted = isMuted;
  }, [isMuted, player]);

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
      } catch {}
    }
  }, [player, postId, isActive]);

  const handleTap = () => {
    console.log("User tapped video - toggling play/pause");
    if (!player) return;
    try {
      if (isPlaying) {
        player.pause();
        setIsPlaying(false);
      } else {
        player.play();
        setIsPlaying(true);
      }
    } catch {}
  };

  if (!videoUrl) return null;

  return (
    <>
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
            <IconSymbol ios_icon_name="play.fill" android_material_icon_name="play-arrow" size={64} color="#FFFFFF" />
          </View>
        )}
      </TouchableOpacity>
      <TouchableOpacity style={styles.muteButton} onPress={onToggleMute} activeOpacity={0.7}>
        <IconSymbol
          ios_icon_name={isMuted ? "speaker.slash.fill" : "speaker.wave.2.fill"}
          android_material_icon_name={isMuted ? "volume-off" : "volume-up"}
          size={24}
          color="#FFFFFF"
        />
      </TouchableOpacity>
    </>
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
  const [isMuted, setIsMuted] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [viewedPostIds, setViewedPostIds] = useState<Set<string>>(new Set());

  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterPlaceId, setFilterPlaceId] = useState<string | null>(null);
  const [filterPlaceName, setFilterPlaceName] = useState<string | null>(null);
  const [filterKeywords, setFilterKeywords] = useState<string | null>(null);

  const [showMoreModal, setShowMoreModal] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);

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
    console.log("HomeScreen (iOS): Fetching posts with filters:", { filterPlaceId, filterKeywords });
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
        console.error("HomeScreen (iOS): Error fetching posts:", error);
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
        console.log("HomeScreen (iOS): Posts fetched:", filtered.length);
        setPosts(filtered);
        if (user && filtered[0]) {
          await loadPostInteractions(filtered[0].id, user.id);
        }
      }
    } catch (e) {
      console.error("HomeScreen (iOS): fetchPosts error:", e);
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
      console.log("HomeScreen (iOS) focused - fetching posts");
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
    console.log("User tapped filter button on home screen (iOS)");
    setShowFilterModal(true);
  };

  const handleApplyFilters = (placeId: string | null, placeName: string | null, keywords: string | null) => {
    console.log("User applied filters on home screen (iOS):", { placeId, placeName, keywords });
    setFilterPlaceId(placeId);
    setFilterPlaceName(placeName);
    setFilterKeywords(keywords);
    setShowFilterModal(false);
  };

  const handleClearFilters = () => {
    console.log("User cleared filters on home screen (iOS)");
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
    console.log("User tapped follow/unfollow (iOS)");
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
    console.log("User tapped comment button (iOS)");
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
    console.log("Submitting comment (iOS):", trimmed);
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
    console.log("User tapped share for post (iOS):", post.id);
    if (!post.video_url || isSharing) return;
    setIsSharing(true);
    try {
      let msg = post.caption || "";
      if (post.place_name) msg = msg ? `${msg} • ${post.place_name}` : post.place_name;
      const result = await Share.share({ message: msg, url: post.video_url });
      if (result.action === Share.sharedAction) {
        console.log("User completed share (iOS)");
        if (currentUserId) {
          await supabase.from("post_shares").insert({ post_id: post.id, user_id: currentUserId, share_target: "system" });
          await loadPostInteractions(post.id, currentUserId);
        }
        Alert.alert("Shared");
      }
    } catch (e) {
      console.error("Error sharing:", e);
      Alert.alert("Couldn't share");
    } finally {
      setIsSharing(false);
    }
  };

  const handleMoreOptions = (post: Post) => {
    console.log("User tapped more options (iOS)");
    if (post.user_id === currentUserId) return;
    setShowMoreModal(true);
  };

  const handleBlockUser = async () => {
    console.log("User tapped block user (iOS)");
    const post = posts[currentIndex];
    if (!post || !currentUserId || post.user_id === currentUserId) return;
    setShowMoreModal(false);
    setBlockLoading(true);
    try {
      if (isBlocked) {
        await authenticatedDelete<{ success: boolean }>(`/api/blocks/${post.user_id}`);
        setIsBlocked(false);
        Alert.alert("User unblocked");
      } else {
        await authenticatedPost<{ success: boolean }>("/api/blocks", { blocked_id: post.user_id });
        await supabase.from("follows").delete().or(`and(follower_id.eq.${currentUserId},following_id.eq.${post.user_id}),and(follower_id.eq.${post.user_id},following_id.eq.${currentUserId})`);
        setIsBlocked(true);
        setIsFollowing(false);
        Alert.alert("User blocked");
        setTimeout(() => fetchPosts(), 1000);
      }
    } catch {
      Alert.alert("Error", "Failed to update block status");
    } finally {
      setBlockLoading(false);
    }
  };

  const handleReportUser = () => {
    console.log("User tapped report user (iOS)");
    setShowMoreModal(false);
    Alert.alert("Report User", "Report functionality coming soon");
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
    const likeIconIos = interaction.isLiked ? "heart.fill" : "heart";
    const saveColor = interaction.isSaved ? "#FF69B4" : "#FFFFFF";
    const saveIconIos = interaction.isSaved ? "bookmark.fill" : "bookmark";

    return (
      <View style={styles.videoSlide}>
        <VideoPlayer
          videoUrl={post.video_url}
          postId={post.id}
          isMuted={isMuted}
          onToggleMute={() => { console.log("User toggled mute (iOS)"); setIsMuted((p) => !p); }}
          isActive={isActive}
        />

        <View style={styles.overlay}>
          <View style={styles.topControls}>
            <TouchableOpacity style={styles.filterButton} onPress={handleFilterPress} accessibilityLabel="Filter videos">
              <IconSymbol
                ios_icon_name="line.3.horizontal.decrease.circle"
                android_material_icon_name="filter-list"
                size={24}
                color="#FFFFFF"
              />
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
                      <IconSymbol ios_icon_name="mappin.circle.fill" android_material_icon_name="location-on" size={14} color="#FF69B4" />
                      <Text style={styles.locationChipVideoText}>{loc.place_name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : placeName ? (
                <TouchableOpacity style={styles.locationRow} onPress={() => handleLocationPress(post)} activeOpacity={0.7}>
                  <IconSymbol ios_icon_name="mappin.circle.fill" android_material_icon_name="location-on" size={16} color="#FF69B4" />
                  <Text style={styles.placeName}>{placeName}</Text>
                </TouchableOpacity>
              ) : null}

              <View style={styles.actionButtons}>
                <TouchableOpacity style={styles.actionButton} onPress={() => handleLike(post)} disabled={likeLoading} activeOpacity={0.7}>
                  <IconSymbol ios_icon_name={likeIconIos} android_material_icon_name={interaction.isLiked ? "favorite" : "favorite-border"} size={28} color={likeColor} />
                  <Text style={styles.actionButtonText}>{likeCountText}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={() => handleComment(post)} activeOpacity={0.7}>
                  <IconSymbol ios_icon_name="bubble.left" android_material_icon_name="chat-bubble-outline" size={28} color="#FFFFFF" />
                  <Text style={styles.actionButtonText}>{commentCountText}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={() => handleSave(post)} activeOpacity={0.7}>
                  <IconSymbol ios_icon_name={saveIconIos} android_material_icon_name={interaction.isSaved ? "bookmark" : "bookmark-border"} size={28} color={saveColor} />
                  <Text style={styles.actionButtonText}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionButton, { opacity: shareDisabled ? 0.5 : 1 }]} onPress={() => handleShare(post)} disabled={shareDisabled} activeOpacity={0.7}>
                  <IconSymbol ios_icon_name="square.and.arrow.up" android_material_icon_name="share" size={28} color="#FFFFFF" />
                  <Text style={styles.actionButtonText}>{shareCountText}</Text>
                </TouchableOpacity>
                {!isOwnVideo && (
                  <TouchableOpacity style={styles.actionButton} onPress={() => handleMoreOptions(post)} activeOpacity={0.7}>
                    <IconSymbol ios_icon_name="ellipsis" android_material_icon_name="more-horiz" size={28} color="#FFFFFF" />
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
  const blockIconIos = isBlocked ? "checkmark.circle" : "hand.raised.fill";
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
          <IconSymbol ios_icon_name="line.3.horizontal.decrease.circle" android_material_icon_name="filter-list" size={24} color="#FFFFFF" />
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

      <Modal visible={showMoreModal} transparent animationType="fade" onRequestClose={() => setShowMoreModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>More Options</Text>
            <TouchableOpacity style={styles.modalOptionButton} onPress={handleBlockUser} disabled={blockLoading} activeOpacity={0.7}>
              {blockLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <IconSymbol ios_icon_name={blockIconIos} android_material_icon_name={isBlocked ? "check-circle" : "block"} size={24} color={blockTextColor} />
                  <Text style={[styles.modalOptionText, { color: blockTextColor }]}>{blockButtonText}</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalOptionButton} onPress={handleReportUser} activeOpacity={0.7}>
              <IconSymbol ios_icon_name="flag" android_material_icon_name="flag" size={24} color="#FFFFFF" />
              <Text style={[styles.modalOptionText, { color: "#FFFFFF" }]}>Report User</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalButton, { backgroundColor: "#333", marginTop: 16 }]} onPress={() => setShowMoreModal(false)} activeOpacity={0.8}>
              <Text style={[styles.modalButtonText, { color: "#FFFFFF" }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
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
                  <IconSymbol ios_icon_name="paperplane.fill" android_material_icon_name="send" size={20} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </BottomSheet>
      )}

      <Modal visible={showDeleteCommentModal} transparent animationType="fade" onRequestClose={() => setShowDeleteCommentModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Delete Comment?</Text>
            <Text style={styles.modalMessage}>This will permanently delete your comment.</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, { backgroundColor: "#333" }]} onPress={() => { setShowDeleteCommentModal(false); setDeleteCommentId(null); }} activeOpacity={0.8}>
                <Text style={[styles.modalButtonText, { color: "#FFFFFF" }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, { backgroundColor: "#FF3B30" }]} onPress={confirmDeleteComment} activeOpacity={0.8}>
                <Text style={[styles.modalButtonText, { color: "#FFFFFF" }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {selectedPost && (
        <SaveToTripsModal isVisible={showSaveModal} onClose={handleSaveModalClose} post={selectedPost} />
      )}

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
  muteButton: {
    position: "absolute",
    top: 110,
    right: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 20,
    padding: 8,
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
  },
  topControls: {
    paddingTop: 60,
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  filterButton: {
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: "#1C1C1E",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 360,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 16,
  },
  modalMessage: {
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
    marginBottom: 20,
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
  modalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
