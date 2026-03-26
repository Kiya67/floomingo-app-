
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
  TouchableOpacity,
  ScrollView,
  Animated,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { Heart, Bookmark, Share2, MapPin, Play, Film } from "lucide-react-native";
import { apiGet, authenticatedPost } from "@/utils/api";
import { supabase } from "@/lib/supabase";

const PINK = "#FF3B7A";
const { width, height } = Dimensions.get("window");

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

interface ExperienceSummary {
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
  linked_experience?: ExperienceSummary;
  likes_count: number;
  bookmarks_count: number;
  is_liked: boolean;
  is_bookmarked: boolean;
  places: Place[];
  user: UserSummary;
  created_at: string;
}

function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
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

function VideoPlayer({
  videoUrl,
  momentId,
  isActive,
}: {
  videoUrl: string;
  momentId: string;
  isActive: boolean;
}) {
  const isMountedRef = useRef(true);
  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop = true;
  });

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      try { if (player?.playing) player.pause(); } catch {}
    };
  }, [player]);

  useEffect(() => {
    if (!player) return;
    if (isActive) {
      const t = setTimeout(() => {
        if (isMountedRef.current) {
          try {
            player.play();
            console.log("Moments: video playing for moment:", momentId);
          } catch (e) {
            console.error("Moments: error playing video:", e);
          }
        }
      }, 300);
      return () => clearTimeout(t);
    } else {
      try { player.pause(); } catch {}
    }
  }, [player, momentId, isActive]);

  const handleTap = useCallback(() => {
    console.log("User tapped moment video - toggling play/pause:", momentId);
    if (!player) return;
    try {
      if (player.playing) { player.pause(); } else { player.play(); }
    } catch {}
  }, [player, momentId]);

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
    </TouchableOpacity>
  );
}

export default function MomentsScreen() {
  const router = useRouter();
  const [moments, setMoments] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [interactions, setInteractions] = useState<Map<string, { is_liked: boolean; is_bookmarked: boolean; likes_count: number; bookmarks_count: number }>>(new Map());
  const flatListRef = useRef<FlatList>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
  }, []);

  const fetchMoments = useCallback(async (cursor?: string) => {
    console.log("Moments: fetching moments, cursor:", cursor);
    try {
      const params = new URLSearchParams({ limit: "20" });
      if (cursor) params.set("cursor", cursor);
      const data = await apiGet<{ moments: Moment[]; next_cursor: string | null }>(`/api/moments?${params}`);
      const newMoments = Array.isArray(data?.moments) ? data.moments : [];
      if (cursor) {
        setMoments((prev) => [...prev, ...newMoments]);
      } else {
        setMoments(newMoments);
      }
      setNextCursor(data?.next_cursor ?? null);
      // Seed interactions from API response
      setInteractions((prev) => {
        const m = new Map(prev);
        newMoments.forEach((moment) => {
          if (!m.has(moment.id)) {
            m.set(moment.id, {
              is_liked: moment.is_liked,
              is_bookmarked: moment.is_bookmarked,
              likes_count: Number(moment.likes_count) || 0,
              bookmarks_count: Number(moment.bookmarks_count) || 0,
            });
          }
        });
        return m;
      });
      setError(null);
    } catch (e: any) {
      console.error("Moments: fetch error:", e);
      if (!cursor) setError("Couldn't load moments. Check your connection.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      isMountedRef.current = true;
      console.log("MomentsScreen focused - fetching moments");
      setLoading(true);
      fetchMoments();
      return () => { isMountedRef.current = false; };
    }, [fetchMoments])
  );

  const handleLoadMore = useCallback(() => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    fetchMoments(nextCursor);
  }, [nextCursor, loadingMore, fetchMoments]);

  const handleViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index ?? 0);
    }
  }, []);

  const handleLike = useCallback(async (moment: Moment) => {
    console.log("User tapped like on moment:", moment.id);
    if (!currentUserId) return;
    const cur = interactions.get(moment.id) ?? { is_liked: moment.is_liked, is_bookmarked: moment.is_bookmarked, likes_count: moment.likes_count, bookmarks_count: moment.bookmarks_count };
    const wasLiked = cur.is_liked;
    setInteractions((prev) => {
      const m = new Map(prev);
      m.set(moment.id, { ...cur, is_liked: !wasLiked, likes_count: wasLiked ? Math.max(0, cur.likes_count - 1) : cur.likes_count + 1 });
      return m;
    });
    try {
      const res = await authenticatedPost<{ liked: boolean; likes_count: number }>(`/api/moments/${moment.id}/like`, {});
      setInteractions((prev) => {
        const m = new Map(prev);
        const existing = m.get(moment.id) ?? cur;
        m.set(moment.id, { ...existing, is_liked: res.liked, likes_count: Number(res.likes_count) || 0 });
        return m;
      });
    } catch (e) {
      console.error("Moments: like error:", e);
      setInteractions((prev) => {
        const m = new Map(prev);
        m.set(moment.id, cur);
        return m;
      });
    }
  }, [currentUserId, interactions]);

  const handleBookmark = useCallback(async (moment: Moment) => {
    console.log("User tapped bookmark on moment:", moment.id);
    if (!currentUserId) return;
    const cur = interactions.get(moment.id) ?? { is_liked: moment.is_liked, is_bookmarked: moment.is_bookmarked, likes_count: moment.likes_count, bookmarks_count: moment.bookmarks_count };
    const wasBookmarked = cur.is_bookmarked;
    setInteractions((prev) => {
      const m = new Map(prev);
      m.set(moment.id, { ...cur, is_bookmarked: !wasBookmarked, bookmarks_count: wasBookmarked ? Math.max(0, cur.bookmarks_count - 1) : cur.bookmarks_count + 1 });
      return m;
    });
    try {
      const res = await authenticatedPost<{ bookmarked: boolean; bookmarks_count: number }>(`/api/moments/${moment.id}/bookmark`, {});
      setInteractions((prev) => {
        const m = new Map(prev);
        const existing = m.get(moment.id) ?? cur;
        m.set(moment.id, { ...existing, is_bookmarked: res.bookmarked, bookmarks_count: Number(res.bookmarks_count) || 0 });
        return m;
      });
    } catch (e) {
      console.error("Moments: bookmark error:", e);
      setInteractions((prev) => {
        const m = new Map(prev);
        m.set(moment.id, cur);
        return m;
      });
    }
  }, [currentUserId, interactions]);

  const handleShare = useCallback(async (moment: Moment) => {
    console.log("User tapped share on moment:", moment.id);
    try {
      await Share.share({ message: moment.caption || "Check out this moment on Floomingo!", url: moment.video_url });
    } catch (e) {
      console.error("Moments: share error:", e);
    }
  }, []);

  const handleProfilePress = useCallback((userId: string) => {
    console.log("User tapped profile on moment, userId:", userId);
    router.push(`/user/${userId}` as any);
  }, [router]);

  const handlePlacePress = useCallback((place: Place) => {
    console.log("User tapped place pill on moment:", place.place_name);
    router.push(`/location/${place.place_id}` as any);
  }, [router]);

  const handleExperiencePress = useCallback((experienceId: string) => {
    console.log("User tapped Watch Experience pill, experienceId:", experienceId);
    router.push(`/experience/${experienceId}` as any);
  }, [router]);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  const renderItem = useCallback(({ item: moment, index }: { item: Moment; index: number }) => {
    if (!moment?.video_url) return null;
    const isActive = index === currentIndex;
    const inter = interactions.get(moment.id) ?? { is_liked: moment.is_liked, is_bookmarked: moment.is_bookmarked, likes_count: moment.likes_count, bookmarks_count: moment.bookmarks_count };
    const username = moment.user?.username || "unknown";
    const avatarUrl = moment.user?.avatar_url || "";
    const initials = getInitials(username);
    const caption = moment.caption || "";
    const likeColor = inter.is_liked ? PINK : "#FFFFFF";
    const bookmarkColor = inter.is_bookmarked ? PINK : "#FFFFFF";
    const likesText = String(Number(inter.likes_count) || 0);
    const bookmarksText = String(Number(inter.bookmarks_count) || 0);
    const hasLinkedExperience = !!moment.linked_experience_id;
    const linkedExpTitle = moment.linked_experience?.title || "Watch Experience";

    return (
      <View style={styles.slide}>
        <VideoPlayer videoUrl={moment.video_url} momentId={moment.id} isActive={isActive} />
        <View style={styles.overlay}>
          {/* Bottom info */}
          <View style={styles.bottomSection}>
            <View style={styles.leftContent}>
              <TouchableOpacity style={styles.userRow} onPress={() => handleProfilePress(moment.user_id)} activeOpacity={0.8}>
                {avatarUrl ? (
                  <Image source={resolveImageSource(avatarUrl)} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarInitials}>{initials}</Text>
                  </View>
                )}
                <Text style={styles.username}>@{username}</Text>
              </TouchableOpacity>

              {caption ? (
                <Text style={styles.caption} numberOfLines={3}>{caption}</Text>
              ) : null}

              {moment.places && moment.places.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.placesScroll} contentContainerStyle={styles.placesScrollContent}>
                  {moment.places.map((place) => (
                    <TouchableOpacity
                      key={place.id}
                      style={styles.placePill}
                      onPress={() => handlePlacePress(place)}
                      activeOpacity={0.8}
                    >
                      <MapPin size={12} color={PINK} strokeWidth={2} />
                      <Text style={styles.placePillText}>{place.place_name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : null}

              {hasLinkedExperience ? (
                <TouchableOpacity
                  style={styles.experiencePill}
                  onPress={() => handleExperiencePress(moment.linked_experience_id!)}
                  activeOpacity={0.8}
                >
                  <Film size={13} color="#FFFFFF" strokeWidth={2} />
                  <Text style={styles.experiencePillText}>{linkedExpTitle}</Text>
                  <Text style={styles.experiencePillArrow}>→</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={styles.rightActions}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => handleLike(moment)} activeOpacity={0.8}>
                <Heart size={26} color={likeColor} fill={inter.is_liked ? PINK : "transparent"} strokeWidth={2} />
                <Text style={styles.actionCount}>{likesText}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => handleBookmark(moment)} activeOpacity={0.8}>
                <Bookmark size={26} color={bookmarkColor} fill={inter.is_bookmarked ? PINK : "transparent"} strokeWidth={2} />
                <Text style={styles.actionCount}>{bookmarksText}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => handleShare(moment)} activeOpacity={0.8}>
                <Share2 size={26} color="#FFFFFF" strokeWidth={2} />
                <Text style={styles.actionCount}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  }, [currentIndex, interactions, handleLike, handleBookmark, handleShare, handleProfilePress, handlePlacePress, handleExperiencePress]);

  if (loading) {
    return (
      <View style={styles.center}>
        <StatusBar hidden />
        <ActivityIndicator size="large" color={PINK} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <StatusBar hidden />
        <Play size={48} color="rgba(255,255,255,0.3)" strokeWidth={1.5} />
        <Text style={styles.emptyTitle}>Couldn't load moments</Text>
        <Text style={styles.emptySubtitle}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); fetchMoments(); }} activeOpacity={0.8}>
          <Text style={styles.retryBtnText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (moments.length === 0) {
    return (
      <View style={styles.center}>
        <StatusBar hidden />
        <Play size={48} color="rgba(255,255,255,0.3)" strokeWidth={1.5} />
        <Text style={styles.emptyTitle}>No moments yet</Text>
        <Text style={styles.emptySubtitle}>Be the first to share a travel moment</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <FlatList
        ref={flatListRef}
        data={moments}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={height}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={handleViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        removeClippedSubviews
        maxToRenderPerBatch={2}
        windowSize={3}
        ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color={PINK} style={{ marginVertical: 20 }} /> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center", paddingHorizontal: 32 },
  slide: { width, height, backgroundColor: "#000" },
  video: { width, height, position: "absolute" },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end" },
  bottomSection: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingBottom: 100,
    gap: 12,
  },
  leftContent: { flex: 1, gap: 8 },
  userRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#333" },
  avatarFallback: { width: 36, height: 36, borderRadius: 18, backgroundColor: PINK, justifyContent: "center", alignItems: "center" },
  avatarInitials: { fontSize: 13, fontWeight: "700", color: "#FFF" },
  username: { fontSize: 14, fontWeight: "700", color: "#FFF", textShadowColor: "rgba(0,0,0,0.5)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  caption: { fontSize: 14, color: "rgba(255,255,255,0.9)", lineHeight: 20, textShadowColor: "rgba(0,0,0,0.5)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  placesScroll: { maxHeight: 32 },
  placesScrollContent: { gap: 8, paddingRight: 8 },
  placePill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,59,122,0.2)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: "rgba(255,59,122,0.4)" },
  placePillText: { fontSize: 12, color: "#FFF", fontWeight: "600" },
  experiencePill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)", alignSelf: "flex-start" },
  experiencePillText: { fontSize: 13, color: "#FFF", fontWeight: "600" },
  experiencePillArrow: { fontSize: 13, color: "rgba(255,255,255,0.7)" },
  rightActions: { gap: 20, alignItems: "center", paddingBottom: 4 },
  actionBtn: { alignItems: "center", gap: 4 },
  actionCount: { fontSize: 12, color: "#FFF", fontWeight: "600", textShadowColor: "rgba(0,0,0,0.5)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: "#FFF", marginTop: 16, textAlign: "center" },
  emptySubtitle: { fontSize: 14, color: "rgba(255,255,255,0.5)", marginTop: 8, textAlign: "center", lineHeight: 20 },
  retryBtn: { marginTop: 20, backgroundColor: PINK, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  retryBtnText: { fontSize: 15, fontWeight: "700", color: "#FFF" },
});
