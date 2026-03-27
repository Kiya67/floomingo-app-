
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
import { LinearGradient } from "expo-linear-gradient";
import { Video, MapPin } from "lucide-react-native";
import { getBearerToken } from "@/utils/api";
import { SafeAreaView } from "react-native-safe-area-context";

const EXPERIENCE_ENDPOINT = "https://7efxms2e3tmdd7a38j8uphfzrnwcgesc.app.specular.dev/api/experiences";

export default function UploadExperienceScreen() {
  const router = useRouter();
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoName, setVideoName] = useState<string>("");
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
      setVideoDuration(durationSecs);
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
    console.log("User tapped Post Experience (iOS) - submitting multipart upload");
    setSubmitting(true);
    try {
      const token = await getBearerToken();
      if (!token) {
        Alert.alert("Not signed in", "Please sign in to upload.");
        return;
      }

      const formData = new FormData();
      formData.append("video", {
        uri: videoUri,
        name: videoName || "video.mp4",
        type: "video/mp4",
      } as any);
      formData.append("title", title.trim());
      if (description.trim()) formData.append("description", description.trim());
      if (location.trim()) formData.append("location", location.trim());
      formData.append("duration", String(Math.round(videoDuration)));

      console.log("POST multipart/form-data to", EXPERIENCE_ENDPOINT, "title:", title.trim(), "duration:", Math.round(videoDuration));

      const response = await fetch(EXPERIENCE_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      console.log("Experience upload response status (iOS):", response.status);

      if (!response.ok) {
        const text = await response.text();
        console.error("Experience upload error response (iOS):", text);
        Alert.alert("Upload failed", text || "Couldn't post your experience. Please try again.");
        return;
      }

      const data = await response.json();
      console.log("Experience posted successfully (iOS):", data);
      Alert.alert("Posted!", "Your experience has been shared.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      console.error("Upload experience error (iOS):", e);
      Alert.alert("Upload failed", e?.message || "Couldn't post your experience. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [videoUri, videoName, videoDuration, title, description, location, router]);

  const canSubmit = !!videoUri && !!title.trim() && !submitting;

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
                <Text style={styles.submitBtnText}>Uploading...</Text>
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
