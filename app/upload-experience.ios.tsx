
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
import { Video, MapPin, X, Plus } from "lucide-react-native";
import { authenticatedPost } from "@/utils/api";
import { SafeAreaView } from "react-native-safe-area-context";

const PINK = "#FF3B7A";

interface Place {
  id: string;
  place_id: string;
  place_name: string;
}

export default function UploadExperienceScreen() {
  const router = useRouter();
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoName, setVideoName] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [placeInput, setPlaceInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handlePickVideo = useCallback(async () => {
    console.log("User tapped pick video for experience upload (iOS)");
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
      console.log("User selected video for experience (iOS):", asset.uri);
    }
  }, []);

  const handleAddPlace = useCallback(() => {
    const trimmed = placeInput.trim();
    if (!trimmed) return;
    console.log("User added place to experience (iOS):", trimmed);
    const newPlace: Place = {
      id: `local-${Date.now()}`,
      place_id: `place-${Date.now()}`,
      place_name: trimmed,
    };
    setPlaces((prev) => [...prev, newPlace]);
    setPlaceInput("");
  }, [placeInput]);

  const handleRemovePlace = useCallback((placeId: string) => {
    console.log("User removed place from experience (iOS):", placeId);
    setPlaces((prev) => prev.filter((p) => p.id !== placeId));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!videoUri) {
      Alert.alert("Missing video", "Please select a video to upload.");
      return;
    }
    if (!title.trim()) {
      Alert.alert("Missing title", "Please add a title for your experience.");
      return;
    }
    console.log("User tapped Post Experience (iOS) - submitting experience upload");
    setSubmitting(true);
    try {
      const payload: Record<string, any> = {
        video_url: videoUri,
        title: title.trim(),
        description: description.trim() || undefined,
        places: places.map((p) => ({ place_id: p.place_id, place_name: p.place_name })),
      };
      console.log("Posting experience to /api/experiences (iOS):", payload);
      await authenticatedPost("/api/experiences", payload);
      console.log("Experience posted successfully (iOS)");
      Alert.alert("Posted!", "Your experience has been shared.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      console.error("Upload experience error (iOS):", e);
      Alert.alert("Upload failed", "Couldn't post your experience. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [videoUri, title, description, places, router]);

  const canSubmit = !!videoUri && !!title.trim() && !submitting;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <Stack.Screen options={{ title: "Upload Experience", headerBackTitle: "", headerTintColor: "#111827" }} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

        <Text style={styles.label}>Video</Text>
        <TouchableOpacity style={styles.videoPicker} onPress={handlePickVideo} activeOpacity={0.8}>
          {videoUri ? (
            <View style={styles.videoSelected}>
              <Video size={20} color={PINK} strokeWidth={2} />
              <Text style={styles.videoName} numberOfLines={1}>{videoName}</Text>
            </View>
          ) : (
            <View style={styles.videoEmpty}>
              <Video size={32} color="#9CA3AF" strokeWidth={1.5} />
              <Text style={styles.videoEmptyText}>Tap to select a video</Text>
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.label}>Title <Text style={styles.required}>*</Text></Text>
        <TextInput
          style={styles.input}
          placeholder="Give your experience a title..."
          placeholderTextColor="#9CA3AF"
          value={title}
          onChangeText={setTitle}
          maxLength={120}
          returnKeyType="next"
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={styles.textArea}
          placeholder="Describe your experience..."
          placeholderTextColor="#9CA3AF"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={5}
          maxLength={2000}
        />

        <Text style={styles.label}>Places</Text>
        <View style={styles.placeInputRow}>
          <TextInput
            style={styles.placeInput}
            placeholder="Add a place name..."
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

        <Text style={styles.label}>Link to Moment <Text style={styles.optional}>(optional)</Text></Text>
        <Text style={styles.linkedHint}>You can link a moment after uploading from the moment detail screen.</Text>

        <TouchableOpacity
          style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.submitBtnText}>Post Experience</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 48 },
  label: { fontSize: 14, fontWeight: "700", color: "#374151", marginBottom: 8, marginTop: 20 },
  required: { color: PINK },
  optional: { fontSize: 13, fontWeight: "400", color: "#9CA3AF" },
  videoPicker: {
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    borderStyle: "dashed",
    backgroundColor: "#FFF",
    overflow: "hidden",
  },
  videoEmpty: { alignItems: "center", justifyContent: "center", paddingVertical: 40, gap: 10 },
  videoEmptyText: { fontSize: 14, color: "#9CA3AF" },
  videoSelected: { flexDirection: "row", alignItems: "center", gap: 10, padding: 16 },
  videoName: { fontSize: 14, color: "#374151", fontWeight: "600", flex: 1 },
  input: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#111827",
  },
  textArea: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 14,
    fontSize: 15,
    color: "#111827",
    minHeight: 120,
    textAlignVertical: "top",
  },
  placeInputRow: { flexDirection: "row", gap: 10 },
  placeInput: {
    flex: 1,
    backgroundColor: "#FFF",
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
  linkedHint: { fontSize: 13, color: "#9CA3AF", lineHeight: 18 },
  submitBtn: {
    marginTop: 32,
    backgroundColor: PINK,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { fontSize: 16, fontWeight: "700", color: "#FFF" },
});
