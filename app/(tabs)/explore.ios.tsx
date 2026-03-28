
import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Dimensions,
  Image,
  ImageSourcePropType,
  Animated,
  TextInput,
  ScrollView,
  Modal,
  Pressable,
  useColorScheme,
} from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

// ─── Brand Colors (constant) ──────────────────────────────────────────────────
const PINK = "#FF6B9D";
const ORANGE = "#FF8C42";

const { width } = Dimensions.get("window");
const CARD_WIDTH = width - 32;
const THUMB_HEIGHT = CARD_WIDTH * (9 / 16);

// ─── Color scheme helper ──────────────────────────────────────────────────────
type ColorScheme = "light" | "dark";

function getColors(scheme: ColorScheme | null | undefined) {
  const dark = scheme === "dark";
  return {
    BG: dark ? "#0F0F0F" : "#FFFFFF",
    SURFACE: dark ? "#1A1A1A" : "#FFFFFF",
    CARD_BG: dark ? "#1A1A1A" : "#FFFFFF",
    TEXT: dark ? "#F0F0F0" : "#1A1A1A",
    TEXT_SECONDARY: dark ? "#A0A0A0" : "#6B6B6B",
    TEXT_TERTIARY: dark ? "#666666" : "#A0A0A0",
    BORDER: dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)",
    INPUT_BG: dark ? "#2A2A2A" : "#F0F0F0",
  };
}

// ─── Demo Data ────────────────────────────────────────────────────────────────
const DEMO_EXPERIENCES = [
  { id: "1", title: "Sunset in Santorini", description: "Golden hour views over the caldera", location: "Santorini, Greece", duration: 3600, view_count: 12400, thumbnail_url: "https://picsum.photos/seed/santorini/400/300", creator: "Sofia M.", avatar: "https://i.pravatar.cc/40?img=1", created_at: "2024-01-15T10:00:00Z" },
  { id: "2", title: "Tokyo Street Food Tour", description: "Exploring the best ramen and sushi spots", location: "Tokyo, Japan", duration: 5400, view_count: 8900, thumbnail_url: "https://picsum.photos/seed/tokyo/400/300", creator: "Kenji T.", avatar: "https://i.pravatar.cc/40?img=2", created_at: "2024-01-14T10:00:00Z" },
  { id: "3", title: "Hiking the Dolomites", description: "Epic mountain trails and alpine lakes", location: "Dolomites, Italy", duration: 7200, view_count: 21000, thumbnail_url: "https://picsum.photos/seed/dolomites/400/300", creator: "Marco R.", avatar: "https://i.pravatar.cc/40?img=3", created_at: "2024-01-13T10:00:00Z" },
  { id: "4", title: "Bali Rice Terraces", description: "Peaceful walks through Tegallalang", location: "Ubud, Bali", duration: 2700, view_count: 15600, thumbnail_url: "https://picsum.photos/seed/bali/400/300", creator: "Ayu W.", avatar: "https://i.pravatar.cc/40?img=4", created_at: "2024-01-12T10:00:00Z" },
  { id: "5", title: "Northern Lights in Iceland", description: "Chasing the aurora borealis", location: "Reykjavik, Iceland", duration: 4800, view_count: 33000, thumbnail_url: "https://picsum.photos/seed/iceland/400/300", creator: "Bjorn H.", avatar: "https://i.pravatar.cc/40?img=5", created_at: "2024-01-11T10:00:00Z" },
  { id: "6", title: "Safari in Serengeti", description: "Wildlife encounters on the great plains", location: "Serengeti, Tanzania", duration: 6600, view_count: 19200, thumbnail_url: "https://picsum.photos/seed/serengeti/400/300", creator: "Amara N.", avatar: "https://i.pravatar.cc/40?img=6", created_at: "2024-01-10T10:00:00Z" },
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

type Colors = ReturnType<typeof getColors>;

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


// ─── Style factory ────────────────────────────────────────────────────────────
function getStyles(c: Colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.BG,
    },
    header: {
      backgroundColor: c.SURFACE,
      paddingHorizontal: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.BORDER,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      zIndex: 10,
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
      backgroundColor: c.INPUT_BG,
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
      color: c.TEXT,
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
      borderColor: c.SURFACE,
    },
    listContent: {
      paddingHorizontal: 16,
      paddingTop: 16,
      gap: 16,
    },
    // ── Card ──
    card: {
      backgroundColor: c.CARD_BG,
      borderRadius: 18,
      overflow: "hidden",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
    },
    // ── Thumbnail ──
    thumbContainer: {
      width: "100%",
      height: THUMB_HEIGHT,
      backgroundColor: c.INPUT_BG,
      overflow: "hidden",
    },
    thumb: {
      width: "100%",
      height: "100%",
    },
    thumbGradient: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      height: 60,
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
    durationBadgeText: {
      fontSize: 11,
      fontWeight: "700",
      color: "#FFF",
    },
    // ── Card info ──
    cardInfo: {
      padding: 12,
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
      backgroundColor: c.INPUT_BG,
      marginTop: 2,
    },
    cardTextBlock: {
      flex: 1,
      gap: 2,
    },
    cardCreator: {
      fontSize: 12,
      fontWeight: "700",
      color: c.TEXT_SECONDARY,
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: c.TEXT,
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
      color: PINK,
      flex: 1,
      textDecorationLine: "underline",
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
      color: c.TEXT,
      textAlign: "center",
    },
    emptySubtitle: {
      fontSize: 14,
      color: c.TEXT_SECONDARY,
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
      backgroundColor: c.SURFACE,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: "82%",
    },
    sheetHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.BORDER,
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
      color: c.TEXT_TERTIARY,
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
      backgroundColor: c.INPUT_BG,
      borderWidth: 1,
      borderColor: c.BORDER,
    },
    chipSelected: {
      paddingHorizontal: 16,
      paddingVertical: 9,
      borderRadius: 20,
    },
    chipText: {
      fontSize: 13,
      fontWeight: "600",
      color: c.TEXT_SECONDARY,
    },
    chipTextSelected: {
      fontSize: 13,
      fontWeight: "700",
      color: "#FFF",
    },
    filterInputWrapper: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.INPUT_BG,
      borderRadius: 12,
      paddingHorizontal: 12,
      height: 44,
      borderWidth: 1,
      borderColor: c.BORDER,
    },
    filterInputIcon: {
      marginRight: 8,
    },
    filterInput: {
      flex: 1,
      fontSize: 14,
      color: c.TEXT,
      paddingVertical: 0,
    },
    filterInputPlaceholder: {
      flex: 1,
      fontSize: 14,
      color: c.TEXT_TERTIARY,
    },
    suggestionsBox: {
      backgroundColor: c.SURFACE,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.BORDER,
      marginTop: 6,
      marginBottom: 8,
      overflow: "hidden",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
    },
    suggestionItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderBottomWidth: 1,
      borderBottomColor: c.BORDER,
    },
    suggestionText: {
      fontSize: 14,
      color: c.TEXT,
      fontWeight: "500",
    },
    sheetFooter: {
      flexDirection: "row",
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 12,
      gap: 12,
      borderTopWidth: 1,
      borderTopColor: c.BORDER,
    },
    resetBtn: {
      flex: 1,
      height: 50,
      borderRadius: 14,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1.5,
      borderColor: c.BORDER,
    },
    resetBtnText: {
      fontSize: 15,
      fontWeight: "600",
      color: c.TEXT_SECONDARY,
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
}

// ─── Filter Sheet ─────────────────────────────────────────────────────────────
function FilterSheet({
  visible,
  onClose,
  filters,
  onApply,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  filters: FilterState;
  onApply: (f: FilterState) => void;
  colors: Colors;
}) {
  const [draft, setDraft] = useState<FilterState>(filters);
  const [placeInput, setPlaceInput] = useState(filters.place);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const insets = useSafeAreaInsets();
  const styles = getStyles(colors);

  useEffect(() => {
    if (visible) {
      setDraft(filters);
      setPlaceInput(filters.place);
    }
  }, [visible, filters]);

  const handleApply = () => {
    const final = { ...draft, place: placeInput };
    console.log("User tapped Apply Filters on explore filter sheet (iOS):", final);
    onApply(final);
    onClose();
  };

  const handleReset = () => {
    console.log("User tapped Reset on explore filter sheet (iOS)");
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
    console.log("User selected place suggestion (iOS):", place);
    setPlaceInput(place);
    setDraft((d) => ({ ...d, place }));
    setShowSuggestions(false);
  };

  const toggleKeyword = (kw: string) => {
    console.log("User toggled keyword chip (iOS):", kw);
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
      <View style={styles.sheetOverlay}>
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
                      console.log("User selected sort option (iOS):", opt);
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
                      console.log("User selected duration option (iOS):", opt);
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
              <Feather name="map-pin" size={16} color={colors.TEXT_TERTIARY} style={styles.filterInputIcon} />
              <TextInput
                style={styles.filterInput}
                placeholder="Search a place..."
                placeholderTextColor={colors.TEXT_TERTIARY}
                value={placeInput}
                onChangeText={handlePlaceInput}
                autoCapitalize="words"
                autoCorrect={false}
                onFocus={() => setShowSuggestions(placeInput.length > 0)}
              />
              {placeInput.length > 0 && (
                <TouchableOpacity onPress={() => { setPlaceInput(""); setDraft((d) => ({ ...d, place: "" })); setShowSuggestions(false); }}>
                  <Feather name="x" size={16} color={colors.TEXT_TERTIARY} />
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
              <View style={[styles.chipRow, { marginTop: 8 }]}>
                <LinearGradient colors={[PINK, ORANGE]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.chipSelected}>
                  <Text style={styles.chipTextSelected}>{draft.place}</Text>
                </LinearGradient>
              </View>
            )}

            {/* Keywords */}
            <Text style={[styles.sheetSectionLabel, { marginTop: 24 }]}>Keywords</Text>
            <View style={styles.filterInputWrapper}>
              <Feather name="tag" size={16} color={colors.TEXT_TERTIARY} style={styles.filterInputIcon} />
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
      </View>
    </Modal>
  );
}

// ─── Experience Card ──────────────────────────────────────────────────────────
function ExperienceCard({
  item,
  index,
  onPress,
  colors,
  router,
}: {
  item: DemoExperience;
  index: number;
  onPress: () => void;
  colors: Colors;
  router: ReturnType<typeof useRouter>;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const styles = getStyles(colors);

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

  const handleLocationPress = () => {
    console.log("User tapped location on card (iOS):", item.location, "location_id:", (item as any).location_id);
    const locationId = (item as any).location_id;
    if (locationId) {
      router.push(`/location/${locationId}` as any);
    } else {
      router.push(`/search-location?q=${encodeURIComponent(item.location)}` as any);
    }
  };

  const handleCreatorPress = () => {
    console.log("User tapped creator on explore card (iOS):", item.creator);
    router.push(("/user/" + item.id) as any);
  };

  const durationText = formatDuration(item.duration);
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
        <View style={styles.card}>
          {/* Thumbnail */}
          <View style={styles.thumbContainer}>
            <Image source={thumbSource} style={styles.thumb} resizeMode="cover" />
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.45)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.thumbGradient}
            />
            <View style={styles.durationBadge}>
              <Feather name="clock" size={10} color="#FFF" />
              <Text style={styles.durationBadgeText}>{durationText}</Text>
            </View>
          </View>

          {/* Card info */}
          <View style={styles.cardInfo}>
            <View style={styles.cardInfoTop}>
              <TouchableOpacity activeOpacity={0.7} onPress={handleCreatorPress}>
                <Image source={avatarSource} style={styles.cardAvatar} />
              </TouchableOpacity>
              <View style={styles.cardTextBlock}>
                <TouchableOpacity activeOpacity={0.7} onPress={handleCreatorPress}>
                  <Text style={styles.cardCreator}>{item.creator}</Text>
                </TouchableOpacity>
                <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                <TouchableOpacity
                  style={styles.locationRow}
                  activeOpacity={0.7}
                  onPress={handleLocationPress}
                >
                  <Feather name="map-pin" size={11} color={PINK} />
                  <Text style={styles.locationText} numberOfLines={1}>{item.location}</Text>
                </TouchableOpacity>
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
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);
  const styles = getStyles(colors);

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      console.log("Explore search (iOS): debounced query updated to:", text);
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
        colors={colors}
        router={router}
        onPress={() => {
          console.log("User tapped experience card on explore screen (iOS):", item.id, item.title);
          router.push(`/experience/${item.id}` as any);
        }}
      />
    ),
    [router, colors]
  );

  const keyExtractor = useCallback((item: DemoExperience) => item.id, []);
  const headerPaddingTop = insets.top + 8;

  return (
    <View style={styles.container}>
      {/* Sticky header */}
      <View style={[styles.header, { paddingTop: headerPaddingTop }]}>
        <View style={styles.searchRow}>
          <View style={styles.searchInputWrapper}>
            <Feather name="search" size={17} color={colors.TEXT_TERTIARY} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search experiences..."
              placeholderTextColor={colors.TEXT_TERTIARY}
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
              console.log("User tapped filter button on explore screen (iOS)");
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
        colors={colors}
        onApply={(f) => {
          console.log("Explore (iOS): filters applied:", f);
          setFilters(f);
        }}
      />
    </View>
  );
}
