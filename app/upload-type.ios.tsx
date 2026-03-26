
import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Video as VideoIcon, MapPin, X, Plus, ArrowLeft } from "lucide-react-native";
import { authenticatedPost } from "@/utils/api";
import { SafeAreaView } from "react-native-safe-area-context";

const PINK = "#FF3B7A";

interface Place {
  id: string;
  place_id: string;
  place_name: string;
}

export default function UploadScreen() {
  const router = useRouter();
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoName, setVideoName] = useState<string>("");
  const [caption, setCaption] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [placeInput, setPlaceInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handlePickVideo = useCallback(async () => {
    console.log("User tapped pick video on upload screen (iOS)");
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: false,
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setVideoUri(asset.uri);
      const parts = asset.uri.split("/");
      setVideoName(parts[parts.length - 1] || "video.mp4");
      console.log("User selected video (iOS):", asset.uri);
    }
  }, []);

  const handleAddPlace = useCallback(() => {
    const trimmed = placeInput.trim();
    if (!trimmed) return;
    console.log("User added place (iOS):", trimmed);
    const newPlace: Place = {
      id: `local-${Date.now()}`,
      place_id: `place-${Date.now()}`,
      place_name: trimmed,
    };
    setPlaces((prev) => [...prev, newPlace]);
    setPlaceInput("");
  }, [placeInput]);

  const handleRemovePlace = useCallback((placeId: string) => {
    console.log("User removed place (iOS):", placeId);
    setPlaces((prev) => prev.filter((p) => p.id !== placeId));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!videoUri) {
      Alert.alert("Missing video", "Please select a video to upload.");
      return;
    }
    console.log("User tapped Post (iOS) - submitting upload");
    setSubmitting(true);
    try {
      const payload: Record<string, any> = {
        video_url: videoUri,
        caption: caption.trim() || undefined,
        places: places.map((p) => ({ place_id: p.place_id, place_name: p.place_name })),
      };
      console.log("Posting to /api/moments (iOS):", payload);
      await authenticatedPost("/api/moments", payload);
      console.log("Upload posted successfully (iOS)");
      Alert.alert("Posted!", "Your video has been shared.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      console.error("Upload error (iOS):", e);
      Alert.alert("Upload failed", "Couldn't post your video. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [videoUri, caption, places, router]);

  const handleClose = useCallback(() => {
    console.log("User tapped close on upload screen (iOS)");
    router.back();
  }, [router]);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={handleClose} activeOpacity={0.8} accessibilityLabel="Close">
          <ArrowLeft size={20} color="#111827" strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Post</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

        <TouchableOpacity style={styles.videoPicker} onPress={handlePickVideo} activeOpacity={0.8}>
          {videoUri ? (
            <View style={styles.videoSelected}>
              <VideoIcon size={20} color={PINK} strokeWidth={2} />
              <Text style={styles.videoName} numberOfLines={1}>{videoName}</Text>
              <TouchableOpacity
                onPress={() => { setVideoUri(null); setVideoName(""); }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={16} color="#6B7280" strokeWidth={2} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.videoEmpty}>
              <VideoIcon size={36} color="#D1D5DB" strokeWidth={1.5} />
              <Text style={styles.videoEmptyTitle}>Select a video</Text>
              <Text style={styles.videoEmptySubtitle}>Tap to choose from your library</Text>
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.label}>Caption</Text>
        <TextInput
          style={styles.textArea}
          placeholder="Write a caption..."
          placeholderTextColor="#9CA3AF"
          value={caption}
          onChangeText={setCaption}
          multiline
          numberOfLines={4}
          maxLength={500}
        />

        <Text style={styles.label}>Places</Text>
        <View style={styles.placeInputRow}>
          <TextInput
            style={styles.placeInput}
            placeholder="Add a place..."
            placeholderTextColor="#9CA3AF"
            value={placeInput}
            onChangeText={setPlaceInput}
            onSubmitEditing={handleAddPlace}
            returnKeyType="done"
          />
          <TouchableOpacity style={styles.addPlaceBtn} onPress={handleAddPlace} activeOpacity={0.8}>
            <Plus size={18} color="#FFF" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
        {places.length > 0 ? (
          <View style={styles.placesList}>
            {places.map((place) => (
              <View key={place.id} style={styles.placePill}>
                <MapPin size={12} color={PINK} strokeWidth={2} />
                <Text style={styles.placePillText}>{place.place_name}</Text>
                <TouchableOpacity onPress={() => handleRemovePlace(place.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <X size={12} color="#6B7280" strokeWidth={2} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.submitBtn, (!videoUri || submitting) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!videoUri || submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.submitBtnText}>Post</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700", color: "#111827" },
  headerSpacer: { width: 36 },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 48 },
  videoPicker: {
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    borderStyle: "dashed",
    backgroundColor: "#F9FAFB",
    overflow: "hidden",
    marginBottom: 4,
  },
  videoEmpty: { alignItems: "center", justifyContent: "center", paddingVertical: 48, gap: 8 },
  videoEmptyTitle: { fontSize: 15, fontWeight: "600", color: "#374151" },
  videoEmptySubtitle: { fontSize: 13, color: "#9CA3AF" },
  videoSelected: { flexDirection: "row", alignItems: "center", gap: 10, padding: 16 },
  videoName: { fontSize: 14, color: "#374151", fontWeight: "600", flex: 1 },
  label: { fontSize: 14, fontWeight: "700", color: "#374151", marginBottom: 8, marginTop: 20 },
  textArea: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 14,
    fontSize: 15,
    color: "#111827",
    minHeight: 100,
    textAlignVertical: "top",
  },
  placeInputRow: { flexDirection: "row", gap: 10 },
  placeInput: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#111827",
  },
  addPlaceBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: PINK,
    justifyContent: "center",
    alignItems: "center",
  },
  placesList: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  placePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,59,122,0.08)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "rgba(255,59,122,0.2)",
  },
  placePillText: { fontSize: 13, color: PINK, fontWeight: "600" },
  submitBtn: {
    marginTop: 32,
    backgroundColor: PINK,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { fontSize: 16, fontWeight: "700", color: "#FFF" },
});
