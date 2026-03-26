
import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  Image,
  ImageSourcePropType,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  RefreshControl,
  Dimensions,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Film, Play } from "lucide-react-native";
import { apiGet } from "@/utils/api";
import { SafeAreaView } from "react-native-safe-area-context";

const PINK = "#FF3B7A";
const { width } = Dimensions.get("window");
const THUMB_HEIGHT = (width - 32) * (9 / 16);

interface UserSummary {
  id: string;
  username: string;
  avatar_url?: string;
}

interface Experience {
  id: string;
  user_id: string;
  video_url: string;
  thumbnail_url?: string;
  title: string;
  description?: string;
  likes_count: number;
  bookmarks_count: number;
  is_liked: boolean;
  is_bookmarked: boolean;
  places: { id: string; place_id: string; place_name: string }[];
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

function SkeletonCard() {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <View style={skeletonStyles.card}>
      <Animated.View style={[skeletonStyles.thumb, { opacity }]} />
      <View style={skeletonStyles.info}>
        <Animated.View style={[skeletonStyles.titleLine, { opacity }]} />
        <Animated.View style={[skeletonStyles.titleLineShort, { opacity }]} />
        <Animated.View style={[skeletonStyles.avatarRow, { opacity }]}>
          <Animated.View style={skeletonStyles.avatarCircle} />
          <Animated.View style={skeletonStyles.nameLine} />
        </Animated.View>
      </View>
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  card: { marginHorizontal: 16, marginBottom: 20 },
  thumb: { width: "100%", height: THUMB_HEIGHT, borderRadius: 14, backgroundColor: "#E5E7EB" },
  info: { paddingTop: 10, gap: 6 },
  titleLine: { height: 16, borderRadius: 8, backgroundColor: "#E5E7EB", width: "85%" },
  titleLineShort: { height: 16, borderRadius: 8, backgroundColor: "#E5E7EB", width: "60%" },
  avatarRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  avatarCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#E5E7EB" },
  nameLine: { height: 12, borderRadius: 6, backgroundColor: "#E5E7EB", width: 100 },
});

function AnimatedCard({ index, children }: { index: number; children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 350, delay: Math.min(index * 60, 300), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 350, delay: Math.min(index * 60, 300), useNativeDriver: true }),
    ]).start();
  }, []);
  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
}

function ExperienceCard({ experience, onPress, index }: { experience: Experience; onPress: () => void; index: number }) {
  const username = experience.user?.username || "unknown";
  const avatarUrl = experience.user?.avatar_url || "";
  const initials = getInitials(username);
  const title = experience.title || "Untitled Experience";
  const hasThumbnail = !!experience.thumbnail_url;

  return (
    <AnimatedCard index={index}>
      <TouchableOpacity style={cardStyles.card} onPress={onPress} activeOpacity={0.92}>
        <View style={cardStyles.thumbContainer}>
          {hasThumbnail ? (
            <Image source={resolveImageSource(experience.thumbnail_url)} style={cardStyles.thumb} resizeMode="cover" />
          ) : (
            <View style={cardStyles.thumbPlaceholder}>
              <Play size={32} color="rgba(255,255,255,0.5)" strokeWidth={1.5} />
            </View>
          )}
          <View style={cardStyles.playOverlay}>
            <View style={cardStyles.playCircle}>
              <Play size={16} color="#FFF" fill="#FFF" strokeWidth={0} />
            </View>
          </View>
        </View>
        <View style={cardStyles.info}>
          <Text style={cardStyles.title} numberOfLines={2}>{title}</Text>
          <View style={cardStyles.creatorRow}>
            {avatarUrl ? (
              <Image source={resolveImageSource(avatarUrl)} style={cardStyles.avatar} />
            ) : (
              <View style={cardStyles.avatarFallback}>
                <Text style={cardStyles.avatarInitials}>{initials}</Text>
              </View>
            )}
            <Text style={cardStyles.creatorName}>@{username}</Text>
          </View>
        </View>
      </TouchableOpacity>
    </AnimatedCard>
  );
}

const cardStyles = StyleSheet.create({
  card: { marginHorizontal: 16, marginBottom: 20 },
  thumbContainer: { position: "relative", borderRadius: 14, overflow: "hidden" },
  thumb: { width: "100%", height: THUMB_HEIGHT, backgroundColor: "#E5E7EB" },
  thumbPlaceholder: { width: "100%", height: THUMB_HEIGHT, backgroundColor: "#1A1A2E", justifyContent: "center", alignItems: "center" },
  playOverlay: { position: "absolute", bottom: 10, right: 10 },
  playCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" },
  info: { paddingTop: 10, gap: 6 },
  title: { fontSize: 15, fontWeight: "700", color: "#111827", lineHeight: 22, letterSpacing: -0.2 },
  creatorRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  avatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#E5E7EB" },
  avatarFallback: { width: 24, height: 24, borderRadius: 12, backgroundColor: PINK, justifyContent: "center", alignItems: "center" },
  avatarInitials: { fontSize: 9, fontWeight: "700", color: "#FFF" },
  creatorName: { fontSize: 13, color: "#6B7280", fontWeight: "500" },
});

export default function ExperiencesScreen() {
  const router = useRouter();
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchExperiences = useCallback(async (cursor?: string, isRefresh = false) => {
    console.log("Experiences: fetching, cursor:", cursor, "refresh:", isRefresh);
    try {
      const params = new URLSearchParams({ limit: "20" });
      if (cursor) params.set("cursor", cursor);
      const data = await apiGet<{ experiences: Experience[]; next_cursor: string | null }>(`/api/experiences?${params}`);
      const newItems = Array.isArray(data?.experiences) ? data.experiences : [];
      if (cursor && !isRefresh) {
        setExperiences((prev) => [...prev, ...newItems]);
      } else {
        setExperiences(newItems);
      }
      setNextCursor(data?.next_cursor ?? null);
      setError(null);
    } catch (e: any) {
      console.error("Experiences: fetch error:", e);
      if (!cursor) setError("Couldn't load experiences. Check your connection.");
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      console.log("ExperiencesScreen focused - fetching experiences");
      setLoading(true);
      fetchExperiences();
    }, [fetchExperiences])
  );

  const handleRefresh = useCallback(() => {
    console.log("User pulled to refresh experiences");
    setRefreshing(true);
    fetchExperiences(undefined, true);
  }, [fetchExperiences]);

  const handleLoadMore = useCallback(() => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    fetchExperiences(nextCursor);
  }, [nextCursor, loadingMore, fetchExperiences]);

  const handleCardPress = useCallback((experience: Experience) => {
    console.log("User tapped experience card:", experience.id, experience.title);
    router.push(`/experience/${experience.id}` as any);
  }, [router]);

  const renderItem = useCallback(({ item, index }: { item: Experience; index: number }) => (
    <ExperienceCard experience={item} onPress={() => handleCardPress(item)} index={index} />
  ), [handleCardPress]);

  const renderHeader = () => (
    <View style={styles.header}>
      <Film size={22} color={PINK} strokeWidth={2} />
      <Text style={styles.headerTitle}>Experiences</Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        {renderHeader()}
        {[0, 1, 2].map((i) => <SkeletonCard key={i} />)}
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        {renderHeader()}
        <View style={styles.errorState}>
          <Film size={48} color="#D1D5DB" strokeWidth={1.5} />
          <Text style={styles.errorTitle}>Couldn't load experiences</Text>
          <Text style={styles.errorSubtitle}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); fetchExperiences(); }} activeOpacity={0.8}>
            <Text style={styles.retryBtnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <FlatList
        data={experiences}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={PINK} />}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Film size={48} color="#D1D5DB" strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>No experiences yet</Text>
            <Text style={styles.emptySubtitle}>Long-form travel experiences will appear here</Text>
          </View>
        }
        ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color={PINK} style={{ marginVertical: 20 }} /> : null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  headerTitle: { fontSize: 24, fontWeight: "800", color: "#111827", letterSpacing: -0.5 },
  listContent: { paddingBottom: 100 },
  emptyState: { alignItems: "center", paddingTop: 80, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#374151", marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: "#9CA3AF", marginTop: 8, textAlign: "center", lineHeight: 20 },
  errorState: { alignItems: "center", paddingTop: 80, paddingHorizontal: 32 },
  errorTitle: { fontSize: 18, fontWeight: "700", color: "#374151", marginTop: 16 },
  errorSubtitle: { fontSize: 14, color: "#9CA3AF", marginTop: 8, textAlign: "center", lineHeight: 20 },
  retryBtn: { marginTop: 20, backgroundColor: PINK, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  retryBtnText: { fontSize: 15, fontWeight: "700", color: "#FFF" },
});
