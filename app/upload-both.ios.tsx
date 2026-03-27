
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
import { Video, MapPin, X, Plus, Play, Film } from "lucide-react-native";
import { getBearerToken, authenticatedPost } from "@/utils/api";
import { SafeAreaView } from "react-native-safe-area-context";

const EXPERIENCE_ENDPOINT = "https://7efxms2e3tmdd7a38j8uphfzrnwcgesc.app.specular.dev/api/experiences";

interface Place {
  id: string;
  place_id: string;
  place_name: string;
}

export default function UploadBothScreen() {
  const router = useRouter();
  const [momentVideoUri, setMomentVideoUri] = useState<string | null>(null);
  const [momentVideoName, setMomentVideoName] = useState<string>("");
  const [expVideoUri, setExpVideoUri] = useState<string | null>(null);
  const [expVideoName, setExpVideoName] = useState<string>("");
  const [expVideoDuration, setExpVideoDuration] = useState<number>(0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [placeInput, setPlaceInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState<string>("");

  const handlePickMomentVideo = useCallback(async () => {
    console.log("User tapped pick video for moment section (upload-both iOS)");
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
        console.log("Moment video exceeds 2 minutes (upload-both iOS):", durationSecs, "s");
        Alert.alert("Video too long", "Moments can only be up to 2 minutes long.");
        return;
      }
      setMomentVideoUri(asset.uri);
      const parts = asset.uri.split("/");
      setMomentVideoName(parts[parts.length - 1] || "video.mp4");
      console.log("User selected moment video (upload-both iOS):", asset.uri, "duration:", durationSecs, "s");
    }
  }, []);

  const handlePickExpVideo = useCallback(async () => {
    console.log("User tapped pick video for experience section (upload-both iOS)");
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "videos",
      allowsEditing: false,
      quality: 1,
      videoMaxDuration: 7200,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const durationSecs = asset.duration ? asset.duration / 1000 : 0;
      setExpVideoUri(asset.uri);
      setExpVideoDuration(durationSecs);
      const parts = asset.uri.split("/");
      setExpVideoName(parts[parts.length - 1] || "video.mp4");
      console.log("User selected experience video (upload-both iOS):", asset.uri, "duration:", durationSecs, "s");
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
    if (!title.trim()) {
      Alert.alert("Missing title", "Please add a title.");
      return;
    }
    console.log("User tapped Post Both (iOS) - submitting moment + experience upload in parallel");
    setSubmitting(true);
    setSubmitStep("Uploading...");

    try {
      const token = await getBearerToken();
      if (!token) {
        Alert.alert("Not signed in", "Please sign in to upload.");
        return;
      }

      const momentPayload = {
        video_url: momentVideoUri,
        caption: title.trim(),
        places: places.map((p) => ({ place_id: p.place_id, place_name: p.place_name })),
      };

      const expFormData = new FormData();
      expFormData.append("video", {
        uri: expVideoUri,
        name: expVideoName || "video.mp4",
        type: "video/mp4",
      } as any);
      expFormData.append("title", title.trim());
      if (description.trim()) expFormData.append("description", description.trim());
      if (location.trim()) expFormData.append("location", location.trim());
      expFormData.append("duration", String(Math.round(expVideoDuration)));

      console.log("Uploading moment to /api/moments and experience to", EXPERIENCE_ENDPOINT, "in parallel (iOS)");

      const [momentResult, expResponse] = await Promise.all([
        authenticatedPost("/api/moments", momentPayload).catch((e) => { throw new Error("Moment upload failed: " + e.message); }),
        fetch(EXPERIENCE_ENDPOINT, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: expFormData,
        }),
      ]);

      console.log("Moment upload result (iOS):", momentResult);
      console.log("Experience upload response status (iOS):", expResponse.status);

      if (!expResponse.ok) {
        const text = await expResponse.text();
        console.error("Experience upload error response (iOS):", text);
        throw new Error("Experience upload failed: " + text);
      }

      const expData = await expResponse.json();
      console.log("Both uploads successful (iOS). Experience:", expData);

      Alert.alert("Posted!", "Your Moment and Experience have been shared.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      console.error("Upload both error (iOS):", e);
      Alert.alert("Upload failed", e?.message || "Couldn't post. Please try again.");
    } finally {
      setSubmitting(false);
      setSubmitStep("");
    }
  }, [momentVideoUri, expVideoUri, expVideoName, expVideoDuration, title, description, location, places, router]);

  const canSubmit = !!momentVideoUri && !!expVideoUri && !!title.trim() && !submitting;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <Stack.Screen options={{ title: "Upload Both", headerBackTitle: "", headerStyle: { backgroundColor: "#0a0a0a" }, headerTintColor: "#fff", headerTitleStyle: { color: "#fff" } }} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

        <View style={styles.sectionHeader}>
          <View style={[styles.sectionBadge, { backgroundColor: "rgba(255,0,128,0.12)" }]}>
            <Play size={13} color="#FF0080" strokeWidth={2} />
            <Text style={[styles.sectionBadgeText, { color: "#FF0080" }]}>Moment</Text>
          </View>
          <Text style={styles.sectionHint}>Up to 2 minutes</Text>
        </View>

        <TouchableOpacity style={styles.videoPicker} onPress={handlePickMomentVideo} activeOpacity={0.8}>
          {momentVideoUri ? (
            <View style={styles.videoSelected}>
              <Video size={18} color="#FF0080" strokeWidth={2} />
              <Text style={styles.videoName} numberOfLines={1}>{momentVideoName}</Text>
            </View>
          ) : (
            <View style={styles.videoEmpty}>
              <Video size={28} color="#555" strokeWidth={1.5} />
              <Text style={styles.videoEmptyText}>Tap to select moment video</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.divider} />

        <View style={styles.sectionHeader}>
          <View style={[styles.sectionBadge, { backgroundColor: "rgba(255,107,0,0.12)" }]}>
            <Film size={13} color="#FF6B00" strokeWidth={2} />
            <Text style={[styles.sectionBadgeText, { color: "#FF6B00" }]}>Experience</Text>
          </View>
          <Text style={styles.sectionHint}>Up to 2 hours</Text>
        </View>

        <TouchableOpacity style={styles.videoPicker} onPress={handlePickExpVideo} activeOpacity={0.8}>
          {expVideoUri ? (
            <View style={styles.videoSelected}>
              <Video size={18} color="#FF6B00" strokeWidth={2} />
              <Text style={styles.videoName} numberOfLines={1}>{expVideoName}</Text>
            </View>
          ) : (
            <View style={styles.videoEmpty}>
              <Video size={28} color="#555" strokeWidth={1.5} />
              <Text style={styles.videoEmptyText}>Tap to select experience video</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.divider} />

        <Text style={styles.sharedLabel}>Shared Details</Text>
        <Text style={styles.sharedHint}>Title, description, and location apply to both uploads.</Text>

        <Text style={styles.label}>
          Title <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Give your content a title..."
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
          numberOfLines={4}
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
                <Text style={styles.submitBtnText}>{submitStep || "Uploading..."}</Text>
              </View>
            ) : (
              <Text style={styles.submitBtnText}>Post Both</Text>
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
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10, marginTop: 4 },
  sectionBadge: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  sectionBadgeText: { fontSize: 13, fontWeight: "700" },
  sectionHint: { fontSize: 12, color: "#555" },
  divider: { height: 1, backgroundColor: "#222", marginVertical: 20 },
  sharedLabel: { fontSize: 15, fontWeight: "800", color: "#fff", marginBottom: 4 },
  sharedHint: { fontSize: 12, color: "#555", marginBottom: 4, lineHeight: 18 },
  label: { fontSize: 14, fontWeight: "700", color: "#fff", marginBottom: 8, marginTop: 16 },
  required: { color: "#FF0080" },
  videoPicker: {
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#333",
    borderStyle: "dashed",
    backgroundColor: "#111",
    overflow: "hidden",
  },
  videoEmpty: { alignItems: "center", justifyContent: "center", paddingVertical: 28, gap: 8 },
  videoEmptyText: { fontSize: 13, color: "#888" },
  videoSelected: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
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
    minHeight: 90,
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
