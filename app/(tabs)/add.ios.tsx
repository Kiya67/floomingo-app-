
import React from "react";
import { IconSymbol } from "@/components/IconSymbol";
import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text, StyleSheet, TouchableOpacity, useColorScheme } from "react-native";
import { colors } from "@/styles/commonStyles";

export default function AddScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const bgColor = isDark ? colors.backgroundDark : colors.background;
  const textColor = isDark ? colors.textDark : colors.text;
  const textSecondaryColor = isDark ? colors.textSecondaryDark : colors.textSecondary;
  const cardColor = isDark ? colors.cardDark : colors.card;
  const primaryColor = isDark ? colors.primaryDark : colors.primary;

  const handleAddPhoto = () => {
    console.log('User tapped Add Photo');
  };

  const handleAddVideo = () => {
    console.log('User tapped Add Video');
  };

  const handleAddStory = () => {
    console.log('User tapped Add Story');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: textColor }]}>Create Post</Text>
      </View>

      <View style={styles.content}>
        <Text style={[styles.subtitle, { color: textSecondaryColor }]}>
          Share your travel moments
        </Text>

        <View style={styles.optionsContainer}>
          <TouchableOpacity 
            style={[styles.optionCard, { backgroundColor: cardColor }]}
            onPress={handleAddPhoto}
          >
            <View style={[styles.iconCircle, { backgroundColor: primaryColor }]}>
              <IconSymbol 
                ios_icon_name="camera.fill"
                android_material_icon_name="photo-camera" 
                size={32} 
                color="#FFFFFF"
              />
            </View>
            <Text style={[styles.optionTitle, { color: textColor }]}>Add Photo</Text>
            <Text style={[styles.optionDescription, { color: textSecondaryColor }]}>
              Share a photo from your travels
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.optionCard, { backgroundColor: cardColor }]}
            onPress={handleAddVideo}
          >
            <View style={[styles.iconCircle, { backgroundColor: primaryColor }]}>
              <IconSymbol 
                ios_icon_name="video.fill"
                android_material_icon_name="videocam" 
                size={32} 
                color="#FFFFFF"
              />
            </View>
            <Text style={[styles.optionTitle, { color: textColor }]}>Add Video</Text>
            <Text style={[styles.optionDescription, { color: textSecondaryColor }]}>
              Share a video from your adventures
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.optionCard, { backgroundColor: cardColor }]}
            onPress={handleAddStory}
          >
            <View style={[styles.iconCircle, { backgroundColor: primaryColor }]}>
              <IconSymbol 
                ios_icon_name="book.fill"
                android_material_icon_name="auto-stories" 
                size={32} 
                color="#FFFFFF"
              />
            </View>
            <Text style={[styles.optionTitle, { color: textColor }]}>Add Story</Text>
            <Text style={[styles.optionDescription, { color: textSecondaryColor }]}>
              Share a quick story or update
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 32,
    textAlign: 'center',
  },
  optionsContainer: {
    gap: 16,
  },
  optionCard: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  optionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  optionDescription: {
    fontSize: 14,
    textAlign: 'center',
  },
});
