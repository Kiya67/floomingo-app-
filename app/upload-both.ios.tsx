
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
import { Video, MapPin, X, Plus, Play, Film } from "lucide-react-native";
import { authenticatedPost } from "@/utils/api";
import { SafeAreaView } from "react-native-safe-area-context";

const PINK = "#FF3B7A";

interface Place {
  id: string;
  place_id: string;
  place_name: string;
}

export default function UploadBothScreen() {
  const router = useRouter();
  const [momentVideoUri, setMomentVideoUri] = useState<string | null>(null);
  const [momentVideoName, setMomentVideoName] = useState<string>("");
  const [caption, setCaption] = useState("");
  const [expVideoUri, setExpVideoUri] = useState<string | null>(null);
  const [expVideoName, setExpVideoName] = useState<string>("");
  const [expTitle, setExpTitle] = useState("");
  const [expDescription, setExpDescription] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [placeInput, setPlaceInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState<string>("");

  const handlePickMomentVideo = useCallback(async () => {
    console.log("User tapped pick video for moment section (upload-both iOS)");
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: false,
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setMomentVideoUri(asset.uri);
      const parts = asset.uri.split("/");
      setMomentVideoName(parts[parts.length - 1] || "video.mp4");
      console.log("User selected moment video (upload-both iOS):", asset.uri);
    }
  }, []);

  const handlePickExpVideo = useCallback(async () => {
    console.log("User tapped pick video for experience section (upload-both iOS)");
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: false,
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setExpVideoUri(asset.uri);
      const parts = asset.uri.split("/");
      setExpVideoName(parts[parts.length - 1] || "video.mp4");
      console.log("User selected experience video (upload-both iOS):", asset.uri);
    }
  }, []);

  const handleAddPlace = useCallback(() => {
    const trimmed = placeInput.trim();
    if (!trimmed) return;
    console.log("User added shared place (upload-both iOS):", trimmed);
    const newPlace: Place = {
      id: `local-${Date.now()}`,
      place_id: `place-${Date.now()}`,
      place_name: trimmed,
    };
    setPlaces((prev) => [...prev, newPlace]);
    setPlaceInput("");
  }, [placeInput]);

  const handleRemovePlace = useCallback((placeId: string) => {
    console.log("User removed shared place (upload-both iOS):", placeId);
    setPlaces((prev) => prev.filter((p) => p.id !== placeId));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!momentVideoUri) {
      Alert.alert("Missing moment video", "Please select a video for the Moment.");
      return;
    }
    if (!expVideoUri) {
      Alert.alert("Missing experience video", "Please select a video for the Experience.");
      return;
    }
    if (!expTitle.trim()) {
      Alert.alert("Missing title", "Please add a title for the Experience.");
      return;
    }
    console.log("User tapped Post Both (iOS) - submitting moment + experience upload");
    setSubmitting(true);
    const placesPayload = places.map((p) => ({ place_id: p.place_id, place_name: p.place_name }));
    try {
      setSubmitStep("Posting moment...");
      console.log("Step 1 (iOS): Posting moment to /api/moments");
      const momentRes = await authenticatedPost<{ id: string }>("/api/moments", {
        video_url: momentVideoUri,
        caption: caption.trim() || undefined,
        places: placesPayload,
      });
      const momentId = momentRes?.id;
      console.log("Moment posted (iOS), id:", momentId);

      setSubmitStep("Posting experience...");
      console.log("Step 2 (iOS): Posting experience to /api/experiences, linked_moment_id:", momentId);
      await authenticatedPost("/api/experiences", {
        video_url: expVideoUri,
        title: expTitle.trim(),
        description: expDescription.trim() || undefined,
        places: placesPayload,
        linked_moment_id: momentId || undefined,
      });
      console.log("Experience posted successfully (iOS)");

      Alert.alert("Posted!", "Your Moment and Experience have been shared.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      console.error("Upload both error (iOS):", e);
      Alert.alert("Upload failed", "Couldn't post. Please try again.");
    } finally {
      setSubmitting(false);
      setSubmitStep("");
    }
  }, [momentVideoUri, expVideoUri, expTitle, caption, expDescription, places, router]);

  const canSubmit = !!momentVideoUri && !!expVideoUri && !!expTitle.trim() && !submitting;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <Stack.Screen options={{ title: "Upload Both", headerBackTitle: "", headerTintColor: "#111827" }} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

        <View style={styles.sectionHeader}>
          <View style={[styles.sectionBadge, { backgroundColor: "rgba(255,59,122,0.1)" }]}>
            <Play size={14} color={PINK} strokeWidth={2} />
            <Text style={[styles.sectionBadgeText, { color: PINK }]}>Moment</Text>
          </View>
        </View>

        <Text style={styles.label}>Video</Text>
        <TouchableOpacity style={styles.videoPicker} onPress={handlePickMomentVideo} activeOpacity={0.8}>
          {momentVideoUri ? (
            <View style={styles.videoSelected}>
              <Video size={20} color={PINK} strokeWidth={2} />
              <Text style={styles.videoName} numberOfLines={1}>{momentVideoName}</Text>
            </View>
          ) : (
            <View style={styles.videoEmpty}>
              <Video size={28} color="#9CA3AF" strokeWidth={1.5} />
              <Text style={styles.videoEmptyText}>Tap to select moment video</Text>
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
          numberOfLines={3}
          maxLength={500}
        />

        <View style={styles.divider} />

        <View style={styles.sectionHeader}>
          <View style={[styles.sectionBadge, { backgroundColor: "rgba(124,58,237,0.1)" }]}>
            <Film size={14} color="#7C3AED" strokeWidth={2} />
            <Text style={[styles.sectionBadgeText, { color: "#7C3AED" }]}>Experience</Text>
          </View>
        </View>

        <Text style={styles.label}>Video</Text>
        <TouchableOpacity style={styles.videoPicker} onPress={handlePickExpVideo} activeOpacity={0.8}>
          {expVideoUri ? (
            <View style={styles.videoSelected}>
              <Video size={20} color="#7C3AED" strokeWidth={2} />
              <Text style={styles.videoName} numberOfLines={1}>{expVideoName}</Text>
            </View>
          ) : (
            <View style={styles.videoEmpty}>
              <Video size={28} color="#9CA3AF" strokeWidth={1.5} />
              <Text style={styles.videoEmptyText}>Tap to select experience video</Text>
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.label}>Title <Text style={styles.required}>*</Text></Text>
        <TextInput
          style={styles.input}
          placeholder="Give your experience a title..."
          placeholderTextColor="#9CA3AF"
          value={expTitle}
          onChangeText={setExpTitle}
          maxLength={120}
          returnKeyType="next"
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={styles.textArea}
          placeholder="Describe your experience..."
          placeholderTextColor="#9CA3AF"
          value={expDescription}
          onChangeText={setExpDescription}
          multiline
          numberOfLines={4}
          maxLength={2000}
        />

        <View style={styles.divider} />

        <Text style={styles.sharedLabel}>Shared Places</Text>
        <Text style={styles.sharedHint}>These places will be applied to both your Moment and Experience.</Text>
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

        <TouchableOpacity
          style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
          activeOpacity={0.85}
        >
          {submitting ? (
            <View style={styles.submitLoading}>
              <ActivityIndicator size="small" color="#FFF" />
              <Text style={styles.submitBtnText}>{submitStep || "Posting..."}</Text>
            </View>
          ) : (
            <Text style={styles.submitBtnText}>Post Both</Text>
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
  sectionHeader: { marginTop: 8, marginBottom: 4 },
  sectionBadge: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, alignSelf: "flex-start" },
  sectionBadgeText: { fontSize: 13, fontWeight: "700" },
  label: { fontSize: 14, fontWeight: "700", color: "#374151", marginBottom: 8, marginTop: 16 },
  required: { color: PINK },
  sharedLabel: { fontSize: 16, fontWeight: "800", color: "#111827", marginBottom: 4, marginTop: 4 },
  sharedHint: { fontSize: 13, color: "#6B7280", marginBottom: 12, lineHeight: 18 },
  divider: { height: 1, backgroundColor: "#E5E7EB", marginVertical: 24 },
  videoPicker: {
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    borderStyle: "dashed",
    backgroundColor: "#FFF",
    overflow: "hidden",
  },
  videoEmpty: { alignItems: "center", justifyContent: "center", paddingVertical: 32, gap: 8 },
  videoEmptyText: { fontSize: 13, color: "#9CA3AF" },
  videoSelected: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
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
    minHeight: 90,
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
  submitBtn: {
    marginTop: 32,
    backgroundColor: PINK,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitLoading: { flexDirection: "row", alignItems: "center", gap: 10 },
  submitBtnText: { fontSize: 16, fontWeight: "700", color: "#FFF" },
});
