
import React from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { Play, Film, Layers, X } from "lucide-react-native";

const PINK = "#FF3B7A";

interface UploadOption {
  key: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  route: string;
  accent: string;
}

const OPTIONS: UploadOption[] = [
  {
    key: "moment",
    icon: <Play size={28} color={PINK} strokeWidth={2} />,
    title: "Moment",
    subtitle: "Short-form video for fast discovery",
    route: "/upload-moment",
    accent: PINK,
  },
  {
    key: "experience",
    icon: <Film size={28} color="#7C3AED" strokeWidth={2} />,
    title: "Experience",
    subtitle: "Long-form video for deeper viewing",
    route: "/upload-experience",
    accent: "#7C3AED",
  },
  {
    key: "both",
    icon: <Layers size={28} color="#0EA5E9" strokeWidth={2} />,
    title: "Both",
    subtitle: "Upload a Moment + Experience together",
    route: "/upload-both",
    accent: "#0EA5E9",
  },
];

export default function UploadTypeScreen() {
  const router = useRouter();

  const handleOptionPress = (option: UploadOption) => {
    console.log("User tapped upload type:", option.key);
    router.push(option.route as any);
  };

  const handleClose = () => {
    console.log("User tapped close on upload type selector");
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>What are you uploading?</Text>
        <TouchableOpacity style={styles.closeBtn} onPress={handleClose} activeOpacity={0.8} accessibilityLabel="Close">
          <X size={20} color="rgba(255,255,255,0.7)" strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <View style={styles.optionsList}>
        {OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.key}
            style={styles.optionCard}
            onPress={() => handleOptionPress(option)}
            activeOpacity={0.85}
          >
            <View style={[styles.iconCircle, { backgroundColor: `${option.accent}18` }]}>
              {option.icon}
            </View>
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>{option.title}</Text>
              <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
            </View>
            <View style={[styles.chevron, { backgroundColor: `${option.accent}18` }]}>
              <Text style={[styles.chevronText, { color: option.accent }]}>→</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A0F" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#FFFFFF", letterSpacing: -0.4 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  optionsList: { paddingHorizontal: 20, gap: 16 },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  optionText: { flex: 1, gap: 4 },
  optionTitle: { fontSize: 18, fontWeight: "700", color: "#FFFFFF", letterSpacing: -0.2 },
  optionSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 18 },
  chevron: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  chevronText: { fontSize: 18, fontWeight: "700" },
});
