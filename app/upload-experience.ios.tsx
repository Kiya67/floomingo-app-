
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
import { Video, MapPin } from "lucide-react-native";
import { authenticatedPost } from "@/utils/api";
import { supabase } from "@/lib/supabase";
import { SafeAreaView } from "react-native-safe-area-context";

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

export default function UploadExperienceScreen() {
  const router = useRouter();
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoName, setVideoName] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");

  const handlePickVideo = useCallback(async () => {
    console.log("User tapped pick video for experience upload (iOS)");
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "videos",
      allowsEditing: false,
      quality: 1,
      videoMaxDuration: 7200,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const durationSecs = asset.duration ? asset.duration / 1000 : 0;
      setVideoUri(asset.uri);
      const parts = asset.uri.split("/");
      setVideoName(parts[parts.length - 1] || "video.mp4");
      console.log("User selected video for experience (iOS):", asset.uri, "duration:", durationSecs, "s");
    }
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
    console.log("User tapped Post Experience (iOS) - submitting Supabase Storage upload");
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

      // Step 1: Upload video to 'experiences' bucket
      setUploadStatus("Uploading video...");
      console.log("Step 1 (iOS): Uploading experience video to Supabase Storage bucket 'experiences'");
      const videoUrl = await uploadBlobToSupabase(videoUri, "experiences", videoPath, "video/mp4");

      // Step 2: Generate and upload thumbnail
      setUploadStatus("Generating thumbnail...");
      let thumbnailUrl: string | null = null;
      try {
        console.log("Step 2 (iOS): Generating thumbnail from experience video");
        const thumbResult = await VideoThumbnails.getThumbnailAsync(videoUri, { time: 1000 });
        console.log("Thumbnail generated at:", thumbResult.uri);
        setUploadStatus("Uploading thumbnail...");
        thumbnailUrl = await uploadBlobToSupabase(thumbResult.uri, "thumbnails", thumbPath, "image/jpeg");
      } catch (thumbErr: any) {
        console.warn("Thumbnail generation/upload failed (iOS, continuing without thumbnail):", thumbErr?.message);
      }

      // Step 3: POST JSON to backend
      setUploadStatus("Posting experience...");
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        video_url: videoUrl,
        thumbnail_url: thumbnailUrl,
      };
      console.log("Posting experience to /api/experiences (iOS):", payload);
      await authenticatedPost("/api/experiences", payload);
      console.log("Experience posted successfully (iOS)");
      Alert.alert("Posted!", "Your experience has been shared.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      console.error("Upload experience error (iOS):", e);
      Alert.alert("Upload failed", e?.message || "Couldn't post your experience. Please try again.");
    } finally {
      setSubmitting(false);
      setUploadStatus("");
    }
  }, [videoUri, videoName, title, description, location, router]);

  const canSubmit = !!videoUri && !!title.trim() && !submitting;
  const submitLabel = submitting ? (uploadStatus || "Uploading...") : "Post Experience";

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <Stack.Screen options={{ title: "Upload Experience", headerBackTitle: "", headerStyle: { backgroundColor: "#0a0a0a" }, headerTintColor: "#fff", headerTitleStyle: { color: "#fff" } }} />
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
              <Text style={styles.videoEmptyHint}>Up to 2 hours</Text>
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.label}>
          Title <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Give your experience a title..."
          placeholderTextColor="#555"
          value={title}
          onChangeText={setTitle}
          maxLength={120}
          returnKeyType="next"
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={styles.textArea}
          placeholder="Describe your experience..."
          placeholderTextColor="#555"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={5}
          maxLength={2000}
        />

        <Text style={styles.label}>
          <MapPin size={13} color="#FF0080" strokeWidth={2} />
          {"  "}Location
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Where did this take place?"
          placeholderTextColor="#555"
          value={location}
          onChangeText={setLocation}
          maxLength={200}
          returnKeyType="done"
        />

        <TouchableOpacity
          style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
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
              <Text style={styles.submitBtnText}>Post Experience</Text>
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
  required: { color: "#FF0080" },
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
  input: {
    backgroundColor: "#111",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#333",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#fff",
  },
  textArea: {
    backgroundColor: "#111",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#333",
    padding: 14,
    fontSize: 15,
    color: "#fff",
    minHeight: 120,
    textAlignVertical: "top",
  },
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
