
import React, { useState, useCallback } from "react";
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
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─── Colors ──────────────────────────────────────────────────────────────────
const PINK = "#FF6B9D";
const ORANGE = "#FF8C42";
const TEXT = "#1A1A1A";
const TEXT_SECONDARY = "#6B6B6B";
const TEXT_TERTIARY = "#A0A0A0";
const BORDER = "rgba(0,0,0,0.07)";
const INPUT_BG = "#F0F0F0";
const SURFACE = "#FFFFFF";

const { width } = Dimensions.get("window");
const VIDEO_HEIGHT = 250;
const CARD_WIDTH = width - 32;
const RELATED_THUMB_HEIGHT = CARD_WIDTH * (9 / 16);

// ─── Demo Data ────────────────────────────────────────────────────────────────
const DEMO_EXPERIENCES = [
  { id: "1", title: "Sunset in Santorini", description: "Golden hour views over the caldera", location: "Santorini, Greece", duration: 3600, view_count: 12400, thumbnail_url: "https://picsum.photos/seed/santorini/400/300", creator: "Sofia M.", avatar: "https://i.pravatar.cc/40?img=1", created_at: "2024-01-15T10:00:00Z" },
  { id: "2", title: "Tokyo Street Food Tour", description: "Exploring the best ramen and sushi spots", location: "Tokyo, Japan", duration: 5400, view_count: 8900, thumbnail_url: "https://picsum.photos/seed/tokyo/400/300", creator: "Kenji T.", avatar: "https://i.pravatar.cc/40?img=2", created_at: "2024-01-14T10:00:00Z" },
  { id: "3", title: "Hiking the Dolomites", description: "Epic mountain trails and alpine lakes", location: "Dolomites, Italy", duration: 7200, view_count: 21000, thumbnail_url: "https://picsum.photos/seed/dolomites/400/300", creator: "Marco R.", avatar: "https://i.pravatar.cc/40?img=3", created_at: "2024-01-13T10:00:00Z" },
  { id: "4", title: "Bali Rice Terraces", description: "Peaceful walks through Tegallalang", location: "Ubud, Bali", duration: 2700, view_count: 15600, thumbnail_url: "https://picsum.photos/seed/bali/400/300", creator: "Ayu W.", avatar: "https://i.pravatar.cc/40?img=4", created_at: "2024-01-12T10:00:00Z" },
  { id: "5", title: "Northern Lights in Iceland", description: "Chasing the aurora borealis", location: "Reykjavik, Iceland", duration: 4800, view_count: 33000, thumbnail_url: "https://picsum.photos/seed/iceland/400/300", creator: "Bjorn H.", avatar: "https://i.pravatar.cc/40?img=5", created_at: "2024-01-11T10:00:00Z" },
  { id: "6", title: "Safari in Serengeti", description: "Wildlife encounters on the great plains", location: "Serengeti, Tanzania", duration: 6600, view_count: 19200, thumbnail_url: "https://picsum.photos/seed/serengeti/400/300", creator: "Amara N.", avatar: "https://i.pravatar.cc/40?img=6", created_at: "2024-01-10T10:00:00Z" },
];

interface DemoExperience {
  id: string;
  title: string;
  description: string;
  location: string;
  duration: number;
  view_count: number;
  thumbnail_url: string;
  creator: string;
  avatar: string;
  created_at: string;
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

// ─── Gradient Border Card ─────────────────────────────────────────────────────
function GradientBorderCard({ children }: { children: React.ReactNode }) {
  return (
    <LinearGradient
      colors={[PINK, ORANGE]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientBorder}
    >
      <View style={styles.cardInner}>
        {children}
      </View>
    </LinearGradient>
  );
}

// ─── Related Card ─────────────────────────────────────────────────────────────
function RelatedCard({ item, onPress }: { item: DemoExperience; onPress: () => void }) {
  const thumbSource = resolveImageSource(item.thumbnail_url);
  const avatarSource = resolveImageSource(item.avatar);
  const durationText = formatDuration(item.duration);
  const viewsText = formatViews(item.view_count);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
      <GradientBorderCard>
        <View style={styles.relatedThumbContainer}>
          <Image source={thumbSource} style={styles.relatedThumb} resizeMode="cover" />
          <View style={styles.durationBadge}>
            <Feather name="clock" size={10} color="#FFF" />
            <Text style={styles.badgeText}>{durationText}</Text>
          </View>
          <View style={styles.viewsBadge}>
            <Feather name="eye" size={10} color="#FFF" />
            <Text style={styles.badgeText}>{viewsText}</Text>
          </View>
        </View>
        <View style={styles.relatedInfo}>
          <Image source={avatarSource} style={styles.relatedAvatar} />
          <View style={styles.relatedTextBlock}>
            <Text style={styles.relatedCreator}>{item.creator}</Text>
            <Text style={styles.relatedCardTitle} numberOfLines={2}>{item.title}</Text>
            <View style={styles.relatedLocationRow}>
              <Feather name="map-pin" size={11} color={PINK} />
              <Text style={styles.relatedLocation} numberOfLines={1}>{item.location}</Text>
            </View>
          </View>
        </View>
      </GradientBorderCard>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ExperienceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const progress = 0.35;

  const experience = DEMO_EXPERIENCES.find((e) => e.id === id) || DEMO_EXPERIENCES[0];
  const related = DEMO_EXPERIENCES.filter((e) => e.id !== experience.id).slice(0, 4);

  const thumbSource = resolveImageSource(experience.thumbnail_url);
  const avatarSource = resolveImageSource(experience.avatar);
  const viewsText = formatViews(experience.view_count);
  const durationText = formatDuration(experience.duration);
  const progressWidth = `${progress * 100}%` as `${number}%`;

  const likeColor = isLiked ? PINK : TEXT_TERTIARY;
  const bookmarkColor = isBookmarked ? PINK : TEXT_TERTIARY;

  const handleLike = useCallback(() => {
    console.log("User tapped like on experience detail (iOS):", experience.id);
    setIsLiked((v) => !v);
  }, [experience.id]);

  const handleBookmark = useCallback(() => {
    console.log("User tapped bookmark on experience detail (iOS):", experience.id);
    setIsBookmarked((v) => !v);
  }, [experience.id]);

  const handleFollow = useCallback(() => {
    console.log("User tapped Follow button for creator (iOS):", experience.creator);
    setIsFollowing((v) => !v);
  }, [experience.creator]);

  const handleShare = useCallback(async () => {
    console.log("User tapped share on experience detail (iOS):", experience.id);
    try {
      await Share.share({ message: `${experience.title} — Check it out on Floomingo!` });
    } catch (e) {
      console.error("Share error (iOS):", e);
    }
  }, [experience]);

  const handleComment = useCallback(() => {
    console.log("User tapped comment on experience detail (iOS):", experience.id);
  }, [experience.id]);

  const handleMore = useCallback(() => {
    console.log("User tapped more (...) on experience detail (iOS):", experience.id);
  }, [experience.id]);

  const handleRelatedPress = useCallback((item: DemoExperience) => {
    console.log("User tapped related experience (iOS):", item.id, item.title);
    router.push(`/experience/${item.id}` as any);
  }, [router]);

  return (
    <>
      <Stack.Screen
        options={{
          title: "",
          headerBackTitle: "",
          headerTintColor: TEXT,
          headerStyle: { backgroundColor: SURFACE },
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
          {/* Creator row */}
          <View style={styles.creatorRow}>
            <View style={styles.creatorLeft}>
              <Image source={avatarSource} style={styles.avatar} />
              <Text style={styles.creatorName}>{experience.creator}</Text>
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

            <View style={styles.creatorActions}>
              <TouchableOpacity style={styles.iconBtn} onPress={handleLike} activeOpacity={0.7}>
                <Feather name="heart" size={20} color={likeColor} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={handleComment} activeOpacity={0.7}>
                <Feather name="message-circle" size={20} color={TEXT_TERTIARY} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={handleBookmark} activeOpacity={0.7}>
                <Feather name="bookmark" size={20} color={bookmarkColor} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={handleShare} activeOpacity={0.7}>
                <Feather name="send" size={20} color={TEXT_TERTIARY} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={handleMore} activeOpacity={0.7}>
                <Feather name="more-horizontal" size={20} color={TEXT_TERTIARY} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Title */}
          <Text style={styles.title}>{experience.title}</Text>

          {/* Description */}
          {experience.description ? (
            <Text style={styles.description}>{experience.description}</Text>
          ) : null}

          {/* Location */}
          <View style={styles.locationRow}>
            <Feather name="map-pin" size={13} color={PINK} />
            <Text style={styles.locationText}>{experience.location}</Text>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Related */}
          <Text style={styles.sectionTitle}>More experiences</Text>
          <View style={styles.relatedList}>
            {related.map((item) => (
              <RelatedCard
                key={item.id}
                item={item}
                onPress={() => handleRelatedPress(item)}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SURFACE,
  },
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
  progressTrack: {
    height: 3,
    backgroundColor: "#E5E7EB",
    width: "100%",
  },
  progressFill: {
    height: "100%",
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  creatorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  creatorLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: INPUT_BG,
  },
  creatorName: {
    fontSize: 16,
    fontWeight: "700",
    color: TEXT,
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
    borderColor: BORDER,
    backgroundColor: INPUT_BG,
  },
  followingBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: TEXT_SECONDARY,
  },
  creatorActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  iconBtn: {
    padding: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: TEXT,
    letterSpacing: -0.3,
    lineHeight: 26,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    lineHeight: 21,
    marginBottom: 10,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 4,
  },
  locationText: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    fontWeight: "500",
  },
  divider: {
    height: 1,
    backgroundColor: "#F0F0F0",
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: TEXT,
    letterSpacing: -0.2,
    marginBottom: 14,
  },
  relatedList: {
    gap: 14,
  },
  gradientBorder: {
    borderRadius: 18,
    padding: 2.5,
    shadowColor: PINK,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  cardInner: {
    backgroundColor: SURFACE,
    borderRadius: 16,
    overflow: "hidden",
  },
  relatedThumbContainer: {
    width: "100%",
    height: RELATED_THUMB_HEIGHT,
    backgroundColor: INPUT_BG,
    overflow: "hidden",
  },
  relatedThumb: {
    width: "100%",
    height: "100%",
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
  viewsBadge: {
    position: "absolute",
    bottom: 10,
    left: 10,
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
  relatedAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: INPUT_BG,
    marginTop: 2,
  },
  relatedTextBlock: {
    flex: 1,
    gap: 2,
  },
  relatedCreator: {
    fontSize: 11,
    fontWeight: "700",
    color: TEXT_SECONDARY,
  },
  relatedCardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: TEXT,
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
    color: TEXT_TERTIARY,
    flex: 1,
  },
});
