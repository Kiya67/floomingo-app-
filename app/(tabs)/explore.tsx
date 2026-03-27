
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
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

// ─── Colors ──────────────────────────────────────────────────────────────────
const PINK = "#FF6B9D";
const ORANGE = "#FF8C42";
const BG = "#FFFFFF";
const SURFACE = "#FFFFFF";
const TEXT = "#1A1A1A";
const TEXT_SECONDARY = "#6B6B6B";
const TEXT_TERTIARY = "#A0A0A0";
const BORDER = "rgba(0,0,0,0.07)";
const INPUT_BG = "#F0F0F0";

const { width } = Dimensions.get("window");
const CARD_WIDTH = width - 32;
const THUMB_HEIGHT = CARD_WIDTH * (9 / 16);

// ─── Demo Data ────────────────────────────────────────────────────────────────
export const DEMO_EXPERIENCES = [
  { id: "1", title: "Sunset in Santorini", description: "Golden hour views over the caldera", location: "Santorini, Greece", duration: 3600, view_count: 12400, thumbnail_url: "https://picsum.photos/seed/santorini/400/300", creator: "Sofia M.", avatar: "https://i.pravatar.cc/40?img=1", created_at: "2024-01-15T10:00:00Z" },
  { id: "2", title: "Tokyo Street Food Tour", description: "Exploring the best ramen and sushi spots", location: "Tokyo, Japan", duration: 5400, view_count: 8900, thumbnail_url: "https://picsum.photos/seed/tokyo/400/300", creator: "Kenji T.", avatar: "https://i.pravatar.cc/40?img=2", created_at: "2024-01-14T10:00:00Z" },
  { id: "3", title: "Hiking the Dolomites", description: "Epic mountain trails and alpine lakes", location: "Dolomites, Italy", duration: 7200, view_count: 21000, thumbnail_url: "https://picsum.photos/seed/dolomites/400/300", creator: "Marco R.", avatar: "https://i.pravatar.cc/40?img=3", created_at: "2024-01-13T10:00:00Z" },
  { id: "4", title: "Bali Rice Terraces", description: "Peaceful walks through Tegallalang", location: "Ubud, Bali", duration: 2700, view_count: 15600, thumbnail_url: "https://picsum.photos/seed/bali/400/300", creator: "Ayu W.", avatar: "https://i.pravatar.cc/40?img=4", created_at: "2024-01-12T10:00:00Z" },
  { id: "5", title: "Northern Lights in Iceland", description: "Chasing the aurora borealis", location: "Reykjavik, Iceland", duration: 4800, view_count: 33000, thumbnail_url: "https://picsum.photos/seed/iceland/400/300", creator: "Bjorn H.", avatar: "https://i.pravatar.cc/40?img=5", created_at: "2024-01-11T10:00:00Z" },
  { id: "6", title: "Safari in Serengeti", description: "Wildlife encounters on the great plains", location: "Serengeti, Tanzania", duration: 6600, view_count: 19200, thumbnail_url: "https://picsum.photos/seed/serengeti/400/300", creator: "Amara N.", avatar: "https://i.pravatar.cc/40?img=6", created_at: "2024-01-10T10:00:00Z" },
];

// ─── Types ────────────────────────────────────────────────────────────────────
export interface DemoExperience {
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

const SORT_OPTIONS = ["Newest", "Most Viewed"] as const;
type SortOption = (typeof SORT_OPTIONS)[number];

const DURATION_OPTIONS = ["< 30 min", "30–60 min", "1–2 hrs", "2+ hrs"] as const;
type DurationOption = (typeof DURATION_OPTIONS)[number];

const PLACE_SUGGESTIONS = ["Paris, France", "Tokyo, Japan", "New York, USA", "Bali, Indonesia"];
const KEYWORD_CHIPS = ["Food", "Travel", "Nature", "City", "Adventure", "Culture"];

interface FilterState {
  sort: SortOption;
  duration: DurationOption | null;
  place: string;
  keywords: string[];
}

const DEFAULT_FILTERS: FilterState = { sort: "Newest", duration: null, place: "", keywords: [] };

function isFilterActive(f: FilterState): boolean {
  return f.sort !== "Newest" || f.duration !== null || f.place !== "" || f.keywords.length > 0;
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
function GradientBorderCard({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <LinearGradient
      colors={[PINK, ORANGE]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.gradientBorder, style]}
    >
      <View style={styles.cardInner}>
        {children}
      </View>
    </LinearGradient>
  );
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
  const [placeInput, setPlaceInput] = useState(filters.place);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      setDraft(filters);
      setPlaceInput(filters.place);
    }
  }, [visible, filters]);

  const handleApply = () => {
    const final = { ...draft, place: placeInput };
    console.log("User tapped Apply Filters on explore filter sheet:", final);
    onApply(final);
    onClose();
  };

  const handleReset = () => {
    console.log("User tapped Reset on explore filter sheet");
    setDraft(DEFAULT_FILTERS);
    setPlaceInput("");
    onApply(DEFAULT_FILTERS);
    onClose();
  };

  const handlePlaceInput = (text: string) => {
    setPlaceInput(text);
    setShowSuggestions(text.length > 0);
    setDraft((d) => ({ ...d, place: text }));
  };

  const handleSelectPlace = (place: string) => {
    console.log("User selected place suggestion:", place);
    setPlaceInput(place);
    setDraft((d) => ({ ...d, place }));
    setShowSuggestions(false);
  };

  const toggleKeyword = (kw: string) => {
    console.log("User toggled keyword chip:", kw);
    setDraft((d) => {
      const has = d.keywords.includes(kw);
      return { ...d, keywords: has ? d.keywords.filter((k) => k !== kw) : [...d.keywords, kw] };
    });
  };

  const filteredSuggestions = PLACE_SUGGESTIONS.filter((p) =>
    p.toLowerCase().includes(placeInput.toLowerCase())
  );

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
            keyboardShouldPersistTaps="handled"
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
                      <LinearGradient colors={[PINK, ORANGE]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.chipSelected}>
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
                      setDraft((d) => ({ ...d, duration: d.duration === opt ? null : opt }));
                    }}
                    activeOpacity={0.7}
                  >
                    {isSelected ? (
                      <LinearGradient colors={[PINK, ORANGE]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.chipSelected}>
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

            {/* Location */}
            <Text style={[styles.sheetSectionLabel, { marginTop: 24 }]}>Filter by place</Text>
            <View style={styles.filterInputWrapper}>
              <Feather name="map-pin" size={16} color={TEXT_TERTIARY} style={styles.filterInputIcon} />
              <TextInput
                style={styles.filterInput}
                placeholder="Search a place..."
                placeholderTextColor={TEXT_TERTIARY}
                value={placeInput}
                onChangeText={handlePlaceInput}
                autoCapitalize="words"
                autoCorrect={false}
                onFocus={() => setShowSuggestions(placeInput.length > 0)}
              />
              {placeInput.length > 0 && (
                <TouchableOpacity onPress={() => { setPlaceInput(""); setDraft((d) => ({ ...d, place: "" })); setShowSuggestions(false); }}>
                  <Feather name="x" size={16} color={TEXT_TERTIARY} />
                </TouchableOpacity>
              )}
            </View>
            {showSuggestions && filteredSuggestions.length > 0 && (
              <View style={styles.suggestionsBox}>
                {filteredSuggestions.map((place) => (
                  <TouchableOpacity
                    key={place}
                    style={styles.suggestionItem}
                    onPress={() => handleSelectPlace(place)}
                    activeOpacity={0.7}
                  >
                    <Feather name="map-pin" size={13} color={PINK} />
                    <Text style={styles.suggestionText}>{place}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {draft.place !== "" && (
              <View style={styles.chipRow}>
                <LinearGradient colors={[PINK, ORANGE]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.chipSelected}>
                  <Text style={styles.chipTextSelected}>{draft.place}</Text>
                </LinearGradient>
              </View>
            )}

            {/* Keywords */}
            <Text style={[styles.sheetSectionLabel, { marginTop: 24 }]}>Keywords</Text>
            <View style={styles.filterInputWrapper}>
              <Feather name="tag" size={16} color={TEXT_TERTIARY} style={styles.filterInputIcon} />
              <Text style={styles.filterInputPlaceholder}>Tap chips below to filter</Text>
            </View>
            <View style={[styles.chipRow, { marginTop: 10 }]}>
              {KEYWORD_CHIPS.map((kw) => {
                const isSelected = draft.keywords.includes(kw);
                return (
                  <TouchableOpacity key={kw} onPress={() => toggleKeyword(kw)} activeOpacity={0.7}>
                    {isSelected ? (
                      <LinearGradient colors={[PINK, ORANGE]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.chipSelected}>
                        <Text style={styles.chipTextSelected}>{kw}</Text>
                      </LinearGradient>
                    ) : (
                      <View style={styles.chip}>
                        <Text style={styles.chipText}>{kw}</Text>
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
              <LinearGradient colors={[PINK, ORANGE]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.applyBtn}>
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
  const translateY = useRef(new Animated.Value(20)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 380, delay: index * 80, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 380, delay: index * 80, useNativeDriver: true }),
    ]).start();
  }, []);

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.975, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  };

  const durationText = formatDuration(item.duration);
  const viewsText = formatViews(item.view_count);
  const thumbSource = resolveImageSource(item.thumbnail_url);
  const avatarSource = resolveImageSource(item.avatar);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }, { scale }] }}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <GradientBorderCard>
          {/* Thumbnail */}
          <View style={styles.thumbContainer}>
            <Image source={thumbSource} style={styles.thumb} resizeMode="cover" />
            {/* Duration badge */}
            <View style={styles.durationBadge}>
              <Feather name="clock" size={10} color="#FFF" />
              <Text style={styles.durationBadgeText}>{durationText}</Text>
            </View>
            {/* Views badge */}
            <View style={styles.viewsBadge}>
              <Feather name="eye" size={10} color="#FFF" />
              <Text style={styles.durationBadgeText}>{viewsText}</Text>
            </View>
          </View>

          {/* Card info */}
          <View style={styles.cardInfo}>
            {/* Avatar + creator + title */}
            <View style={styles.cardInfoTop}>
              <Image source={avatarSource} style={styles.cardAvatar} />
              <View style={styles.cardTextBlock}>
                <Text style={styles.cardCreator}>{item.creator}</Text>
                <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                <View style={styles.locationRow}>
                  <Feather name="map-pin" size={11} color={PINK} />
                  <Text style={styles.locationText} numberOfLines={1}>{item.location}</Text>
                </View>
              </View>
            </View>

            {/* Action icons */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => console.log("User tapped heart on card:", item.id)}
                activeOpacity={0.7}
              >
                <Feather name="heart" size={18} color={TEXT_TERTIARY} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => console.log("User tapped comment on card:", item.id)}
                activeOpacity={0.7}
              >
                <Feather name="message-circle" size={18} color={TEXT_TERTIARY} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => console.log("User tapped bookmark on card:", item.id)}
                activeOpacity={0.7}
              >
                <Feather name="bookmark" size={18} color={TEXT_TERTIARY} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => console.log("User tapped share on card:", item.id)}
                activeOpacity={0.7}
              >
                <Feather name="send" size={18} color={TEXT_TERTIARY} />
              </TouchableOpacity>
            </View>
          </View>
        </GradientBorderCard>
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
      result = result.filter((exp) =>
        exp.title.toLowerCase().includes(q) ||
        exp.description.toLowerCase().includes(q) ||
        exp.location.toLowerCase().includes(q)
      );
    }
    if (filters.place) {
      result = result.filter((exp) =>
        exp.location.toLowerCase().includes(filters.place.toLowerCase())
      );
    }
    if (filters.keywords.length > 0) {
      result = result.filter((exp) =>
        filters.keywords.some((kw) =>
          exp.title.toLowerCase().includes(kw.toLowerCase()) ||
          exp.description.toLowerCase().includes(kw.toLowerCase())
        )
      );
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
      result = result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
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
          <View style={styles.searchInputWrapper}>
            <Feather name="search" size={17} color={TEXT_TERTIARY} style={styles.searchIcon} />
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
          <TouchableOpacity
            style={styles.filterBtnWrapper}
            onPress={() => {
              console.log("User tapped filter button on explore screen");
              setFilterSheetVisible(true);
            }}
            activeOpacity={0.85}
          >
            <LinearGradient colors={[PINK, ORANGE]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.filterBtn}>
              <Feather name="sliders" size={18} color="#FFF" />
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
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <Feather name="film" size={28} color={PINK} />
            </View>
            <Text style={styles.emptyTitle}>No results found</Text>
            <Text style={styles.emptySubtitle}>Try a different search or adjust your filters</Text>
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
  // ── Gradient border card ──
  gradientBorder: {
    borderRadius: 18,
    padding: 2.5,
    shadowColor: PINK,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 5,
  },
  cardInner: {
    backgroundColor: SURFACE,
    borderRadius: 16,
    overflow: "hidden",
  },
  // ── Thumbnail ──
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
  durationBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFF",
  },
  // ── Card info ──
  cardInfo: {
    padding: 12,
    gap: 10,
  },
  cardInfoTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  cardAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: INPUT_BG,
    marginTop: 2,
  },
  cardTextBlock: {
    flex: 1,
    gap: 2,
  },
  cardCreator: {
    fontSize: 12,
    fontWeight: "700",
    color: TEXT_SECONDARY,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: TEXT,
    lineHeight: 21,
    letterSpacing: -0.1,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  locationText: {
    fontSize: 12,
    color: TEXT_TERTIARY,
    flex: 1,
  },
  // ── Action row ──
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  actionBtn: {
    padding: 4,
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
    maxHeight: "82%",
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
  // ── Filter inputs ──
  filterInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: INPUT_BG,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: BORDER,
  },
  filterInputIcon: {
    marginRight: 8,
  },
  filterInput: {
    flex: 1,
    fontSize: 14,
    color: TEXT,
    paddingVertical: 0,
  },
  filterInputPlaceholder: {
    flex: 1,
    fontSize: 14,
    color: TEXT_TERTIARY,
  },
  suggestionsBox: {
    backgroundColor: SURFACE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    marginTop: 6,
    marginBottom: 8,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  suggestionText: {
    fontSize: 14,
    color: TEXT,
    fontWeight: "500",
  },
  // ── Sheet footer ──
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
