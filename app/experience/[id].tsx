
import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  Image,
  ImageSourcePropType,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Share,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { Heart, Bookmark, Share2, MapPin, Play, ChevronDown, ChevronUp } from "lucide-react-native";
import { apiGet, authenticatedPost } from "@/utils/api";
import { supabase } from "@/lib/supabase";
import { SafeAreaView } from "react-native-safe-area-context";

const PINK = "#FF3B7A";
const { width } = Dimensions.get("window");
const VIDEO_HEIGHT = width * (9 / 16);

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

interface MomentSummary {
  id: string;
  video_url: string;
  thumbnail_url?: string;
  caption?: string;
}

interface Experience {
  id: string;
  user_id: string;
  video_url: string;
  thumbnail_url?: string;
  title: string;
  description?: string;
  linked_moment_id?: string;
  linked_moment?: MomentSummary;
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

function ExperienceVideoPlayer({ videoUrl, experienceId }: { videoUrl: string; experienceId: string }) {
  const isMountedRef = useRef(true);
  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop = false;
  });

  useEffect(() => {
    isMountedRef.current = true;
    const t = setTimeout(() => {
      if (isMountedRef.current) {
        try {
          player.play();
          console.log("Experience player: video started for:", experienceId);
        } catch (e) {
          console.error("Experience player: error starting video:", e);
        }
      }
    }, 400);
    return () => {
      isMountedRef.current = false;
      clearTimeout(t);
      try { if (player?.playing) player.pause(); } catch {}
    };
  }, [player, experienceId]);

  const handleTap = useCallback(() => {
    console.log("User tapped experience video - toggling play/pause:", experienceId);
    if (!player) return;
    try {
      if (player.playing) { player.pause(); } else { player.play(); }
    } catch {}
  }, [player, experienceId]);

  return (
    <TouchableOpacity style={videoStyles.container} activeOpacity={1} onPress={handleTap}>
      <VideoView
        style={videoStyles.video}
        player={player}
        nativeControls={false}
        contentFit="contain"
        allowsFullscreen={false}
        allowsPictureInPicture={false}
      />
    </TouchableOpacity>
  );
}

const videoStyles = StyleSheet.create({
  container: { width, height: VIDEO_HEIGHT, backgroundColor: "#000" },
  video: { width, height: VIDEO_HEIGHT },
});

function SuggestedCard({ experience, onPress }: { experience: Experience; onPress: () => void }) {
  const THUMB_H = (width - 64) * (9 / 16);
  const username = experience.user?.username || "unknown";
  const avatarUrl = experience.user?.avatar_url || "";
  const initials = getInitials(username);
  const title = experience.title || "Untitled";
  const hasThumbnail = !!experience.thumbnail_url;

  return (
    <TouchableOpacity style={sugStyles.card} onPress={onPress} activeOpacity={0.9}>
      <View style={[sugStyles.thumb, { height: THUMB_H }]}>
        {hasThumbnail ? (
          <Image source={resolveImageSource(experience.thumbnail_url)} style={[sugStyles.thumbImg, { height: THUMB_H }]} resizeMode="cover" />
        ) : (
          <View style={[sugStyles.thumbPlaceholder, { height: THUMB_H }]}>
            <Play size={24} color="rgba(255,255,255,0.4)" strokeWidth={1.5} />
          </View>
        )}
      </View>
      <View style={sugStyles.info}>
        <Text style={sugStyles.title} numberOfLines={2}>{title}</Text>
        <View style={sugStyles.creatorRow}>
          {avatarUrl ? (
            <Image source={resolveImageSource(avatarUrl)} style={sugStyles.avatar} />
          ) : (
            <View style={sugStyles.avatarFallback}>
              <Text style={sugStyles.avatarInitials}>{initials}</Text>
            </View>
          )}
          <Text style={sugStyles.creatorName}>@{username}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const sugStyles = StyleSheet.create({
  card: { marginBottom: 16 },
  thumb: { borderRadius: 12, overflow: "hidden" },
  thumbImg: { width: "100%", backgroundColor: "#E5E7EB" },
  thumbPlaceholder: { width: "100%", backgroundColor: "#1A1A2E", justifyContent: "center", alignItems: "center" },
  info: { paddingTop: 8, gap: 4 },
  title: { fontSize: 14, fontWeight: "700", color: "#111827", lineHeight: 20 },
  creatorRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  avatar: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#E5E7EB" },
  avatarFallback: { width: 20, height: 20, borderRadius: 10, backgroundColor: PINK, justifyContent: "center", alignItems: "center" },
  avatarInitials: { fontSize: 8, fontWeight: "700", color: "#FFF" },
  creatorName: { fontSize: 12, color: "#6B7280", fontWeight: "500" },
});

export default function ExperiencePlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [experience, setExperience] = useState<Experience | null>(null);
  const [suggested, setSuggested] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [bookmarksCount, setBookmarksCount] = useState(0);
  const [descExpanded, setDescExpanded] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
  }, []);

  useEffect(() => {
    if (!id) return;
    console.log("ExperiencePlayer: loading experience:", id);
    setLoading(true);
    Promise.all([
      apiGet<Experience>(`/api/experiences/${id}`),
      apiGet<{ experiences: Experience[]; next_cursor: string | null }>("/api/experiences?limit=20"),
    ])
      .then(([exp, feed]) => {
        setExperience(exp);
        setIsLiked(exp.is_liked);
        setIsBookmarked(exp.is_bookmarked);
        setLikesCount(Number(exp.likes_count) || 0);
        setBookmarksCount(Number(exp.bookmarks_count) || 0);
        const others = (feed?.experiences || []).filter((e) => e.id !== id).slice(0, 5);
        setSuggested(others);
        setError(null);
      })
      .catch((e) => {
        console.error("ExperiencePlayer: load error:", e);
        setError("Couldn't load this experience.");
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleLike = useCallback(async () => {
    console.log("User tapped like on experience:", id);
    if (!currentUserId || !id) return;
    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLikesCount((c) => wasLiked ? Math.max(0, c - 1) : c + 1);
    try {
      const res = await authenticatedPost<{ liked: boolean; likes_count: number }>(`/api/experiences/${id}/like`, {});
      setIsLiked(res.liked);
      setLikesCount(Number(res.likes_count) || 0);
    } catch (e) {
      console.error("ExperiencePlayer: like error:", e);
      setIsLiked(wasLiked);
      setLikesCount((c) => wasLiked ? c + 1 : Math.max(0, c - 1));
    }
  }, [id, currentUserId, isLiked]);

  const handleBookmark = useCallback(async () => {
    console.log("User tapped bookmark on experience:", id);
    if (!currentUserId || !id) return;
    const wasBookmarked = isBookmarked;
    setIsBookmarked(!wasBookmarked);
    setBookmarksCount((c) => wasBookmarked ? Math.max(0, c - 1) : c + 1);
    try {
      const res = await authenticatedPost<{ bookmarked: boolean; bookmarks_count: number }>(`/api/experiences/${id}/bookmark`, {});
      setIsBookmarked(res.bookmarked);
      setBookmarksCount(Number(res.bookmarks_count) || 0);
    } catch (e) {
      console.error("ExperiencePlayer: bookmark error:", e);
      setIsBookmarked(wasBookmarked);
      setBookmarksCount((c) => wasBookmarked ? c + 1 : Math.max(0, c - 1));
    }
  }, [id, currentUserId, isBookmarked]);

  const handleShare = useCallback(async () => {
    console.log("User tapped share on experience:", id);
    try {
      await Share.share({ message: experience?.title || "Check out this experience on Floomingo!" });
    } catch (e) {
      console.error("ExperiencePlayer: share error:", e);
    }
  }, [id, experience]);

  const handleProfilePress = useCallback(() => {
    if (!experience?.user_id) return;
    console.log("User tapped creator profile on experience:", experience.user_id);
    router.push(`/user/${experience.user_id}` as any);
  }, [experience, router]);

  const handlePlacePress = useCallback((place: Place) => {
    console.log("User tapped place pill on experience:", place.place_name);
    router.push(`/location/${place.place_id}` as any);
  }, [router]);

  const handleSuggestedPress = useCallback((exp: Experience) => {
    console.log("User tapped suggested experience:", exp.id, exp.title);
    router.push(`/experience/${exp.id}` as any);
  }, [router]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <Stack.Screen options={{ title: "Experience", headerBackTitle: "" }} />
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={PINK} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !experience) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <Stack.Screen options={{ title: "Experience", headerBackTitle: "" }} />
        <View style={styles.errorState}>
          <Play size={48} color="#D1D5DB" strokeWidth={1.5} />
          <Text style={styles.errorTitle}>Couldn't load experience</Text>
          <Text style={styles.errorSubtitle}>{error || "Something went wrong"}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const username = experience.user?.username || "unknown";
  const avatarUrl = experience.user?.avatar_url || "";
  const initials = getInitials(username);
  const title = experience.title || "Untitled Experience";
  const description = experience.description || "";
  const descLong = description.length > 150;
  const descDisplay = descLong && !descExpanded ? description.substring(0, 150) + "…" : description;
  const likesText = String(likesCount);
  const bookmarksText = String(bookmarksCount);
  const likeColor = isLiked ? PINK : "#374151";
  const bookmarkColor = isBookmarked ? PINK : "#374151";

  return (
    <>
      <Stack.Screen options={{ title: "", headerBackTitle: "", headerTintColor: "#111827" }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Video */}
        <ExperienceVideoPlayer videoUrl={experience.video_url} experienceId={experience.id} />

        <View style={styles.body}>
          {/* Creator row */}
          <View style={styles.creatorRow}>
            <TouchableOpacity style={styles.creatorLeft} onPress={handleProfilePress} activeOpacity={0.8}>
              {avatarUrl ? (
                <Image source={resolveImageSource(avatarUrl)} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarInitials}>{initials}</Text>
                </View>
              )}
              <Text style={styles.creatorName}>@{username}</Text>
            </TouchableOpacity>
          </View>

          {/* Action row */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={handleLike} activeOpacity={0.8}>
              <Heart size={22} color={likeColor} fill={isLiked ? PINK : "transparent"} strokeWidth={2} />
              <Text style={[styles.actionCount, isLiked && { color: PINK }]}>{likesText}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={handleBookmark} activeOpacity={0.8}>
              <Bookmark size={22} color={bookmarkColor} fill={isBookmarked ? PINK : "transparent"} strokeWidth={2} />
              <Text style={[styles.actionCount, isBookmarked && { color: PINK }]}>{bookmarksText}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={handleShare} activeOpacity={0.8}>
              <Share2 size={22} color="#374151" strokeWidth={2} />
              <Text style={styles.actionCount}>Share</Text>
            </TouchableOpacity>
          </View>

          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {/* Description */}
          {description ? (
            <View style={styles.descSection}>
              <Text style={styles.description}>{descDisplay}</Text>
              {descLong ? (
                <TouchableOpacity
                  style={styles.expandBtn}
                  onPress={() => {
                    console.log("User tapped expand/collapse description");
                    setDescExpanded((v) => !v);
                  }}
                  activeOpacity={0.7}
                >
                  {descExpanded ? (
                    <ChevronUp size={16} color={PINK} strokeWidth={2} />
                  ) : (
                    <ChevronDown size={16} color={PINK} strokeWidth={2} />
                  )}
                  <Text style={styles.expandBtnText}>{descExpanded ? "Show less" : "Show more"}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          {/* Places */}
          {experience.places && experience.places.length > 0 ? (
            <View style={styles.placesSection}>
              <View style={styles.placesList}>
                {experience.places.map((place) => (
                  <TouchableOpacity
                    key={place.id}
                    style={styles.placePill}
                    onPress={() => handlePlacePress(place)}
                    activeOpacity={0.8}
                  >
                    <MapPin size={13} color={PINK} strokeWidth={2} />
                    <Text style={styles.placePillText}>{place.place_name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}

          {/* Divider */}
          <View style={styles.divider} />

          {/* Suggested */}
          {suggested.length > 0 ? (
            <View style={styles.suggestedSection}>
              <Text style={styles.suggestedTitle}>More experiences</Text>
              {suggested.map((exp) => (
                <SuggestedCard key={exp.id} experience={exp} onPress={() => handleSuggestedPress(exp)} />
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF" },
  scrollContent: { paddingBottom: 100 },
  loadingState: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorState: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32, paddingTop: 80 },
  errorTitle: { fontSize: 18, fontWeight: "700", color: "#374151", marginTop: 16 },
  errorSubtitle: { fontSize: 14, color: "#9CA3AF", marginTop: 8, textAlign: "center" },
  body: { paddingHorizontal: 16, paddingTop: 16 },
  creatorRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  creatorLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#E5E7EB" },
  avatarFallback: { width: 40, height: 40, borderRadius: 20, backgroundColor: PINK, justifyContent: "center", alignItems: "center" },
  avatarInitials: { fontSize: 14, fontWeight: "700", color: "#FFF" },
  creatorName: { fontSize: 15, fontWeight: "600", color: "#111827" },
  actionRow: { flexDirection: "row", gap: 20, marginBottom: 16 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  actionCount: { fontSize: 14, fontWeight: "600", color: "#374151" },
  title: { fontSize: 20, fontWeight: "800", color: "#111827", letterSpacing: -0.3, lineHeight: 28, marginBottom: 12 },
  descSection: { marginBottom: 16 },
  description: { fontSize: 15, color: "#4B5563", lineHeight: 22 },
  expandBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  expandBtnText: { fontSize: 14, color: PINK, fontWeight: "600" },
  placesSection: { marginBottom: 16 },
  placesList: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  placePill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,59,122,0.08)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: "rgba(255,59,122,0.2)" },
  placePillText: { fontSize: 13, color: PINK, fontWeight: "600" },
  divider: { height: 1, backgroundColor: "#F3F4F6", marginVertical: 16 },
  suggestedSection: {},
  suggestedTitle: { fontSize: 17, fontWeight: "700", color: "#111827", marginBottom: 16, letterSpacing: -0.2 },
});
