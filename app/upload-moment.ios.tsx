
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
import * as VideoThumbnails from "expo-video-thumbnails";
import { LinearGradient } from "expo-linear-gradient";
import { Video, MapPin, X, Plus } from "lucide-react-native";
import { authenticatedPost } from "@/utils/api";
import { supabase } from "@/lib/supabase";
import { SafeAreaView } from "react-native-safe-area-context";

interface Place {
  id: string;
  place_id: string;
  place_name: string;
}

async function uploadBlobToSupabase(
  localUri: string,
  bucket: string,
  path: string,
  contentType: string
): Promise<string> {
  console.log(`[Upload iOS] Fetching local file: ${localUri}`);
  const response = await fetch(localUri);
  const blob = await response.blob();
  console.log(`[Upload iOS] Uploading to bucket "${bucket}" path "${path}"`);
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, blob, { contentType, upsert: true });
  if (error) {
    console.error(`[Upload iOS] Supabase storage error:`, error);
    throw new Error(error.message);
  }
  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
  console.log(`[Upload iOS] Public URL: ${urlData.publicUrl}`);
  return urlData.publicUrl;
}

export default function UploadMomentScreen() {
  const router = useRouter();
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoName, setVideoName] = useState<string>("");
  const [caption, setCaption] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [placeInput, setPlaceInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");

  const handlePickVideo = useCallback(async () => {
    console.log("User tapped pick video for moment upload (iOS)");
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "videos",
      allowsEditing: false,
      quality: 1,
      videoMaxDuration: 120,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const durationSecs = asset.duration ? asset.duration / 1000 : 0;
      if (durationSecs > 120) {
        console.log("User selected video exceeds 2 minutes for moment (iOS):", durationSecs, "s");
        Alert.alert("Video too long", "Moments can only be up to 2 minutes long.");
        return;
      }
      setVideoUri(asset.uri);
      const parts = asset.uri.split("/");
      setVideoName(parts[parts.length - 1] || "video.mp4");
      console.log("User selected video for moment (iOS):", asset.uri, "duration:", durationSecs, "s");
    }
  }, []);

  const handleAddPlace = useCallback(() => {
    const trimmed = placeInput.trim();
    if (!trimmed) return;
    console.log("User added place to moment (iOS):", trimmed);
    const newPlace: Place = {
      id: `local-${Date.now()}`,
      place_id: `place-${Date.now()}`,
      place_name: trimmed,
    };
    setPlaces((prev) => [...prev, newPlace]);
    setPlaceInput("");
  }, [placeInput]);

  const handleRemovePlace = useCallback((placeId: string) => {
    console.log("User removed place from moment (iOS):", placeId);
    setPlaces((prev) => prev.filter((p) => p.id !== placeId));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!videoUri) {
      Alert.alert("Missing video", "Please select a video to upload.");
      return;
    }
    console.log("User tapped Post Moment (iOS) - submitting moment upload");
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert("Not signed in", "Please sign in to upload.");
        return;
      }

      const timestamp = Date.now();
      const videoPath = `${user.id}/${timestamp}.mp4`;
      const thumbPath = `${user.id}/${timestamp}.jpg`;

      // Step 1: Upload video to 'posts' bucket
      setUploadStatus("Uploading video...");
      console.log("Step 1 (iOS): Uploading video to Supabase Storage bucket 'posts'");
      const videoUrl = await uploadBlobToSupabase(videoUri, "posts", videoPath, "video/mp4");

      // Step 2: Generate thumbnail
      setUploadStatus("Generating thumbnail...");
      let thumbnailUrl: string | null = null;
      try {
        console.log("Step 2 (iOS): Generating thumbnail from video");
        const thumbResult = await VideoThumbnails.getThumbnailAsync(videoUri, { time: 1000 });
        console.log("Thumbnail generated at:", thumbResult.uri);
        setUploadStatus("Uploading thumbnail...");
        thumbnailUrl = await uploadBlobToSupabase(thumbResult.uri, "thumbnails", thumbPath, "image/jpeg");
      } catch (thumbErr: any) {
        console.warn("Thumbnail generation/upload failed (iOS, continuing without thumbnail):", thumbErr?.message);
      }

      // Step 3: POST to backend
      setUploadStatus("Posting moment...");
      const payload = {
        video_url: videoUrl,
        thumbnail_url: thumbnailUrl,
        caption: caption.trim() || undefined,
        places: places.map((p) => ({ place_id: p.place_id, place_name: p.place_name })),
      };
      console.log("Posting moment to /api/moments (iOS):", payload);
      await authenticatedPost("/api/moments", payload);
      console.log("Moment posted successfully (iOS)");
      Alert.alert("Posted!", "Your moment has been shared.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      console.error("Upload moment error (iOS):", e);
      Alert.alert("Upload failed", e?.message || "Couldn't post your moment. Please try again.");
    } finally {
      setSubmitting(false);
      setUploadStatus("");
    }
  }, [videoUri, caption, places, router]);

  const submitLabel = submitting ? (uploadStatus || "Uploading...") : "Post Moment";

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <Stack.Screen options={{ title: "Upload Moment", headerBackTitle: "", headerStyle: { backgroundColor: "#0a0a0a" }, headerTintColor: "#fff", headerTitleStyle: { color: "#fff" } }} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

        <Text style={styles.label}>Video</Text>
        <TouchableOpacity style={styles.videoPicker} onPress={handlePickVideo} activeOpacity={0.8}>
          {videoUri ? (
            <View style={styles.videoSelected}>
              <Video size={20} color="#FF0080" strokeWidth={2} />
              <Text style={styles.videoName} numberOfLines={1}>{videoName}</Text>
            </View>
          ) : (
            <View style={styles.videoEmpty}>
              <Video size={32} color="#555" strokeWidth={1.5} />
              <Text style={styles.videoEmptyText}>Tap to select a video</Text>
              <Text style={styles.videoEmptyHint}>Up to 2 minutes</Text>
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.label}>Caption</Text>
        <TextInput
          style={styles.textArea}
          placeholder="Write a caption..."
          placeholderTextColor="#555"
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
            placeholder="Add a place name..."
            placeholderTextColor="#555"
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
                <MapPin size={12} color="#FF0080" strokeWidth={2} />
                <Text style={styles.placePillText}>{place.place_name}</Text>
                <TouchableOpacity onPress={() => handleRemovePlace(place.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <X size={12} color="#888" strokeWidth={2} />
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
          <LinearGradient
            colors={["#FF0080", "#FF6B00"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradientBtn}
          >
            {submitting ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color="#FFF" />
                <Text style={styles.submitBtnText}>{submitLabel}</Text>
              </View>
            ) : (
              <Text style={styles.submitBtnText}>Post Moment</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 48 },
  label: { fontSize: 14, fontWeight: "700", color: "#fff", marginBottom: 8, marginTop: 20 },
  videoPicker: {
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#333",
    borderStyle: "dashed",
    backgroundColor: "#111",
    overflow: "hidden",
  },
  videoEmpty: { alignItems: "center", justifyContent: "center", paddingVertical: 40, gap: 8 },
  videoEmptyText: { fontSize: 14, color: "#888" },
  videoEmptyHint: { fontSize: 12, color: "#555" },
  videoSelected: { flexDirection: "row", alignItems: "center", gap: 10, padding: 16 },
  videoName: { fontSize: 14, color: "#fff", fontWeight: "600", flex: 1 },
  textArea: {
    backgroundColor: "#111",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#333",
    padding: 14,
    fontSize: 15,
    color: "#fff",
    minHeight: 100,
    textAlignVertical: "top",
  },
  placeInputRow: { flexDirection: "row", gap: 10 },
  placeInput: {
    flex: 1,
    backgroundColor: "#111",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#333",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#fff",
  },
  addPlaceBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#FF0080",
    justifyContent: "center",
    alignItems: "center",
  },
  placesList: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  placePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,0,128,0.1)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "rgba(255,0,128,0.25)",
  },
  placePillText: { fontSize: 13, color: "#FF0080", fontWeight: "600" },
  submitBtn: {
    marginTop: 32,
    borderRadius: 14,
    overflow: "hidden",
  },
  submitBtnDisabled: { opacity: 0.45 },
  gradientBtn: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  submitBtnText: { fontSize: 16, fontWeight: "700", color: "#FFF" },
});
