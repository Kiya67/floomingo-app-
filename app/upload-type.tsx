
import React, { useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Play, Film, Layers, ArrowLeft } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function UploadTypeScreen() {
  const router = useRouter();

  const handleMoment = useCallback(() => {
    console.log("User tapped Moment on upload-type screen");
    router.push("/upload-moment");
  }, [router]);

  const handleExperience = useCallback(() => {
    console.log("User tapped Experience on upload-type screen");
    router.push("/upload-experience");
  }, [router]);

  const handleBoth = useCallback(() => {
    console.log("User tapped Both on upload-type screen");
    router.push("/upload-both");
  }, [router]);

  const handleClose = useCallback(() => {
    console.log("User tapped close on upload-type screen");
    router.back();
  }, [router]);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={handleClose} activeOpacity={0.8} accessibilityLabel="Close">
          <ArrowLeft size={20} color="#fff" strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Post</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        <Text style={styles.subtitle}>What would you like to share?</Text>

        <TouchableOpacity style={styles.card} onPress={handleMoment} activeOpacity={0.85}>
          <View style={[styles.iconWrap, { backgroundColor: "rgba(255,0,128,0.12)" }]}>
            <Play size={28} color="#FF0080" strokeWidth={2} />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Moment</Text>
            <Text style={styles.cardDesc}>A short clip up to 2 minutes</Text>
          </View>
          <LinearGradient
            colors={["#FF0080", "#FF6B00"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.cardArrow}
          >
            <Text style={styles.cardArrowText}>›</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={handleExperience} activeOpacity={0.85}>
          <View style={[styles.iconWrap, { backgroundColor: "rgba(255,107,0,0.12)" }]}>
            <Film size={28} color="#FF6B00" strokeWidth={2} />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Experience</Text>
            <Text style={styles.cardDesc}>A long-form video up to 2 hours</Text>
          </View>
          <LinearGradient
            colors={["#FF0080", "#FF6B00"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.cardArrow}
          >
            <Text style={styles.cardArrowText}>›</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={handleBoth} activeOpacity={0.85}>
          <View style={[styles.iconWrap, { backgroundColor: "rgba(255,0,128,0.08)" }]}>
            <Layers size={28} color="#FF0080" strokeWidth={2} />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Both</Text>
            <Text style={styles.cardDesc}>Upload a Moment and Experience together</Text>
          </View>
          <LinearGradient
            colors={["#FF0080", "#FF6B00"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.cardArrow}
          >
            <Text style={styles.cardArrowText}>›</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#222",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1a1a1a",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700", color: "#fff" },
  headerSpacer: { width: 36 },
  content: { flex: 1, padding: 20, paddingTop: 32 },
  subtitle: { fontSize: 14, color: "#666", marginBottom: 24, textAlign: "center" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#222",
    padding: 16,
    marginBottom: 14,
    gap: 14,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#fff", marginBottom: 3 },
  cardDesc: { fontSize: 13, color: "#666", lineHeight: 18 },
  cardArrow: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  cardArrowText: { fontSize: 20, color: "#fff", fontWeight: "700", lineHeight: 24 },
});
