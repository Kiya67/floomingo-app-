
import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
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
import { useRouter, useFocusEffect } from "expo-router";
import { Film } from "lucide-react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useVideoPlayer, VideoView } from "expo-video";
import { apiGet } from "@/utils/api";
import { LinearGradient } from "expo-linear-gradient";
import { IconSymbol } from "@/components/IconSymbol";

const PINK = "#FF0080";
const ORANGE = "#FF6B00";
const BG = "#0a0a0a";
const CARD_BG = "#1a1a1a";
const SHEET_BG = "#1a1a1a";

const { width } = Dimensions.get("window");
const VIDEO_ASPECT = 9 / 16;
const VIDEO_HEIGHT = width * VIDEO_ASPECT;
const GRADIENT_WIDTH = 4;

const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 60 };

const SORT_OPTIONS = ["Newest", "Most Viewed"] as const;
type SortOption = (typeof SORT_OPTIONS)[number];

const DURATION_OPTIONS = [
  "Any",
  "Under 10 min",
  "10–30 min",
  "30 min–1 hr",
  "1 hr+",
] as const;
type DurationOption = (typeof DURATION_OPTIONS)[number];

interface FilterState {
  sort: SortOption;
  location: string;
  duration: DurationOption;
}

const DEFAULT_FILTERS: FilterState = {
  sort: "Newest",
  location: "",
  duration: "Any",
};

function isFilterActive(f: FilterState): boolean {
  return f.sort !== "Newest" || f.location.trim() !== "" || f.duration !== "Any";
}

function resolveImageSource(
  source: string | number | ImageSourcePropType | undefined
): ImageSourcePropType {
  if (!source) return { uri: "" };
  if (typeof source === "string") return { uri: source };
  return source as ImageSourcePropType;
}

interface ExperiencePlace {
  id: string;
  place_id: string;
  place_name: string;
}

interface Experience {
  id: string;
  user_id: string;
  video_url: string;
  thumbnail_url?: string;
  title: string;
  description?: string;
  places: ExperiencePlace[];
  user: {
    id: string;
    username: string;
    display_name?: string;
    avatar_url?: string;
  };
  created_at: string;
  view_count?: number;
  duration?: number;
}

// ─── Filter Bottom Sheet ──────────────────────────────────────────────────────

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

  useEffect(() => {
    if (visible) setDraft(filters);
  }, [visible, filters]);

  const handleApply = () => {
    console.log("User tapped Apply Filters on explore filter sheet (iOS):", draft);
    onApply(draft);
    onClose();
  };

  const handleReset = () => {
    console.log("User tapped Reset on explore filter sheet (iOS)");
    setDraft(DEFAULT_FILTERS);
    onApply(DEFAULT_FILTERS);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior="padding"
        style={styles.sheetOverlay}
      >
        <Pressable style={styles.sheetBackdrop} onPress={onClose} />
        <View style={styles.sheetContainer}>
          {/* Handle */}
          <View style={styles.sheetHandle} />

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sheetContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Sort by */}
            <Text style={styles.sheetSectionLabel}>Sort by</Text>
            <View style={styles.radioGroup}>
              {SORT_OPTIONS.map((opt) => {
                const isSelected = draft.sort === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    style={[
                      styles.radioOption,
                      isSelected && styles.radioOptionSelected,
                    ]}
                    onPress={() => {
                      console.log("User selected sort option (iOS):", opt);
                      setDraft((d) => ({ ...d, sort: opt }));
                    }}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.radioCircle,
                        isSelected && styles.radioCircleSelected,
                      ]}
                    >
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                    <Text
                      style={[
                        styles.radioLabel,
                        isSelected && styles.radioLabelSelected,
                      ]}
                    >
                      {opt}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Location */}
            <Text style={[styles.sheetSectionLabel, { marginTop: 24 }]}>
              Location
            </Text>
            <View style={styles.sheetInputRow}>
              <Ionicons
                name="location-outline"
                size={18}
                color="rgba(255,255,255,0.4)"
                style={{ marginRight: 8 }}
              />
              <TextInput
                style={styles.sheetInput}
                placeholder="Filter by location..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={draft.location}
                onChangeText={(t) => setDraft((d) => ({ ...d, location: t }))}
                autoCapitalize="words"
              />
              {draft.location.length > 0 && (
                <TouchableOpacity
                  onPress={() => setDraft((d) => ({ ...d, location: "" }))}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name="close-circle"
                    size={18}
                    color="rgba(255,255,255,0.3)"
                  />
                </TouchableOpacity>
              )}
            </View>

            {/* Duration */}
            <Text style={[styles.sheetSectionLabel, { marginTop: 24 }]}>
              Duration
            </Text>
            <View style={styles.durationGroup}>
              {DURATION_OPTIONS.map((opt) => {
                const isSelected = draft.duration === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => {
                      console.log("User selected duration option (iOS):", opt);
                      setDraft((d) => ({ ...d, duration: opt }));
                    }}
                    activeOpacity={0.7}
                  >
                    {isSelected ? (
                      <LinearGradient
                        colors={[PINK, ORANGE]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.durationChipSelected}
                      >
                        <Text style={styles.durationChipTextSelected}>
                          {opt}
                        </Text>
                      </LinearGradient>
                    ) : (
                      <View style={styles.durationChip}>
                        <Text style={styles.durationChipText}>{opt}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.sheetFooter}>
            <TouchableOpacity
              style={styles.resetBtn}
              onPress={handleReset}
              activeOpacity={0.7}
            >
              <Text style={styles.resetBtnText}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.applyBtnWrapper}
              onPress={handleApply}
              activeOpacity={0.85}
            >
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

// ─── VideoCard ────────────────────────────────────────────────────────────────

function VideoCard({
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
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const overlayIconRef = useRef<"play" | "pause">("play");
  const fadeOutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showOverlay = (icon: "play" | "pause") => {
    overlayIconRef.current = icon;
    if (fadeOutTimerRef.current) clearTimeout(fadeOutTimerRef.current);
    overlayOpacity.setValue(1);
    fadeOutTimerRef.current = setTimeout(() => {
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }, 800);
  };

  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop = true;
  });

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (fadeOutTimerRef.current) clearTimeout(fadeOutTimerRef.current);
      try {
        if (player && player.playing) player.pause();
      } catch {}
    };
  }, [player]);

  useEffect(() => {
    if (!player) return;
    if (isActive) {
      console.log("Explore feed (iOS): experience video active, playing:", postId);
      const t = setTimeout(() => {
        if (isMountedRef.current) {
          try {
            player.play();
            setIsPlaying(true);
            onPlayingChange(true);
          } catch (e) {
            console.error("Explore feed (iOS): error playing experience video:", e);
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
    console.log(
      "User tapped experience video to toggle play/pause (explore iOS), id:",
      postId
    );
    if (!player) return;
    try {
      if (isPlaying) {
        player.pause();
        setIsPlaying(false);
        onPlayingChange(false);
        showOverlay("pause");
      } else {
        player.play();
        setIsPlaying(true);
        onPlayingChange(true);
        showOverlay("play");
      }
    } catch (e) {
      console.error("Explore feed (iOS): error toggling play/pause:", e);
    }
  }, [player, isPlaying, onPlayingChange, postId]);

  useEffect(() => {
    onTogglePlayPause(toggle);
  }, [toggle]);

  if (!videoUrl) return null;

  const overlayIcon = overlayIconRef.current === "pause" ? "⏸" : "▶";

  return (
    <TouchableOpacity
      style={styles.videoContainer}
      activeOpacity={1}
      onPress={toggle}
    >
      <VideoView
        style={styles.video}
        player={player}
        nativeControls={false}
        contentFit="cover"
        allowsFullscreen={false}
        allowsPictureInPicture={false}
      />
      <LinearGradient
        colors={[PINK, ORANGE]}
        style={styles.gradientLeft}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        pointerEvents="none"
      />
      <LinearGradient
        colors={[PINK, ORANGE]}
        style={styles.gradientRight}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        pointerEvents="none"
      />
      <Animated.View
        style={[styles.playPauseOverlay, { opacity: overlayOpacity }]}
        pointerEvents="none"
      >
        <View style={styles.playPauseIconCircle}>
          <Text style={styles.playPauseIconText}>{overlayIcon}</Text>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ExploreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [feed, setFeed] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [playingMap, setPlayingMap] = useState<Map<string, boolean>>(new Map());
  const toggleFnMap = useRef<Map<string, () => void>>(new Map());
  const flatListRef = useRef<FlatList>(null);

  // ── Search & Filter state ──
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
    }, 400);
  };

  // ── Derived filtered list ──
  const filteredFeed = React.useMemo(() => {
    let result = [...feed];

    const q = debouncedQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((exp) => {
        const titleMatch = (exp.title || "").toLowerCase().includes(q);
        const descMatch = (exp.description || "").toLowerCase().includes(q);
        const locMatch = (exp.places || []).some((p) =>
          (p.place_name || "").toLowerCase().includes(q)
        );
        return titleMatch || descMatch || locMatch;
      });
    }

    const locQ = filters.location.trim().toLowerCase();
    if (locQ) {
      result = result.filter((exp) =>
        (exp.places || []).some((p) =>
          (p.place_name || "").toLowerCase().includes(locQ)
        )
      );
    }

    if (filters.duration !== "Any") {
      result = result.filter((exp) => {
        const dur = Number(exp.duration ?? 0);
        if (filters.duration === "Under 10 min") return dur < 600;
        if (filters.duration === "10–30 min") return dur >= 600 && dur < 1800;
        if (filters.duration === "30 min–1 hr") return dur >= 1800 && dur < 3600;
        if (filters.duration === "1 hr+") return dur >= 3600;
        return true;
      });
    }

    if (filters.sort === "Most Viewed") {
      result = result.sort(
        (a, b) => Number(b.view_count ?? 0) - Number(a.view_count ?? 0)
      );
    } else {
      result = result.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }

    return result;
  }, [feed, debouncedQuery, filters]);

  const filterActive = isFilterActive(filters);

  // ── Fetch experiences ──
  const fetchExperiences = useCallback(
    async (isRefresh = false, cursor: string | null = null) => {
      console.log(
        "Explore feed (iOS): fetching experiences from /api/experiences, isRefresh:",
        isRefresh,
        "cursor:",
        cursor
      );
      try {
        const params = new URLSearchParams({ limit: "20" });
        if (cursor) params.set("cursor", cursor);
        const url = `/api/experiences?${params.toString()}`;
        console.log("Explore feed (iOS): GET", url);
        const data = await apiGet<any>(url);

        const items: Experience[] = (
          Array.isArray(data) ? data : data?.experiences ?? data?.items ?? []
        ).map((e: any) => ({
          id: e.id,
          user_id: e.user_id,
          video_url: e.video_url || "",
          thumbnail_url: e.thumbnail_url,
          title: e.title || "Untitled Experience",
          description: e.description,
          created_at: e.created_at,
          view_count: e.view_count ?? 0,
          duration: e.duration ?? 0,
          places: Array.isArray(e.places)
            ? e.places
            : e.place_id
            ? [{ id: e.id, place_id: e.place_id, place_name: e.place_name }]
            : [],
          user: e.user
            ? {
                id: e.user.id,
                username: e.user.username || "",
                display_name: e.user.display_name,
                avatar_url: e.user.avatar_url,
              }
            : e.profiles
            ? {
                id: e.profiles.id,
                username: e.profiles.username || "",
                display_name: e.profiles.display_name,
                avatar_url: e.profiles.avatar_url,
              }
            : {
                id: e.user_id,
                username: "",
                display_name: null,
                avatar_url: null,
              },
        }));

        console.log("Explore feed (iOS): fetched", items.length, "experiences");

        const newNextCursor =
          items.length === 20 ? items[items.length - 1].created_at : null;

        if (isRefresh || !cursor) {
          setFeed(items);
          setCurrentIndex(0);
        } else {
          setFeed((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            return [...prev, ...items.filter((m) => !existingIds.has(m.id))];
          });
        }

        setNextCursor(newNextCursor);
        setHasMore(!!newNextCursor);
        setError(null);
      } catch (e: any) {
        console.error("Explore feed (iOS): fetch experiences error:", e);
        setError("Couldn't load experiences. Check your connection.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      console.log("ExploreScreen (iOS) focused - loading experiences feed");
      setLoading(true);
      setNextCursor(null);
      setHasMore(true);
      fetchExperiences(false, null);
    }, [fetchExperiences])
  );

  const wasPlayingOnBlurRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (wasPlayingOnBlurRef.current) {
        console.log(
          "ExploreScreen (iOS) regained focus - resuming active experience video"
        );
        const exp = feed[currentIndex];
        if (exp) {
          const toggleFn = toggleFnMap.current.get(exp.id);
          const isCurrentlyPlaying = playingMap.get(exp.id);
          if (toggleFn && !isCurrentlyPlaying) toggleFn();
        }
        wasPlayingOnBlurRef.current = false;
      }
      return () => {
        const exp = feed[currentIndex];
        if (exp) {
          const isCurrentlyPlaying = playingMap.get(exp.id);
          if (isCurrentlyPlaying) {
            console.log(
              "ExploreScreen (iOS) lost focus - pausing experience video:",
              exp.id
            );
            wasPlayingOnBlurRef.current = true;
            const toggleFn = toggleFnMap.current.get(exp.id);
            if (toggleFn) toggleFn();
          }
        }
      };
    }, [feed, currentIndex, playingMap])
  );

  const viewableItemsHandlerRef = useRef<
    (info: { viewableItems: any[] }) => void
  >(() => {});

  useEffect(() => {
    viewableItemsHandlerRef.current = ({ viewableItems }: any) => {
      if (viewableItems.length > 0) {
        const newIndex = viewableItems[0].index;
        console.log(
          "Explore feed (iOS): visible experience index changed to:",
          newIndex
        );
        setCurrentIndex(newIndex);
      }
    };
  }, [feed]);

  const handleViewableItemsChanged = useRef((info: any) => {
    viewableItemsHandlerRef.current(info);
  }).current;

  const getInitials = (name: string) => {
    if (!name) return "??";
    const parts = name.split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const renderItem = useCallback(
    ({ item: exp, index }: { item: Experience; index: number }) => {
      if (!exp?.video_url) return null;

      const isActive = index === currentIndex;
      const displayName =
        exp.user?.display_name || exp.user?.username || "Unknown";
      const avatarUrl = exp.user?.avatar_url || "";
      const initials = getInitials(displayName);
      const placeName = exp.places?.[0]?.place_name || "";
      const placeId = exp.places?.[0]?.place_id || "";
      const viewCountText = String(exp.view_count ?? 0);

      return (
        <View style={styles.card}>
          <VideoCard
            videoUrl={exp.video_url}
            postId={exp.id}
            isActive={isActive}
            onPlayingChange={(playing) => {
              setPlayingMap((prev) => {
                const m = new Map(prev);
                m.set(exp.id, playing);
                return m;
              });
            }}
            onTogglePlayPause={(fn) => {
              toggleFnMap.current.set(exp.id, fn);
            }}
          />

          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {exp.title}
            </Text>

            <TouchableOpacity
              style={styles.userRow}
              onPress={() => {
                console.log(
                  "User tapped profile on explore experience card (iOS), navigating to:",
                  exp.user_id
                );
                router.push(`/user/${exp.user_id}` as any);
              }}
              activeOpacity={0.7}
            >
              {avatarUrl ? (
                <Image
                  source={resolveImageSource(avatarUrl)}
                  style={styles.avatar}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitials}>{initials}</Text>
                </View>
              )}
              <Text style={styles.displayName} numberOfLines={1}>
                {displayName}
              </Text>
            </TouchableOpacity>

            <View style={styles.metaRow}>
              {placeName ? (
                <TouchableOpacity
                  style={styles.locationChip}
                  onPress={() => {
                    console.log(
                      "User tapped location chip on explore experience card (iOS):",
                      placeName
                    );
                    if (placeId) router.push(`/location/${placeId}` as any);
                  }}
                  activeOpacity={0.7}
                >
                  <IconSymbol
                    ios_icon_name="mappin"
                    android_material_icon_name="location-on"
                    size={13}
                    color={PINK}
                  />
                  <Text style={styles.locationText} numberOfLines={1}>
                    {placeName}
                  </Text>
                </TouchableOpacity>
              ) : null}
              <View style={styles.viewsChip}>
                <IconSymbol
                  ios_icon_name="eye"
                  android_material_icon_name="visibility"
                  size={13}
                  color="rgba(255,255,255,0.5)"
                />
                <Text style={styles.viewsText}>{viewCountText}</Text>
              </View>
            </View>
          </View>
        </View>
      );
    },
    [currentIndex, router]
  );

  const keyExtractor = useCallback((item: Experience) => item.id, []);

  // ── Search bar + filter header ──
  const SearchHeader = (
    <View style={styles.searchRow}>
      <View style={styles.searchInputWrapper}>
        <Ionicons
          name="search"
          size={18}
          color="rgba(255,255,255,0.4)"
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Search experiences..."
          placeholderTextColor="rgba(255,255,255,0.3)"
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
        <LinearGradient
          colors={[PINK, ORANGE]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.filterBtn}
        >
          <Ionicons name="options-outline" size={20} color="#FFF" />
        </LinearGradient>
        {filterActive && <View style={styles.filterBadge} />}
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color={PINK} />
        <Text style={styles.loadingText}>Loading experiences…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" />
        <Film size={48} color="rgba(255,255,255,0.3)" strokeWidth={1.5} />
        <Text style={styles.emptyTitle}>Couldn't load experiences</Text>
        <Text style={styles.emptySubtitle}>{error}</Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => {
            console.log("User tapped retry on explore experiences feed (iOS)");
            setLoading(true);
            fetchExperiences(false, null);
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.retryBtnText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (feed.length === 0) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" />
        <Film size={48} color="rgba(255,255,255,0.3)" strokeWidth={1.5} />
        <Text style={styles.emptyTitle}>No experiences yet</Text>
        <Text style={styles.emptySubtitle}>
          Be the first to share an experience on Floomingo
        </Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => {
            console.log(
              "User tapped refresh on empty explore experiences feed (iOS)"
            );
            setLoading(true);
            fetchExperiences(false, null);
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.retryBtnText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Fixed header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.headerTitle}>Explore</Text>
        {SearchHeader}
      </View>

      <FlatList
        ref={flatListRef}
        data={filteredFeed}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 80 },
        ]}
        onViewableItemsChanged={handleViewableItemsChanged}
        viewabilityConfig={VIEWABILITY_CONFIG}
        onEndReached={() => {
          if (!loadingMore && hasMore && nextCursor) {
            setLoadingMore(true);
            console.log("Explore feed (iOS): loading more experiences");
            fetchExperiences(false, nextCursor);
          }
        }}
        onEndReachedThreshold={0.5}
        removeClippedSubviews
        maxToRenderPerBatch={4}
        windowSize={7}
        ListEmptyComponent={
          <View style={styles.emptyFiltered}>
            <Ionicons
              name="search-outline"
              size={40}
              color="rgba(255,255,255,0.2)"
            />
            <Text style={styles.emptyFilteredText}>No results found</Text>
            <Text style={styles.emptyFilteredSub}>
              Try a different search or adjust your filters
            </Text>
          </View>
        }
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator color={PINK} style={{ marginVertical: 20 }} />
          ) : null
        }
      />

      <FilterSheet
        visible={filterSheetVisible}
        onClose={() => setFilterSheetVisible(false)}
        filters={filters}
        onApply={(f) => {
          console.log("Explore (iOS): filters applied:", f);
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
  center: {
    flex: 1,
    backgroundColor: BG,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: BG,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.3,
    marginBottom: 12,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: CARD_BG,
    borderRadius: 24,
    paddingHorizontal: 14,
    height: 44,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#FFFFFF",
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
    top: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FF0080",
    borderWidth: 2,
    borderColor: BG,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFF",
    marginTop: 16,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
    marginTop: 8,
    textAlign: "center",
    lineHeight: 20,
  },
  retryBtn: {
    marginTop: 20,
    backgroundColor: PINK,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFF",
  },
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 4,
    gap: 16,
  },
  emptyFiltered: {
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyFilteredText: {
    fontSize: 17,
    fontWeight: "600",
    color: "rgba(255,255,255,0.6)",
    marginTop: 8,
  },
  emptyFilteredSub: {
    fontSize: 14,
    color: "rgba(255,255,255,0.35)",
    textAlign: "center",
    lineHeight: 20,
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  videoContainer: {
    width: "100%",
    height: VIDEO_HEIGHT,
    backgroundColor: "#000",
    overflow: "hidden",
  },
  video: {
    ...StyleSheet.absoluteFillObject,
  },
  gradientLeft: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: GRADIENT_WIDTH,
  },
  gradientRight: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: GRADIENT_WIDTH,
  },
  playPauseOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  playPauseIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  playPauseIconText: {
    fontSize: 26,
    color: "#FFFFFF",
  },
  cardInfo: {
    padding: 14,
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    lineHeight: 22,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  avatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: PINK,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitials: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFF",
  },
  displayName: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.75)",
    flex: 1,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  locationChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    flex: 1,
  },
  locationText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.55)",
    fontWeight: "500",
    flex: 1,
  },
  viewsChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  viewsText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
    fontWeight: "500",
  },
  // ── Filter Sheet ──
  sheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheetContainer: {
    backgroundColor: SHEET_BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "80%",
    paddingBottom: 8,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#444",
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
    fontSize: 13,
    fontWeight: "700",
    color: "rgba(255,255,255,0.5)",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  radioGroup: {
    gap: 10,
  },
  radioOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  radioOptionSelected: {
    borderColor: "rgba(255,0,128,0.4)",
    backgroundColor: "rgba(255,0,128,0.08)",
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  radioCircleSelected: {
    borderColor: PINK,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: PINK,
  },
  radioLabel: {
    fontSize: 15,
    fontWeight: "500",
    color: "rgba(255,255,255,0.7)",
  },
  radioLabelSelected: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  sheetInputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  sheetInput: {
    flex: 1,
    fontSize: 15,
    color: "#FFFFFF",
    paddingVertical: 0,
  },
  durationGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  durationChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  durationChipSelected: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  durationChipText: {
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(255,255,255,0.6)",
  },
  durationChipTextSelected: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  sheetFooter: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.07)",
  },
  resetBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  resetBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "rgba(255,255,255,0.7)",
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
    color: "#FFFFFF",
  },
});
