
import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Image,
  ImageSourcePropType,
  Animated,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { MapPin, Eye, Clock, Search, SlidersHorizontal, Film } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

// ─── Colors ──────────────────────────────────────────────────────────────────
const PINK = "#FF6B9D";
const ORANGE = "#FF8C42";
const BG = "#F8F8F8";
const SURFACE = "#FFFFFF";
const TEXT = "#1A1A1A";
const TEXT_SECONDARY = "#6B6B6B";
const TEXT_TERTIARY = "#A0A0A0";
const BORDER = "rgba(0,0,0,0.07)";
const INPUT_BG = "#F0F0F0";

const { width } = Dimensions.get("window");
const THUMB_HEIGHT = (width - 32) * (9 / 16);

// ─── Demo Data ────────────────────────────────────────────────────────────────
const DEMO_EXPERIENCES = [
  { id: "1", title: "Sunset in Santorini", description: "Golden hour views over the caldera", location: "Santorini, Greece", duration: 3600, view_count: 12400, thumbnail_url: "https://picsum.photos/seed/santorini/400/300", created_at: "2024-01-15T10:00:00Z" },
  { id: "2", title: "Tokyo Street Food Tour", description: "Exploring the best ramen and sushi spots", location: "Tokyo, Japan", duration: 5400, view_count: 8900, thumbnail_url: "https://picsum.photos/seed/tokyo/400/300", created_at: "2024-01-14T10:00:00Z" },
  { id: "3", title: "Hiking the Dolomites", description: "Epic mountain trails and alpine lakes", location: "Dolomites, Italy", duration: 7200, view_count: 21000, thumbnail_url: "https://picsum.photos/seed/dolomites/400/300", created_at: "2024-01-13T10:00:00Z" },
  { id: "4", title: "Bali Rice Terraces", description: "Peaceful walks through Tegallalang", location: "Ubud, Bali", duration: 2700, view_count: 15600, thumbnail_url: "https://picsum.photos/seed/bali/400/300", created_at: "2024-01-12T10:00:00Z" },
  { id: "5", title: "Northern Lights in Iceland", description: "Chasing the aurora borealis", location: "Reykjavik, Iceland", duration: 4800, view_count: 33000, thumbnail_url: "https://picsum.photos/seed/iceland/400/300", created_at: "2024-01-11T10:00:00Z" },
  { id: "6", title: "Safari in Serengeti", description: "Wildlife encounters on the great plains", location: "Serengeti, Tanzania", duration: 6600, view_count: 19200, thumbnail_url: "https://picsum.photos/seed/serengeti/400/300", created_at: "2024-01-10T10:00:00Z" },
];

// ─── Types ────────────────────────────────────────────────────────────────────
interface DemoExperience {
  id: string;
  title: string;
  description: string;
  location: string;
  duration: number;
  view_count: number;
  thumbnail_url: string;
  created_at: string;
}

const SORT_OPTIONS = ["Newest", "Most Viewed"] as const;
type SortOption = (typeof SORT_OPTIONS)[number];

const DURATION_OPTIONS = ["< 30 min", "30–60 min", "1–2 hrs", "2+ hrs"] as const;
type DurationOption = (typeof DURATION_OPTIONS)[number];

interface FilterState {
  sort: SortOption;
  duration: DurationOption | null;
}

const DEFAULT_FILTERS: FilterState = { sort: "Newest", duration: null };

function isFilterActive(f: FilterState): boolean {
  return f.sort !== "Newest" || f.duration !== null;
}

function resolveImageSource(
  source: string | number | ImageSourcePropType | undefined
): ImageSourcePropType {
  if (!source) return { uri: "" };
  if (typeof source === "string") return { uri: source };
  return source as ImageSourcePropType;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
}

function formatViews(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return String(count);
}

// ─── Filter Sheet ─────────────────────────────────────────────────────────────
function FilterSheet({
  visible,
  onClose,
  filters,
  onApply,
}: {
  visible: boolean;
  onClose: () => void;
  filters: FilterState;
  onApply: (f: FilterState) => void;
}) {
  const [draft, setDraft] = useState<FilterState>(filters);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) setDraft(filters);
  }, [visible, filters]);

  const handleApply = () => {
    console.log("User tapped Apply Filters on explore filter sheet:", draft);
    onApply(draft);
    onClose();
  };

  const handleReset = () => {
    console.log("User tapped Reset on explore filter sheet");
    setDraft(DEFAULT_FILTERS);
    onApply(DEFAULT_FILTERS);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.sheetOverlay}
      >
        <Pressable style={styles.sheetBackdrop} onPress={onClose} />
        <View style={[styles.sheetContainer, { paddingBottom: insets.bottom + 8 }]}>
          <View style={styles.sheetHandle} />

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sheetContent}
          >
            {/* Sort by */}
            <Text style={styles.sheetSectionLabel}>Sort by</Text>
            <View style={styles.chipRow}>
              {SORT_OPTIONS.map((opt) => {
                const isSelected = draft.sort === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => {
                      console.log("User selected sort option:", opt);
                      setDraft((d) => ({ ...d, sort: opt }));
                    }}
                    activeOpacity={0.7}
                  >
                    {isSelected ? (
                      <LinearGradient
                        colors={[PINK, ORANGE]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.chipSelected}
                      >
                        <Text style={styles.chipTextSelected}>{opt}</Text>
                      </LinearGradient>
                    ) : (
                      <View style={styles.chip}>
                        <Text style={styles.chipText}>{opt}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Duration */}
            <Text style={[styles.sheetSectionLabel, { marginTop: 24 }]}>Duration</Text>
            <View style={styles.chipRow}>
              {DURATION_OPTIONS.map((opt) => {
                const isSelected = draft.duration === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => {
                      console.log("User selected duration option:", opt);
                      setDraft((d) => ({
                        ...d,
                        duration: d.duration === opt ? null : opt,
                      }));
                    }}
                    activeOpacity={0.7}
                  >
                    {isSelected ? (
                      <LinearGradient
                        colors={[PINK, ORANGE]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.chipSelected}
                      >
                        <Text style={styles.chipTextSelected}>{opt}</Text>
                      </LinearGradient>
                    ) : (
                      <View style={styles.chip}>
                        <Text style={styles.chipText}>{opt}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.sheetFooter}>
            <TouchableOpacity style={styles.resetBtn} onPress={handleReset} activeOpacity={0.7}>
              <Text style={styles.resetBtnText}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyBtnWrapper} onPress={handleApply} activeOpacity={0.85}>
              <LinearGradient
                colors={[PINK, ORANGE]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.applyBtn}
              >
                <Text style={styles.applyBtnText}>Apply filters</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Experience Card ──────────────────────────────────────────────────────────
function ExperienceCard({
  item,
  index,
  onPress,
}: {
  item: DemoExperience;
  index: number;
  onPress: () => void;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 350,
        delay: index * 70,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 350,
        delay: index * 70,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  };

  const durationText = formatDuration(item.duration);
  const viewsText = formatViews(item.view_count);
  const thumbSource = resolveImageSource(item.thumbnail_url);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }, { scale }] }]}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <View style={styles.card}>
          {/* Thumbnail */}
          <View style={styles.thumbContainer}>
            <Image
              source={thumbSource}
              style={styles.thumb}
              resizeMode="cover"
            />
            {/* Gradient bar at bottom of thumbnail */}
            <LinearGradient
              colors={[PINK, ORANGE]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.thumbGradientBar}
              pointerEvents="none"
            />
            {/* Duration badge */}
            <View style={styles.durationBadge}>
              <Clock size={11} color="#FFF" strokeWidth={2.5} />
              <Text style={styles.durationBadgeText}>{durationText}</Text>
            </View>
          </View>

          {/* Card info */}
          <View style={styles.cardInfo}>
            {/* Left accent bar */}
            <LinearGradient
              colors={[PINK, ORANGE]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.accentBar}
            />
            <View style={styles.cardInfoInner}>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={styles.cardDescription} numberOfLines={1}>
                {item.description}
              </Text>
              <View style={styles.metaRow}>
                <View style={styles.metaChip}>
                  <MapPin size={12} color={PINK} strokeWidth={2} />
                  <Text style={styles.metaText} numberOfLines={1}>
                    {item.location}
                  </Text>
                </View>
                <View style={styles.metaChip}>
                  <Eye size={12} color={TEXT_TERTIARY} strokeWidth={2} />
                  <Text style={styles.metaTextMuted}>{viewsText}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ExploreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      console.log("Explore search: debounced query updated to:", text);
      setDebouncedQuery(text);
    }, 350);
  };

  const filteredFeed = React.useMemo(() => {
    let result = [...DEMO_EXPERIENCES];

    const q = debouncedQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((exp) => {
        const titleMatch = exp.title.toLowerCase().includes(q);
        const descMatch = exp.description.toLowerCase().includes(q);
        const locMatch = exp.location.toLowerCase().includes(q);
        return titleMatch || descMatch || locMatch;
      });
    }

    if (filters.duration !== null) {
      result = result.filter((exp) => {
        const mins = exp.duration / 60;
        if (filters.duration === "< 30 min") return mins < 30;
        if (filters.duration === "30–60 min") return mins >= 30 && mins < 60;
        if (filters.duration === "1–2 hrs") return mins >= 60 && mins < 120;
        if (filters.duration === "2+ hrs") return mins >= 120;
        return true;
      });
    }

    if (filters.sort === "Most Viewed") {
      result = result.sort((a, b) => b.view_count - a.view_count);
    } else {
      result = result.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }

    return result;
  }, [debouncedQuery, filters]);

  const filterActive = isFilterActive(filters);

  const renderItem = useCallback(
    ({ item, index }: { item: DemoExperience; index: number }) => (
      <ExperienceCard
        item={item}
        index={index}
        onPress={() => {
          console.log("User tapped experience card on explore screen:", item.id, item.title);
          router.push(`/experience/${item.id}` as any);
        }}
      />
    ),
    [router]
  );

  const keyExtractor = useCallback((item: DemoExperience) => item.id, []);

  const headerPaddingTop = insets.top + 8;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={SURFACE} />

      {/* Sticky header */}
      <View style={[styles.header, { paddingTop: headerPaddingTop }]}>
        <Text style={styles.headerTitle}>Explore</Text>
        <View style={styles.searchRow}>
          {/* Search input */}
          <View style={styles.searchInputWrapper}>
            <Search size={17} color={TEXT_TERTIARY} strokeWidth={2} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search experiences..."
              placeholderTextColor={TEXT_TERTIARY}
              value={searchQuery}
              onChangeText={handleSearchChange}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
          </View>

          {/* Filter button */}
          <TouchableOpacity
            style={styles.filterBtnWrapper}
            onPress={() => {
              console.log("User tapped filter button on explore screen");
              setFilterSheetVisible(true);
            }}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[PINK, ORANGE]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.filterBtn}
            >
              <SlidersHorizontal size={18} color="#FFF" strokeWidth={2.5} />
            </LinearGradient>
            {filterActive && <View style={styles.filterBadge} />}
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={filteredFeed}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <Film size={28} color={PINK} strokeWidth={1.5} />
            </View>
            <Text style={styles.emptyTitle}>No results found</Text>
            <Text style={styles.emptySubtitle}>
              Try a different search or adjust your filters
            </Text>
          </View>
        }
      />

      <FilterSheet
        visible={filterSheetVisible}
        onClose={() => setFilterSheetVisible(false)}
        filters={filters}
        onApply={(f) => {
          console.log("Explore: filters applied:", f);
          setFilters(f);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  // ── Header ──
  header: {
    backgroundColor: SURFACE,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: TEXT,
    letterSpacing: -0.4,
    marginBottom: 12,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: INPUT_BG,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: TEXT,
    paddingVertical: 0,
  },
  filterBtnWrapper: {
    position: "relative",
  },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  filterBadge: {
    position: "absolute",
    top: 1,
    right: 1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: ORANGE,
    borderWidth: 2,
    borderColor: SURFACE,
  },
  // ── List ──
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 16,
  },
  // ── Card ──
  card: {
    backgroundColor: SURFACE,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  thumbContainer: {
    width: "100%",
    height: THUMB_HEIGHT,
    backgroundColor: INPUT_BG,
    overflow: "hidden",
  },
  thumb: {
    width: "100%",
    height: "100%",
  },
  thumbGradientBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  durationBadge: {
    position: "absolute",
    bottom: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  durationBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFF",
  },
  cardInfo: {
    flexDirection: "row",
    padding: 14,
    gap: 0,
  },
  accentBar: {
    width: 3,
    borderRadius: 2,
    marginRight: 12,
    alignSelf: "stretch",
  },
  cardInfoInner: {
    flex: 1,
    gap: 5,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: TEXT,
    lineHeight: 21,
    letterSpacing: -0.1,
  },
  cardDescription: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 2,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
  },
  metaText: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    fontWeight: "500",
    flex: 1,
  },
  metaTextMuted: {
    fontSize: 12,
    color: TEXT_TERTIARY,
    fontWeight: "500",
  },
  // ── Empty state ──
  emptyState: {
    alignItems: "center",
    paddingTop: 80,
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: "rgba(255,107,157,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: TEXT,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    textAlign: "center",
    lineHeight: 20,
  },
  // ── Filter Sheet ──
  sheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheetContainer: {
    backgroundColor: SURFACE,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "75%",
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#DDD",
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 4,
  },
  sheetContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sheetSectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: TEXT_TERTIARY,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: INPUT_BG,
    borderWidth: 1,
    borderColor: BORDER,
  },
  chipSelected: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    color: TEXT_SECONDARY,
  },
  chipTextSelected: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFF",
  },
  sheetFooter: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  resetBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "rgba(0,0,0,0.12)",
  },
  resetBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: TEXT_SECONDARY,
  },
  applyBtnWrapper: {
    flex: 2,
  },
  applyBtn: {
    height: 50,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  applyBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFF",
  },
});
