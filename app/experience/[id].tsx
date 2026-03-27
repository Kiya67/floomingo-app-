
import React, { useState, useCallback, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  Image,
  ImageSourcePropType,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Share,
  useColorScheme,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─── Constants ────────────────────────────────────────────────────────────────
const PINK = "#FF6B9D";
const ORANGE = "#FF8C42";
const API_BASE = "https://7efxms2e3tmdd7a38j8uphfzrnwwcgesc.app.specular.dev";

const { width } = Dimensions.get("window");
const VIDEO_HEIGHT = 250;
const CARD_WIDTH = width - 32;
const RELATED_THUMB_HEIGHT = CARD_WIDTH * (9 / 16);

// ─── Demo Data ────────────────────────────────────────────────────────────────
const DEMO_EXPERIENCES = [
  { id: "1", title: "Sunset in Santorini", description: "Golden hour views over the caldera", location: "Santorini, Greece", location_id: null, location_name: null, duration: 3600, view_count: 12400, thumbnail_url: "https://picsum.photos/seed/santorini/400/300", creator: "Sofia M.", avatar: "https://i.pravatar.cc/40?img=1", created_at: "2024-01-15T10:00:00Z" },
  { id: "2", title: "Tokyo Street Food Tour", description: "Exploring the best ramen and sushi spots", location: "Tokyo, Japan", location_id: null, location_name: null, duration: 5400, view_count: 8900, thumbnail_url: "https://picsum.photos/seed/tokyo/400/300", creator: "Kenji T.", avatar: "https://i.pravatar.cc/40?img=2", created_at: "2024-01-14T10:00:00Z" },
  { id: "3", title: "Hiking the Dolomites", description: "Epic mountain trails and alpine lakes", location: "Dolomites, Italy", location_id: null, location_name: null, duration: 7200, view_count: 21000, thumbnail_url: "https://picsum.photos/seed/dolomites/400/300", creator: "Marco R.", avatar: "https://i.pravatar.cc/40?img=3", created_at: "2024-01-13T10:00:00Z" },
  { id: "4", title: "Bali Rice Terraces", description: "Peaceful walks through Tegallalang", location: "Ubud, Bali", location_id: null, location_name: null, duration: 2700, view_count: 15600, thumbnail_url: "https://picsum.photos/seed/bali/400/300", creator: "Ayu W.", avatar: "https://i.pravatar.cc/40?img=4", created_at: "2024-01-12T10:00:00Z" },
  { id: "5", title: "Northern Lights in Iceland", description: "Chasing the aurora borealis", location: "Reykjavik, Iceland", location_id: null, location_name: null, duration: 4800, view_count: 33000, thumbnail_url: "https://picsum.photos/seed/iceland/400/300", creator: "Bjorn H.", avatar: "https://i.pravatar.cc/40?img=5", created_at: "2024-01-11T10:00:00Z" },
  { id: "6", title: "Safari in Serengeti", description: "Wildlife encounters on the great plains", location: "Serengeti, Tanzania", location_id: null, location_name: null, duration: 6600, view_count: 19200, thumbnail_url: "https://picsum.photos/seed/serengeti/400/300", creator: "Amara N.", avatar: "https://i.pravatar.cc/40?img=6", created_at: "2024-01-10T10:00:00Z" },
];

interface DemoExperience {
  id: string;
  title: string;
  description: string;
  location: string;
  location_id: string | null;
  location_name: string | null;
  duration: number;
  view_count: number;
  thumbnail_url: string;
  creator: string;
  avatar: string;
  created_at: string;
}

interface ApiExperience {
  id: string;
  title?: string;
  description?: string;
  location_id?: string | null;
  location_name?: string | null;
  duration?: number;
  view_count?: number;
  thumbnail_url?: string;
  creator?: string;
  avatar?: string;
  created_at?: string;
  profiles?: {
    display_name?: string;
    avatar_url?: string | null;
  };
}

function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: "" };
  if (typeof source === "string") return { uri: source };
  return source as ImageSourcePropType;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
}

function formatViews(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return String(count);
}

// ─── Style factory ────────────────────────────────────────────────────────────
interface ColorTokens {
  BG: string;
  SURFACE: string;
  TEXT: string;
  TEXT_SECONDARY: string;
  TEXT_TERTIARY: string;
  BORDER: string;
  INPUT_BG: string;
  PINK: string;
  ORANGE: string;
  cardBg: string;
  progressTrackBg: string;
  dividerBg: string;
}

function getStyles(c: ColorTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.BG,
    },
    // ── Video ──
    videoContainer: {
      width,
      height: VIDEO_HEIGHT,
      backgroundColor: "#111",
      position: "relative",
      overflow: "hidden",
    },
    videoThumb: {
      width: "100%",
      height: "100%",
    },
    videoOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.35)",
    },
    playButtonCircle: {
      position: "absolute",
      top: "50%",
      left: "50%",
      marginTop: -28,
      marginLeft: -28,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: "rgba(255,255,255,0.2)",
      borderWidth: 2,
      borderColor: "rgba(255,255,255,0.6)",
      justifyContent: "center",
      alignItems: "center",
    },
    videoMeta: {
      position: "absolute",
      bottom: 12,
      right: 12,
      flexDirection: "row",
      gap: 8,
    },
    videoBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: "rgba(0,0,0,0.55)",
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    videoBadgeText: {
      fontSize: 11,
      fontWeight: "700",
      color: "#FFF",
    },
    // ── Progress bar ──
    progressTrack: {
      height: 3,
      backgroundColor: c.progressTrackBg,
      width: "100%",
    },
    progressFill: {
      height: "100%",
    },
    // ── Body ──
    body: {
      paddingHorizontal: 16,
      paddingTop: 16,
    },
    // ── Creator row ──
    creatorRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    creatorLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      flex: 1,
    },
    creatorTappable: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.INPUT_BG,
    },
    creatorName: {
      fontSize: 15,
      fontWeight: "700",
      color: c.TEXT,
    },
    followBtn: {
      paddingHorizontal: 16,
      paddingVertical: 7,
      borderRadius: 20,
    },
    followBtnText: {
      fontSize: 13,
      fontWeight: "700",
      color: "#FFF",
    },
    followingBtn: {
      paddingHorizontal: 16,
      paddingVertical: 7,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: c.BORDER,
      backgroundColor: c.INPUT_BG,
    },
    followingBtnText: {
      fontSize: 13,
      fontWeight: "700",
      color: c.TEXT_SECONDARY,
    },
    // ── Action buttons row (below creator) ──
    actionRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-start",
      gap: 4,
      marginBottom: 14,
      marginTop: 4,
    },
    iconBtn: {
      padding: 8,
      alignItems: "center",
      gap: 2,
    },
    actionBtnLabel: {
      fontSize: 11,
      color: c.TEXT_SECONDARY,
      fontWeight: "600",
    },
    // ── Title & description ──
    title: {
      fontSize: 18,
      fontWeight: "800",
      color: c.TEXT,
      letterSpacing: -0.3,
      lineHeight: 26,
      marginBottom: 8,
    },
    description: {
      fontSize: 14,
      color: c.TEXT_SECONDARY,
      lineHeight: 21,
      marginBottom: 10,
    },
    // ── Location tag ──
    locationTag: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      alignSelf: "flex-start",
      backgroundColor: "rgba(255,107,157,0.1)",
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 5,
      marginBottom: 4,
    },
    locationText: {
      fontSize: 13,
      color: c.PINK,
      fontWeight: "600",
    },
    // ── Divider ──
    divider: {
      height: 1,
      backgroundColor: c.dividerBg,
      marginVertical: 20,
    },
    // ── Related ──
    sectionTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: c.TEXT,
      letterSpacing: -0.2,
      marginBottom: 14,
    },
    relatedList: {
      gap: 14,
    },
    relatedLoadingContainer: {
      paddingVertical: 32,
      alignItems: "center",
    },
    relatedEmptyText: {
      fontSize: 14,
      color: c.TEXT_TERTIARY,
      textAlign: "center",
      paddingVertical: 24,
    },
    // ── Related card ──
    relatedCard: {
      backgroundColor: c.cardBg,
      borderRadius: 16,
      overflow: "hidden",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    relatedThumbContainer: {
      width: "100%",
      height: RELATED_THUMB_HEIGHT,
      backgroundColor: c.INPUT_BG,
      overflow: "hidden",
    },
    relatedThumb: {
      width: "100%",
      height: "100%",
    },
    relatedThumbGradient: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      height: 50,
    },
    durationBadge: {
      position: "absolute",
      bottom: 10,
      right: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: "rgba(0,0,0,0.6)",
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    badgeText: {
      fontSize: 11,
      fontWeight: "700",
      color: "#FFF",
    },
    relatedInfo: {
      flexDirection: "row",
      alignItems: "flex-start",
      padding: 12,
      gap: 10,
    },
    relatedCreatorTappable: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      flex: 1,
    },
    relatedAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.INPUT_BG,
      marginTop: 2,
    },
    relatedTextBlock: {
      flex: 1,
      gap: 2,
    },
    relatedCreator: {
      fontSize: 11,
      fontWeight: "700",
      color: c.TEXT_SECONDARY,
    },
    relatedTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: c.TEXT,
      lineHeight: 20,
    },
    relatedLocationRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginTop: 2,
    },
    relatedLocation: {
      fontSize: 11,
      color: c.PINK,
      flex: 1,
    },
  });
}

// ─── Related Card ─────────────────────────────────────────────────────────────
function RelatedCard({
  item,
  onPress,
  cardBg,
  styles,
  router,
}: {
  item: ApiExperience;
  onPress: () => void;
  cardBg: string;
  styles: ReturnType<typeof getStyles>;
  router: ReturnType<typeof useRouter>;
}) {
  const thumbUrl = item.thumbnail_url || (item.profiles?.avatar_url ?? "");
  const avatarUrl = item.profiles?.avatar_url ?? item.avatar ?? "";
  const creatorName = item.profiles?.display_name ?? item.creator ?? "";
  const titleText = item.title ?? "";
  const locationNameText = item.location_name ?? "";
  const durationSecs = Number(item.duration ?? 0);
  const durationText = durationSecs > 0 ? formatDuration(durationSecs) : "";

  const thumbSource = resolveImageSource(thumbUrl);
  const avatarSource = resolveImageSource(avatarUrl);

  const handleLocationPress = useCallback(() => {
    if (item.location_id && item.location_name) {
      console.log("User tapped location on related card:", item.location_name, item.location_id);
      router.push((`/location/${item.location_id}?location_name=${encodeURIComponent(item.location_name)}`) as any);
    }
  }, [item.location_id, item.location_name, router]);

  const handleCreatorPress = useCallback(() => {
    console.log("User tapped creator on related card:", creatorName);
    router.push(("/user/" + item.id) as any);
  }, [item.id, creatorName, router]);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
      <View style={[styles.relatedCard, { backgroundColor: cardBg }]}>
        <View style={styles.relatedThumbContainer}>
          <Image source={thumbSource} style={styles.relatedThumb} resizeMode="cover" />
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.4)"]}
            style={styles.relatedThumbGradient}
          />
          {durationText ? (
            <View style={styles.durationBadge}>
              <Feather name="clock" size={10} color="#FFF" />
              <Text style={styles.badgeText}>{durationText}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.relatedInfo}>
          <TouchableOpacity
            onPress={handleCreatorPress}
            activeOpacity={0.7}
            style={styles.relatedCreatorTappable}
          >
            <Image source={avatarSource} style={styles.relatedAvatar} />
            <View style={styles.relatedTextBlock}>
              <Text style={styles.relatedCreator}>{creatorName}</Text>
              <Text style={styles.relatedTitle} numberOfLines={2}>{titleText}</Text>
              {locationNameText ? (
                <TouchableOpacity
                  onPress={handleLocationPress}
                  activeOpacity={0.7}
                  style={styles.relatedLocationRow}
                >
                  <Feather name="map-pin" size={11} color={PINK} />
                  <Text style={styles.relatedLocation} numberOfLines={1}>{locationNameText}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ExperienceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  // ── Color tokens ──
  const BG = isDark ? "#0F0F0F" : "#FFFFFF";
  const SURFACE = isDark ? "#0F0F0F" : "#FFFFFF";
  const cardBg = isDark ? "#1A1A1A" : "#FFFFFF";
  const TEXT = isDark ? "#F0F0F0" : "#1A1A1A";
  const TEXT_SECONDARY = isDark ? "#A0A0A0" : "#6B6B6B";
  const TEXT_TERTIARY = isDark ? "#666666" : "#A0A0A0";
  const BORDER = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)";
  const INPUT_BG = isDark ? "#2A2A2A" : "#F0F0F0";
  const progressTrackBg = isDark ? "#2A2A2A" : "#E5E7EB";
  const dividerBg = isDark ? "#2A2A2A" : "#F0F0F0";

  const styles = getStyles({ BG, SURFACE, TEXT, TEXT_SECONDARY, TEXT_TERTIARY, BORDER, INPUT_BG, PINK, ORANGE, cardBg, progressTrackBg, dividerBg });

  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [progress] = useState(0.35);

  const [relatedExperiences, setRelatedExperiences] = useState<ApiExperience[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);

  const experience = DEMO_EXPERIENCES.find((e) => e.id === id) || DEMO_EXPERIENCES[0];

  const thumbSource = resolveImageSource(experience.thumbnail_url);
  const avatarSource = resolveImageSource(experience.avatar);
  const viewsText = formatViews(experience.view_count);
  const durationText = formatDuration(experience.duration);
  const likeCountText = formatViews(experience.view_count);

  const likeColor = isLiked ? PINK : TEXT_TERTIARY;
  const bookmarkColor = isBookmarked ? PINK : TEXT_TERTIARY;
  const progressWidth = `${progress * 100}%` as any;

  // Derived section title
  const locationId = experience.location_id;
  const locationName = experience.location_name || experience.location;
  const sectionTitleText = locationId ? `More from ${locationName}` : "More Experiences";

  // ── Fetch related experiences from same location ──
  useEffect(() => {
    const fetchRelated = async () => {
      setRelatedLoading(true);

      if (locationId) {
        console.log("Fetching related experiences for location:", locationId, "excluding:", id);
        try {
          const url = `${API_BASE}/api/experiences/location/${locationId}?limit=20&excludeId=${id}`;
          console.log("Network request: GET", url);
          const response = await fetch(url);
          if (!response.ok) {
            const errText = await response.text();
            console.error("Related experiences API error:", response.status, errText);
            fallbackToDemo();
          } else {
            const data = await response.json();
            console.log("Related experiences fetched:", Array.isArray(data) ? data.length : 0, "items");
            const list: ApiExperience[] = Array.isArray(data) ? data : (data?.experiences ?? data?.data ?? []);
            setRelatedExperiences(list);
          }
        } catch (err) {
          console.error("Error fetching related experiences:", err);
          fallbackToDemo();
        }
      } else {
        console.log("No location_id on experience, falling back to demo related");
        fallbackToDemo();
      }

      setRelatedLoading(false);
    };

    const fallbackToDemo = () => {
      const fallback = DEMO_EXPERIENCES.filter((e) => e.id !== experience.id).slice(0, 4);
      setRelatedExperiences(fallback as any);
    };

    fetchRelated();
  }, [id, locationId]);

  const handleLike = useCallback(() => {
    console.log("User tapped like on experience detail:", experience.id);
    setIsLiked((v) => !v);
  }, [experience.id]);

  const handleBookmark = useCallback(() => {
    console.log("User tapped bookmark on experience detail:", experience.id);
    setIsBookmarked((v) => !v);
  }, [experience.id]);

  const handleFollow = useCallback(() => {
    console.log("User tapped Follow button for creator:", experience.creator);
    setIsFollowing((v) => !v);
  }, [experience.creator]);

  const handleShare = useCallback(async () => {
    console.log("User tapped share on experience detail:", experience.id);
    try {
      await Share.share({ message: `${experience.title} — Check it out on Floomingo!` });
    } catch (e) {
      console.error("Share error:", e);
    }
  }, [experience]);

  const handleComment = useCallback(() => {
    console.log("User tapped comment on experience detail:", experience.id);
  }, [experience.id]);

  const handleMore = useCallback(() => {
    console.log("User tapped more (...) on experience detail:", experience.id);
  }, [experience.id]);

  const handleRelatedPress = useCallback((item: ApiExperience) => {
    console.log("User tapped related experience:", item.id, item.title);
    router.push(`/experience/${item.id}` as any);
  }, [router]);

  const handleLocationPress = useCallback(() => {
    if (locationId) {
      console.log("User tapped location tag on experience detail:", locationName, locationId);
      router.push((`/location/${locationId}?location_name=${encodeURIComponent(locationName)}`) as any);
    } else {
      console.log("User tapped location (no location_id):", experience.location);
      router.push(("/search-location?q=" + encodeURIComponent(experience.location)) as any);
    }
  }, [locationId, locationName, experience.location, router]);

  const handleCreatorPress = useCallback(() => {
    console.log("User tapped creator profile on experience detail:", experience.creator);
    router.push(("/user/" + experience.id) as any);
  }, [experience.id, experience.creator, router]);

  return (
    <>
      <Stack.Screen
        options={{
          title: "",
          headerBackTitle: "",
          headerTintColor: TEXT,
          headerStyle: { backgroundColor: BG },
          headerShadowVisible: false,
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Video placeholder */}
        <View style={styles.videoContainer}>
          <Image source={thumbSource} style={styles.videoThumb} resizeMode="cover" />
          <View style={styles.videoOverlay} />
          <View style={styles.playButtonCircle}>
            <Feather name="play" size={32} color="#FFF" />
          </View>
          <View style={styles.videoMeta}>
            <View style={styles.videoBadge}>
              <Feather name="eye" size={11} color="#FFF" />
              <Text style={styles.videoBadgeText}>{viewsText}</Text>
            </View>
            <View style={styles.videoBadge}>
              <Feather name="clock" size={11} color="#FFF" />
              <Text style={styles.videoBadgeText}>{durationText}</Text>
            </View>
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <LinearGradient
            colors={[PINK, ORANGE]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.progressFill, { width: progressWidth }]}
          />
        </View>

        <View style={styles.body}>
          {/* Creator row — avatar + name + follow */}
          <View style={styles.creatorRow}>
            <View style={styles.creatorLeft}>
              <TouchableOpacity
                onPress={handleCreatorPress}
                activeOpacity={0.7}
                style={styles.creatorTappable}
              >
                <Image source={avatarSource} style={styles.avatar} />
                <Text style={styles.creatorName}>{experience.creator}</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleFollow} activeOpacity={0.85}>
                {isFollowing ? (
                  <View style={styles.followingBtn}>
                    <Text style={styles.followingBtnText}>Following</Text>
                  </View>
                ) : (
                  <LinearGradient
                    colors={[PINK, ORANGE]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.followBtn}
                  >
                    <Text style={styles.followBtnText}>Follow</Text>
                  </LinearGradient>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Action buttons row — below creator, no overlap */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.iconBtn} onPress={handleLike} activeOpacity={0.7}>
              <Feather name="heart" size={20} color={likeColor} />
              <Text style={styles.actionBtnLabel}>{likeCountText}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={handleComment} activeOpacity={0.7}>
              <Feather name="message-circle" size={20} color={TEXT_TERTIARY} />
              <Text style={styles.actionBtnLabel}>Comment</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={handleBookmark} activeOpacity={0.7}>
              <Feather name="bookmark" size={20} color={bookmarkColor} />
              <Text style={styles.actionBtnLabel}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={handleShare} activeOpacity={0.7}>
              <Feather name="send" size={20} color={TEXT_TERTIARY} />
              <Text style={styles.actionBtnLabel}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={handleMore} activeOpacity={0.7}>
              <Feather name="more-horizontal" size={20} color={TEXT_TERTIARY} />
              <Text style={styles.actionBtnLabel}>More</Text>
            </TouchableOpacity>
          </View>

          {/* Title */}
          <Text style={styles.title}>{experience.title}</Text>

          {/* Description */}
          {experience.description ? (
            <Text style={styles.description}>{experience.description}</Text>
          ) : null}

          {/* Location tag — tappable, navigates to location detail */}
          <TouchableOpacity
            onPress={handleLocationPress}
            activeOpacity={0.7}
            style={styles.locationTag}
          >
            <Feather name="map-pin" size={13} color={PINK} />
            <Text style={styles.locationText}>{locationName}</Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Related experiences */}
          <Text style={styles.sectionTitle}>{sectionTitleText}</Text>

          {relatedLoading ? (
            <View style={styles.relatedLoadingContainer}>
              <ActivityIndicator size="small" color={PINK} />
            </View>
          ) : relatedExperiences.length === 0 ? (
            <Text style={styles.relatedEmptyText}>No other experiences from this location yet.</Text>
          ) : (
            <View style={styles.relatedList}>
              {relatedExperiences.map((item) => (
                <RelatedCard
                  key={item.id}
                  item={item}
                  onPress={() => handleRelatedPress(item)}
                  cardBg={cardBg}
                  styles={styles}
                  router={router}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </>
  );
}
