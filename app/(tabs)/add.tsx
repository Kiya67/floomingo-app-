
import React, { useState, useEffect, useRef, useCallback } from "react";
import { IconSymbol } from "@/components/IconSymbol";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import { colors } from "@/styles/commonStyles";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as VideoThumbnails from "expo-video-thumbnails";
import { supabase } from "@/lib/supabase";
import { uploadFileToSupabase } from "@/utils/supabaseHelpers";
import { useVideoPlayer, VideoView } from "expo-video";
import { authenticatedPost, BACKEND_URL } from "@/utils/api";
import BottomSheet, {
  BottomSheetView,
  BottomSheetBackdrop,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import Constants from "expo-constants";

type UploadType = "moment" | "experience";

interface SelectedLocation {
  place_id: string;
  main_text: string;
  location_type: string;
}

interface Prediction {
  place_id: string;
  main_text: string;
  secondary_text?: string;
  description: string;
  location_type: string;
}

type SearchMode = "any" | "city" | "place" | "country" | "region" | "address" | "airport";

const SEARCH_MODE_OPTIONS: { value: SearchMode; label: string }[] = [
  { value: "any", label: "All (recommended)" },
  { value: "city", label: "Cities" },
  { value: "place", label: "Places (businesses/landmarks)" },
  { value: "country", label: "Countries" },
  { value: "region", label: "Regions/States" },
  { value: "address", label: "Addresses" },
  { value: "airport", label: "Airports" },
];

const ACCENT = "#FF4D6D";

export default function AddScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const bgColor = isDark ? colors.backgroundDark : colors.background;
  const textColor = isDark ? colors.textDark : colors.text;
  const textSecondaryColor = isDark ? colors.textSecondaryDark : colors.textSecondary;
  const cardColor = isDark ? colors.cardDark : colors.card;
  const primaryColor = isDark ? colors.primaryDark : colors.primary;

  // --- Type toggle ---
  const [uploadType, setUploadType] = useState<UploadType>("moment");

  // --- Form state ---
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  // Experience fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedLocations, setSelectedLocations] = useState<SelectedLocation[]>([]);
  const [isPosting, setIsPosting] = useState(false);

  // --- Location sheet state ---
  const bottomSheetRef = useRef<BottomSheet>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("any");
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showModeDropdown, setShowModeDropdown] = useState(false);

  const snapPoints = ["75%", "95%"];

  const player = useVideoPlayer(videoUri || "", (p) => {
    p.loop = true;
    p.muted = true;
  });

  useEffect(() => {
    console.log("AddScreen mounted");
    return () => console.log("AddScreen unmounted");
  }, []);

  const resetForm = () => {
    setVideoUri(null);
    setCaption("");
    setTitle("");
    setDescription("");
    setSelectedLocations([]);
  };

  const handleTypeSwitch = (type: UploadType) => {
    if (type === uploadType) return;
    console.log("User switched upload type to:", type);
    setUploadType(type);
    resetForm();
  };

  // --- Location search ---
  const searchLocations = useCallback(async (input: string, mode: SearchMode) => {
    if (!input.trim()) {
      setPredictions([]);
      setSearchError(null);
      return;
    }
    setSearchLoading(true);
    setSearchError(null);
    console.log("[LocationSheet] Searching locations:", input, "mode:", mode);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl;
      const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey;

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error("Supabase configuration missing");
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        apikey: supabaseAnonKey,
      };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const body = { input: input.trim(), mode };
      console.log("[LocationSheet] API request to places_autocomplete, body:", body);

      const response = await fetch(`${supabaseUrl}/functions/v1/places_autocomplete`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      console.log("[LocationSheet] API response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[LocationSheet] API error:", errorText);
        throw new Error(`API returned ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log("[LocationSheet] API response data:", data);

      if (data.error) {
        setSearchError(data.error);
        setPredictions([]);
      } else if (data.predictions && Array.isArray(data.predictions)) {
        console.log("[LocationSheet] Found", data.predictions.length, "predictions");
        setPredictions(data.predictions);
        if (data.predictions.length === 0) {
          setSearchError("No locations found. Try a different search term.");
        }
      } else {
        setPredictions([]);
        setSearchError("Unexpected response format from location service");
      }
    } catch (err: any) {
      console.error("[LocationSheet] Error searching locations:", err);
      setSearchError(err.message || "Failed to search locations. Please try again.");
      setPredictions([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchText.trim()) {
        searchLocations(searchText, searchMode);
      } else {
        setPredictions([]);
        setSearchLoading(false);
        setSearchError(null);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchText, searchMode, searchLocations]);

  const openLocationSheet = () => {
    console.log("User tapped Add Location — opening bottom sheet");
    setSearchText("");
    setPredictions([]);
    setSearchError(null);
    setShowModeDropdown(false);
    setSheetOpen(true);
    bottomSheetRef.current?.expand();
  };

  const closeLocationSheet = () => {
    console.log("User closed location sheet");
    Keyboard.dismiss();
    bottomSheetRef.current?.close();
  };

  const handleSelectLocation = (prediction: Prediction) => {
    const newLocation: SelectedLocation = {
      place_id: prediction.place_id,
      main_text: prediction.main_text || prediction.description,
      location_type: prediction.location_type,
    };
    console.log("User selected location from sheet:", newLocation);

    setSelectedLocations((prev) => {
      const alreadyExists = prev.some((loc) => loc.place_id === newLocation.place_id);
      if (alreadyExists) {
        console.log("Location already in list, skipping duplicate");
        return prev;
      }
      const next = [...prev, newLocation];
      console.log("Location added. Total locations:", next.length);
      return next;
    });

    closeLocationSheet();
  };

  const handleRemoveLocation = (placeId: string) => {
    console.log("User tapped remove location chip:", placeId);
    setSelectedLocations((prev) => prev.filter((loc) => loc.place_id !== placeId));
  };

  // --- Video ---
  const pickVideo = async () => {
    console.log("User tapped Pick Video button");
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permissionResult.granted === false) {
        console.log("Media library permission denied");
        Alert.alert("Permission Required", "Permission to access media library is required!");
        return;
      }
      console.log("Launching image library picker for videos");
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["videos"],
        quality: 1,
        videoMaxDuration: 120,
      });
      console.log("Image picker result:", { canceled: result.canceled, assetsCount: result.assets?.length });
      if (!result.canceled && result.assets && result.assets[0]) {
        console.log("Video selected successfully:", result.assets[0].uri);
        setVideoUri(result.assets[0].uri);
      } else {
        console.log("Video selection was canceled or no assets returned");
      }
    } catch (error) {
      console.error("Error picking video:", error);
      Alert.alert("Error", "Failed to pick video. Please try again.");
    }
  };

  // --- Upload helpers ---
  const uploadVideoAndThumbnail = async (userId: string) => {
    const timestamp = Date.now();
    const videoPath = `videos/${userId}/${timestamp}.mp4`;
    const thumbPath = `thumbs/${userId}/${timestamp}.jpg`;

    console.log("Step 1: Uploading video to Supabase Storage, uri:", videoUri);
    let videoPublicUrl: string;
    try {
      const videoUploadResult = await uploadFileToSupabase(videoUri!, videoPath, "video_public", "video/mp4");
      videoPublicUrl = videoUploadResult.publicUrl;
      console.log("✅ Step 1 complete — video uploaded:", videoPublicUrl);
    } catch (uploadErr: any) {
      console.error("❌ Step 1 FAILED — video upload error:", uploadErr, JSON.stringify(uploadErr));
      throw new Error(`Video upload failed: ${uploadErr?.message || String(uploadErr)}`);
    }

    console.log("Step 2: Generating thumbnail from video uri:", videoUri);
    let thumbnailPublicUrl: string | null = null;
    try {
      const thumbResult = await VideoThumbnails.getThumbnailAsync(videoUri!, { time: 0 });
      console.log("Thumbnail generated at:", thumbResult.uri);
      console.log("Step 3: Uploading thumbnail to Supabase Storage");
      const thumbnailUploadResult = await uploadFileToSupabase(thumbResult.uri, thumbPath, "video_public", "image/jpeg");
      thumbnailPublicUrl = thumbnailUploadResult.publicUrl;
      console.log("✅ Step 3 complete — thumbnail uploaded:", thumbnailPublicUrl);
    } catch (thumbErr: any) {
      console.warn("⚠️ Thumbnail generation/upload failed (continuing without thumbnail):", thumbErr);
      thumbnailPublicUrl = null;
    }

    return { videoPublicUrl, thumbnailPublicUrl };
  };

  // --- Post Moment ---
  const handlePostMoment = async () => {
    console.log("User tapped Share button — Moment", {
      hasVideo: !!videoUri,
      captionLength: caption.length,
      locationsCount: selectedLocations.length,
    });

    if (!videoUri) {
      Alert.alert("No Video", "Please select a video first.");
      return;
    }

    setIsPosting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error("No authenticated user found");
        Alert.alert("Error", "You must be logged in to post");
        return;
      }
      console.log("Authenticated user ID:", user.id);

      const { videoPublicUrl, thumbnailPublicUrl } = await uploadVideoAndThumbnail(user.id);

      console.log("Step 4: Creating moment (post) via backend API");
      const firstLocation = selectedLocations[0] || null;
      const locationsPayload = selectedLocations.map((loc) => ({
        place_id: loc.place_id,
        place_name: loc.main_text,
        location_type: loc.location_type,
      }));

      const postPayload: any = {
        caption: caption.trim() || "",
        video_url: videoPublicUrl,
        thumbnail_url: thumbnailPublicUrl,
      };

      if (firstLocation) {
        postPayload.place_id = firstLocation.place_id;
        postPayload.place_name = firstLocation.main_text;
        postPayload.location_type = firstLocation.location_type;
      }
      if (locationsPayload.length > 0) {
        postPayload.locations = locationsPayload;
      }

      console.log("[API] POST /api/posts — full payload:", JSON.stringify(postPayload, null, 2));
      console.log("[API] POST endpoint URL:", `${BACKEND_URL}/api/posts`);

      let createdPost: any;
      try {
        createdPost = await authenticatedPost("/api/posts", postPayload);
        console.log("[API] POST /api/posts — response status: 2xx OK");
        console.log("[API] POST /api/posts — response body:", JSON.stringify(createdPost, null, 2));
      } catch (apiErr: any) {
        console.error("❌ Step 4 FAILED — API error:", apiErr?.message || String(apiErr));
        const rawMsg: string = apiErr?.message || String(apiErr);
        const isHtml = rawMsg.includes("<html") || rawMsg.includes("<!DOCTYPE");
        const cleanMsg = isHtml
          ? `Server error (${rawMsg.match(/API error: (\d+)/)?.[1] || "unknown status"}) — please try again`
          : rawMsg;
        throw new Error(cleanMsg);
      }

      if (!createdPost || !createdPost.id) {
        console.error("❌ API returned unexpected response:", JSON.stringify(createdPost));
        throw new Error("Failed to create post via API — no post ID returned");
      }

      console.log("✅ Moment created successfully, post ID:", createdPost.id);
      Alert.alert("Posted!", "Your moment has been posted successfully");
      resetForm();
      console.log("Navigating to Home tab");
      router.replace("/(tabs)/(home)");
    } catch (error: any) {
      console.error("❌ handlePostMoment FAILED:", error, JSON.stringify(error));
      Alert.alert("Post Failed", error?.message || "Failed to post video. Please try again.");
    } finally {
      setIsPosting(false);
    }
  };

  // --- Post Experience ---
  const handlePostExperience = async () => {
    console.log("User tapped Share button — Experience", {
      hasVideo: !!videoUri,
      titleLength: title.length,
      descriptionLength: description.length,
      locationsCount: selectedLocations.length,
    });

    if (!videoUri) {
      Alert.alert("No Video", "Please select a video first.");
      return;
    }
    if (!title.trim()) {
      Alert.alert("Title Required", "Please add a title for your experience.");
      return;
    }

    setIsPosting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error("No authenticated user found");
        Alert.alert("Error", "You must be logged in to post");
        return;
      }
      console.log("Authenticated user ID:", user.id);

      const { videoPublicUrl, thumbnailPublicUrl } = await uploadVideoAndThumbnail(user.id);

      console.log("Step 4: Creating experience via backend API");

      const experiencePayload: any = {
        title: title.trim(),
        description: description.trim() || undefined,
        video_url: videoPublicUrl,
        thumbnail_url: thumbnailPublicUrl,
      };

      console.log("[API] POST /api/experiences — full payload:", JSON.stringify(experiencePayload, null, 2));
      console.log("[API] POST endpoint URL:", `${BACKEND_URL}/api/experiences`);

      let createdExperience: any;
      try {
        createdExperience = await authenticatedPost("/api/experiences", experiencePayload);
        console.log("[API] POST /api/experiences — response status: 2xx OK");
        console.log("[API] POST /api/experiences — response body:", JSON.stringify(createdExperience, null, 2));
      } catch (apiErr: any) {
        console.error("❌ Step 4 FAILED — API error:", apiErr?.message || String(apiErr));
        const rawMsg: string = apiErr?.message || String(apiErr);
        const isHtml = rawMsg.includes("<html") || rawMsg.includes("<!DOCTYPE");
        const cleanMsg = isHtml
          ? `Server error (${rawMsg.match(/API error: (\d+)/)?.[1] || "unknown status"}) — please try again`
          : rawMsg;
        throw new Error(cleanMsg);
      }

      if (!createdExperience || !createdExperience.id) {
        console.error("❌ API returned unexpected response:", JSON.stringify(createdExperience));
        throw new Error("Failed to create experience via API — no ID returned");
      }

      console.log("✅ Experience created successfully, experience ID:", createdExperience.id);
      Alert.alert("Posted!", "Your experience has been posted successfully");
      resetForm();
      console.log("Navigating to Home tab");
      router.replace("/(tabs)/(home)");
    } catch (error: any) {
      console.error("❌ handlePostExperience FAILED:", error, JSON.stringify(error));
      Alert.alert("Post Failed", error?.message || "Failed to post experience. Please try again.");
    } finally {
      setIsPosting(false);
    }
  };

  const handlePost = () => {
    if (uploadType === "moment") {
      handlePostMoment();
    } else {
      handlePostExperience();
    }
  };

  const selectedModeLabel = SEARCH_MODE_OPTIONS.find((o) => o.value === searchMode)?.label || "All (recommended)";
  const locationButtonLabel = selectedLocations.length > 0 ? "Add another location" : "Add location (optional)";

  const isMoment = uploadType === "moment";
  const headerTitle = isMoment ? "New Moment" : "New Experience";
  const isPostEnabled = isMoment
    ? !!videoUri
    : !!videoUri && title.trim().length > 0;
  const postButtonBg = isPostEnabled ? primaryColor : "#999";

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]} edges={["top"]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: textColor }]}>{headerTitle}</Text>
      </View>

      {/* Type toggle */}
      <View style={styles.toggleContainer}>
        <View style={[styles.toggleTrack, { backgroundColor: isDark ? "#2A2A2A" : "#F0F0F0" }]}>
          <TouchableOpacity
            style={[styles.togglePill, isMoment && styles.togglePillActive]}
            onPress={() => handleTypeSwitch("moment")}
            activeOpacity={0.8}
          >
            <Text style={[styles.togglePillText, isMoment && styles.togglePillTextActive]}>Moment</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.togglePill, !isMoment && styles.togglePillActive]}
            onPress={() => handleTypeSwitch("experience")}
            activeOpacity={0.8}
          >
            <Text style={[styles.togglePillText, !isMoment && styles.togglePillTextActive]}>Experience</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Video picker */}
        {!videoUri ? (
          <View style={styles.videoPickerSection}>
            <TouchableOpacity
              style={[styles.videoPlaceholder, { backgroundColor: cardColor }]}
              onPress={pickVideo}
            >
              <IconSymbol
                ios_icon_name="video.fill"
                android_material_icon_name="videocam"
                size={64}
                color={primaryColor}
              />
              <Text style={[styles.placeholderText, { color: textColor }]}>Tap to select video</Text>
              <Text style={[styles.placeholderSubtext, { color: textSecondaryColor }]}>Up to 2 minutes</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.videoSelectedSection}>
            <View style={styles.videoPreviewContainer}>
              <VideoView player={player} style={styles.videoPreview} contentFit="cover" nativeControls={false} />
              <View style={styles.videoOverlay}>
                <View style={[styles.videoBadge, { backgroundColor: "rgba(0,0,0,0.7)" }]}>
                  <IconSymbol
                    ios_icon_name="checkmark.circle.fill"
                    android_material_icon_name="check-circle"
                    size={20}
                    color="#4ADE80"
                  />
                  <Text style={styles.videoBadgeText}>Video Ready</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity style={[styles.changeButton, { borderColor: primaryColor }]} onPress={pickVideo}>
              <IconSymbol ios_icon_name="pencil" android_material_icon_name="edit" size={20} color={primaryColor} />
              <Text style={[styles.changeButtonText, { color: primaryColor }]}>Change Video</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.formSection}>
          {isMoment ? (
            /* ---- MOMENT FIELDS ---- */
            <View style={styles.inputContainer}>
              <View style={styles.inputHeader}>
                <IconSymbol
                  ios_icon_name="doc.text"
                  android_material_icon_name="description"
                  size={20}
                  color={textColor}
                />
                <Text style={[styles.inputLabel, { color: textColor }]}>Caption</Text>
                <Text style={[styles.optionalLabel, { color: textSecondaryColor }]}>(optional)</Text>
              </View>
              <TextInput
                style={[
                  styles.captionInput,
                  { backgroundColor: cardColor, color: textColor, borderColor: isDark ? "#333" : "#E5E7EB" },
                ]}
                placeholder="Share your travel story..."
                placeholderTextColor={textSecondaryColor}
                value={caption}
                onChangeText={setCaption}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          ) : (
            /* ---- EXPERIENCE FIELDS ---- */
            <>
              <View style={styles.inputContainer}>
                <View style={styles.inputHeader}>
                  <IconSymbol
                    ios_icon_name="textformat"
                    android_material_icon_name="title"
                    size={20}
                    color={textColor}
                  />
                  <Text style={[styles.inputLabel, { color: textColor }]}>Title</Text>
                  <Text style={[styles.requiredLabel, { color: ACCENT }]}>(required)</Text>
                </View>
                <TextInput
                  style={[
                    styles.titleInput,
                    { backgroundColor: cardColor, color: textColor, borderColor: isDark ? "#333" : "#E5E7EB" },
                  ]}
                  placeholder="Give your experience a title..."
                  placeholderTextColor={textSecondaryColor}
                  value={title}
                  onChangeText={(t) => setTitle(t.slice(0, 120))}
                  maxLength={120}
                  returnKeyType="next"
                />
                <Text style={[styles.charCount, { color: textSecondaryColor }]}>
                  {title.length}
                  /120
                </Text>
              </View>

              <View style={styles.inputContainer}>
                <View style={styles.inputHeader}>
                  <IconSymbol
                    ios_icon_name="doc.text"
                    android_material_icon_name="description"
                    size={20}
                    color={textColor}
                  />
                  <Text style={[styles.inputLabel, { color: textColor }]}>Description</Text>
                  <Text style={[styles.optionalLabel, { color: textSecondaryColor }]}>(optional)</Text>
                </View>
                <TextInput
                  style={[
                    styles.captionInput,
                    { backgroundColor: cardColor, color: textColor, borderColor: isDark ? "#333" : "#E5E7EB" },
                  ]}
                  placeholder="Describe your experience..."
                  placeholderTextColor={textSecondaryColor}
                  value={description}
                  onChangeText={(t) => setDescription(t.slice(0, 2000))}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  maxLength={2000}
                />
                <Text style={[styles.charCount, { color: textSecondaryColor }]}>
                  {description.length}
                  /2000
                </Text>
              </View>
            </>
          )}

          {/* Locations (both modes) */}
          <View style={styles.inputContainer}>
            <View style={styles.inputHeader}>
              <IconSymbol
                ios_icon_name="location.fill"
                android_material_icon_name="location-on"
                size={20}
                color={textColor}
              />
              <Text style={[styles.inputLabel, { color: textColor }]}>Locations</Text>
              <Text style={[styles.optionalLabel, { color: textSecondaryColor }]}>(optional)</Text>
            </View>

            {selectedLocations.length > 0 && (
              <View style={styles.selectedLocationsContainer}>
                {selectedLocations.map((location) => (
                  <View
                    key={location.place_id}
                    style={[styles.locationChip, { backgroundColor: isDark ? "#333" : "#F3F4F6" }]}
                  >
                    <IconSymbol
                      ios_icon_name="mappin.circle.fill"
                      android_material_icon_name="location-on"
                      size={16}
                      color={primaryColor}
                    />
                    <Text style={[styles.locationChipText, { color: textColor }]} numberOfLines={1}>
                      {location.main_text}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleRemoveLocation(location.place_id)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <IconSymbol
                        ios_icon_name="xmark.circle.fill"
                        android_material_icon_name="cancel"
                        size={18}
                        color={textSecondaryColor}
                      />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.locationButton,
                { backgroundColor: cardColor, borderColor: isDark ? "#333" : "#E5E7EB" },
              ]}
              onPress={openLocationSheet}
            >
              <Text
                style={[
                  styles.locationButtonText,
                  { color: selectedLocations.length > 0 ? primaryColor : textSecondaryColor },
                ]}
              >
                {locationButtonLabel}
              </Text>
              <IconSymbol
                ios_icon_name="plus"
                android_material_icon_name="add"
                size={20}
                color={selectedLocations.length > 0 ? primaryColor : textSecondaryColor}
              />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.postButton, { backgroundColor: postButtonBg, opacity: isPosting ? 0.6 : 1 }]}
          onPress={handlePost}
          disabled={!isPostEnabled || isPosting}
        >
          {isPosting ? (
            <>
              <ActivityIndicator color="#FFFFFF" />
              <Text style={styles.postButtonText}>Sharing...</Text>
            </>
          ) : (
            <>
              <IconSymbol
                ios_icon_name="paperplane.fill"
                android_material_icon_name="send"
                size={24}
                color="#FFFFFF"
              />
              <Text style={styles.postButtonText}>Share</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Location picker bottom sheet */}
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        onClose={() => {
          setSheetOpen(false);
          setSearchText("");
          setPredictions([]);
          setSearchError(null);
          setShowModeDropdown(false);
        }}
        backdropComponent={(props) => (
          <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} pressBehavior="close" />
        )}
        backgroundStyle={{ backgroundColor: bgColor }}
        handleIndicatorStyle={{ backgroundColor: textSecondaryColor }}
      >
        <BottomSheetView style={[styles.sheetHeader, { borderBottomColor: isDark ? "#333" : "#E5E7EB" }]}>
          <Text style={[styles.sheetTitle, { color: textColor }]}>Add Location</Text>
          <TouchableOpacity onPress={closeLocationSheet} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <IconSymbol
              ios_icon_name="xmark.circle.fill"
              android_material_icon_name="cancel"
              size={28}
              color={textSecondaryColor}
            />
          </TouchableOpacity>
        </BottomSheetView>

        <BottomSheetScrollView
          style={styles.sheetContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Mode dropdown */}
          <View style={styles.sheetDropdownSection}>
            <Text style={[styles.sheetDropdownLabel, { color: textColor }]}>Search type</Text>
            <TouchableOpacity
              style={[
                styles.sheetDropdownButton,
                { backgroundColor: cardColor, borderColor: isDark ? "#333" : "#E5E7EB" },
              ]}
              onPress={() => {
                console.log("User toggled search mode dropdown");
                setShowModeDropdown((v) => !v);
              }}
            >
              <Text style={[styles.sheetDropdownButtonText, { color: textColor }]}>{selectedModeLabel}</Text>
              <IconSymbol
                ios_icon_name={showModeDropdown ? "chevron.up" : "chevron.down"}
                android_material_icon_name={showModeDropdown ? "arrow-upward" : "arrow-downward"}
                size={20}
                color={textSecondaryColor}
              />
            </TouchableOpacity>

            {showModeDropdown && (
              <View
                style={[
                  styles.sheetDropdownMenu,
                  { backgroundColor: cardColor, borderColor: isDark ? "#333" : "#E5E7EB" },
                ]}
              >
                {SEARCH_MODE_OPTIONS.map((option, index) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.sheetDropdownItem,
                      searchMode === option.value && { backgroundColor: isDark ? "#444" : "#F3F4F6" },
                      index < SEARCH_MODE_OPTIONS.length - 1 && {
                        borderBottomWidth: 1,
                        borderBottomColor: isDark ? "#333" : "#E5E7EB",
                      },
                    ]}
                    onPress={() => {
                      console.log("User changed search mode to:", option.value);
                      setSearchMode(option.value);
                      setShowModeDropdown(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.sheetDropdownItemText,
                        { color: searchMode === option.value ? primaryColor : textColor },
                      ]}
                    >
                      {option.label}
                    </Text>
                    {searchMode === option.value && (
                      <IconSymbol
                        ios_icon_name="checkmark"
                        android_material_icon_name="check"
                        size={20}
                        color={primaryColor}
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Search input */}
          <View
            style={[
              styles.sheetSearchContainer,
              { backgroundColor: cardColor, borderColor: isDark ? "#333" : "#E5E7EB" },
            ]}
          >
            <IconSymbol
              ios_icon_name="magnifyingglass"
              android_material_icon_name="search"
              size={20}
              color={textSecondaryColor}
            />
            <TextInput
              style={[styles.sheetSearchInput, { color: textColor }]}
              placeholder="Search location..."
              placeholderTextColor={textSecondaryColor}
              value={searchText}
              onChangeText={(t) => {
                console.log("User typing in location search:", t);
                setSearchText(t);
              }}
              autoCapitalize="words"
              autoCorrect={false}
            />
            {searchText.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  console.log("User cleared location search text");
                  setSearchText("");
                }}
              >
                <IconSymbol
                  ios_icon_name="xmark.circle.fill"
                  android_material_icon_name="close"
                  size={20}
                  color={textSecondaryColor}
                />
              </TouchableOpacity>
            )}
          </View>

          {/* Results */}
          <View style={styles.sheetResults}>
            {searchLoading && (
              <View style={styles.sheetLoadingContainer}>
                <ActivityIndicator size="large" color={primaryColor} />
                <Text style={[styles.sheetLoadingText, { color: textSecondaryColor }]}>Searching locations...</Text>
              </View>
            )}

            {!searchLoading && searchText.trim() === "" && (
              <View style={styles.sheetEmptyContainer}>
                <IconSymbol
                  ios_icon_name="location.fill"
                  android_material_icon_name="location-on"
                  size={48}
                  color={textSecondaryColor}
                />
                <Text style={[styles.sheetEmptyText, { color: textSecondaryColor }]}>
                  Start typing to search for a location
                </Text>
              </View>
            )}

            {!searchLoading && searchText.trim() !== "" && predictions.length === 0 && (
              <View style={styles.sheetEmptyContainer}>
                <IconSymbol
                  ios_icon_name={searchError ? "exclamationmark.triangle" : "magnifyingglass"}
                  android_material_icon_name={searchError ? "error" : "search"}
                  size={48}
                  color={searchError ? "#EF4444" : textSecondaryColor}
                />
                <Text style={[styles.sheetEmptyText, { color: searchError ? "#EF4444" : textSecondaryColor }]}>
                  {searchError || "No results found"}
                </Text>
              </View>
            )}

            {!searchLoading &&
              predictions.map((prediction, index) => {
                const mainText = prediction.main_text || prediction.description;
                const secondaryText = prediction.secondary_text || prediction.description;
                const isAlreadyAdded = selectedLocations.some((l) => l.place_id === prediction.place_id);

                return (
                  <TouchableOpacity
                    key={`${prediction.place_id}-${index}`}
                    style={[
                      styles.sheetResultItem,
                      { backgroundColor: cardColor, opacity: isAlreadyAdded ? 0.5 : 1 },
                    ]}
                    onPress={() => {
                      if (!isAlreadyAdded) {
                        handleSelectLocation(prediction);
                      }
                    }}
                    disabled={isAlreadyAdded}
                  >
                    <IconSymbol
                      ios_icon_name="location.fill"
                      android_material_icon_name="location-on"
                      size={24}
                      color={primaryColor}
                    />
                    <View style={styles.sheetResultTextContainer}>
                      <Text style={[styles.sheetResultMainText, { color: textColor }]}>{mainText}</Text>
                      {secondaryText && secondaryText !== mainText && (
                        <Text style={[styles.sheetResultSecondaryText, { color: textSecondaryColor }]}>
                          {secondaryText}
                        </Text>
                      )}
                      {isAlreadyAdded && (
                        <Text style={[styles.sheetResultSecondaryText, { color: primaryColor }]}>Already added</Text>
                      )}
                    </View>
                    {isAlreadyAdded ? (
                      <IconSymbol
                        ios_icon_name="checkmark.circle.fill"
                        android_material_icon_name="check-circle"
                        size={20}
                        color={primaryColor}
                      />
                    ) : (
                      <IconSymbol
                        ios_icon_name="plus.circle"
                        android_material_icon_name="add-circle-outline"
                        size={20}
                        color={primaryColor}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}

            <View style={{ height: 40 }} />
          </View>
        </BottomSheetScrollView>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
  },
  toggleContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    alignItems: "center",
  },
  toggleTrack: {
    flexDirection: "row",
    borderRadius: 24,
    padding: 4,
  },
  togglePill: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    alignItems: "center",
  },
  togglePillActive: {
    backgroundColor: ACCENT,
  },
  togglePillText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#888",
  },
  togglePillTextActive: {
    color: "#FFFFFF",
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  videoPickerSection: {
    marginTop: 16,
  },
  videoPlaceholder: {
    height: 360,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#999",
  },
  placeholderText: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
  },
  placeholderSubtext: {
    fontSize: 14,
    marginTop: 4,
  },
  videoSelectedSection: {
    marginTop: 16,
  },
  videoPreviewContainer: {
    height: 360,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
  },
  videoPreview: {
    width: "100%",
    height: "100%",
  },
  videoOverlay: {
    position: "absolute",
    top: 16,
    right: 16,
  },
  videoBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  videoBadgeText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  changeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    gap: 8,
  },
  changeButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  formSection: {
    marginTop: 20,
    gap: 20,
  },
  inputContainer: {
    gap: 8,
  },
  inputHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  optionalLabel: {
    fontSize: 14,
    fontStyle: "italic",
  },
  requiredLabel: {
    fontSize: 14,
    fontStyle: "italic",
  },
  titleInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    fontSize: 16,
  },
  captionInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
  },
  charCount: {
    fontSize: 12,
    textAlign: "right",
  },
  selectedLocationsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  locationChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    maxWidth: "100%",
  },
  locationChipText: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  locationButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  locationButtonText: {
    fontSize: 16,
    flex: 1,
    fontWeight: "600",
  },
  postButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 24,
    gap: 8,
  },
  postButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
  },
  // Bottom sheet styles
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  sheetContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sheetDropdownSection: {
    marginBottom: 16,
  },
  sheetDropdownLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  sheetDropdownButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  sheetDropdownButtonText: {
    fontSize: 16,
    flex: 1,
  },
  sheetDropdownMenu: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  sheetDropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sheetDropdownItemText: {
    fontSize: 15,
    flex: 1,
  },
  sheetSearchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    marginBottom: 16,
  },
  sheetSearchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 4,
  },
  sheetResults: {
    flex: 1,
  },
  sheetLoadingContainer: {
    paddingVertical: 40,
    alignItems: "center",
    gap: 12,
  },
  sheetLoadingText: {
    fontSize: 14,
  },
  sheetEmptyContainer: {
    paddingVertical: 60,
    alignItems: "center",
    gap: 16,
  },
  sheetEmptyText: {
    fontSize: 16,
    textAlign: "center",
    paddingHorizontal: 32,
  },
  sheetResultItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  sheetResultTextContainer: {
    flex: 1,
    gap: 4,
  },
  sheetResultMainText: {
    fontSize: 16,
    fontWeight: "600",
  },
  sheetResultSecondaryText: {
    fontSize: 14,
  },
});
