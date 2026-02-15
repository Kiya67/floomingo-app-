
import React, { useState } from "react";
import { IconSymbol } from "@/components/IconSymbol";
import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text, StyleSheet, TouchableOpacity, useColorScheme, TextInput, ScrollView, Alert, ActivityIndicator } from "react-native";
import { colors } from "@/styles/commonStyles";
import * as ImagePicker from 'expo-image-picker';

export default function AddScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const bgColor = isDark ? colors.backgroundDark : colors.background;
  const textColor = isDark ? colors.textDark : colors.text;
  const textSecondaryColor = isDark ? colors.textSecondaryDark : colors.textSecondary;
  const cardColor = isDark ? colors.cardDark : colors.card;
  const primaryColor = isDark ? colors.primaryDark : colors.primary;

  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [uploading, setUploading] = useState(false);

  const pickVideo = async () => {
    console.log('User tapped Pick Video button');
    
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'Permission to access media library is required!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: true,
      quality: 1,
      videoMaxDuration: 60,
    });

    if (!result.canceled && result.assets[0]) {
      console.log('Video selected:', result.assets[0].uri);
      setVideoUri(result.assets[0].uri);
    }
  };

  const recordVideo = async () => {
    console.log('User tapped Record Video button');
    
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'Permission to access camera is required!');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['videos'],
      allowsEditing: true,
      quality: 1,
      videoMaxDuration: 60,
    });

    if (!result.canceled && result.assets[0]) {
      console.log('Video recorded:', result.assets[0].uri);
      setVideoUri(result.assets[0].uri);
    }
  };

  const handlePost = async () => {
    console.log('User tapped Post button');
    
    if (!videoUri) {
      Alert.alert('No Video', 'Please select or record a video first');
      return;
    }

    if (!caption.trim()) {
      Alert.alert('No Caption', 'Please add a caption for your video');
      return;
    }

    setUploading(true);
    
    try {
      console.log('Uploading video with caption:', caption, 'and location:', location);
      
      // TODO: Backend Integration - POST /api/videos with multipart form data
      // Body: { video: File, caption: string, location: string }
      // Returns: { id, videoUrl, caption, location, createdAt }
      
      Alert.alert('Success', 'Video posted successfully!');
      
      setVideoUri(null);
      setCaption('');
      setLocation('');
    } catch (error) {
      console.error('Error posting video:', error);
      Alert.alert('Error', 'Failed to post video. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleClear = () => {
    console.log('User tapped Clear button');
    setVideoUri(null);
    setCaption('');
    setLocation('');
  };

  const captionPlaceholder = 'Share your travel story...';
  const locationPlaceholder = 'Add location';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: textColor }]}>Create Video Post</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {!videoUri ? (
          <View style={styles.videoPickerSection}>
            <View style={[styles.videoPlaceholder, { backgroundColor: cardColor }]}>
              <IconSymbol 
                android_material_icon_name="videocam" 
                size={64} 
                color={textSecondaryColor}
              />
              <Text style={[styles.placeholderText, { color: textSecondaryColor }]}>
                No video selected
              </Text>
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: primaryColor }]}
                onPress={pickVideo}
              >
                <IconSymbol 
                  android_material_icon_name="photo-library" 
                  size={24} 
                  color="#FFFFFF"
                />
                <Text style={styles.actionButtonText}>Choose Video</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: primaryColor }]}
                onPress={recordVideo}
              >
                <IconSymbol 
                  android_material_icon_name="videocam" 
                  size={24} 
                  color="#FFFFFF"
                />
                <Text style={styles.actionButtonText}>Record Video</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.videoSelectedSection}>
            <View style={[styles.videoPreview, { backgroundColor: cardColor }]}>
              <IconSymbol 
                android_material_icon_name="check-circle" 
                size={64} 
                color={primaryColor}
              />
              <Text style={[styles.videoSelectedText, { color: textColor }]}>
                Video selected
              </Text>
              <Text style={[styles.videoUriText, { color: textSecondaryColor }]} numberOfLines={1}>
                {videoUri}
              </Text>
            </View>

            <TouchableOpacity 
              style={[styles.changeButton, { borderColor: primaryColor }]}
              onPress={handleClear}
            >
              <Text style={[styles.changeButtonText, { color: primaryColor }]}>Change Video</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.formSection}>
          <View style={styles.inputContainer}>
            <View style={styles.inputHeader}>
              <IconSymbol 
                android_material_icon_name="description" 
                size={20} 
                color={textColor}
              />
              <Text style={[styles.inputLabel, { color: textColor }]}>Caption</Text>
            </View>
            <TextInput
              style={[styles.captionInput, { 
                backgroundColor: cardColor, 
                color: textColor,
                borderColor: isDark ? '#333' : '#E5E7EB'
              }]}
              placeholder={captionPlaceholder}
              placeholderTextColor={textSecondaryColor}
              value={caption}
              onChangeText={setCaption}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.inputContainer}>
            <View style={styles.inputHeader}>
              <IconSymbol 
                android_material_icon_name="location-on" 
                size={20} 
                color={textColor}
              />
              <Text style={[styles.inputLabel, { color: textColor }]}>Location</Text>
            </View>
            <TextInput
              style={[styles.locationInput, { 
                backgroundColor: cardColor, 
                color: textColor,
                borderColor: isDark ? '#333' : '#E5E7EB'
              }]}
              placeholder={locationPlaceholder}
              placeholderTextColor={textSecondaryColor}
              value={location}
              onChangeText={setLocation}
            />
          </View>
        </View>

        {videoUri && (
          <TouchableOpacity 
            style={[styles.postButton, { 
              backgroundColor: primaryColor,
              opacity: uploading ? 0.6 : 1
            }]}
            onPress={handlePost}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <IconSymbol 
                  android_material_icon_name="send" 
                  size={24} 
                  color="#FFFFFF"
                />
                <Text style={styles.postButtonText}>Post Video</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
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
  },
  videoPickerSection: {
    marginTop: 24,
  },
  videoPlaceholder: {
    height: 240,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  placeholderText: {
    fontSize: 16,
    marginTop: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  videoSelectedSection: {
    marginTop: 24,
  },
  videoPreview: {
    height: 200,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  videoSelectedText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  videoUriText: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  changeButton: {
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
  },
  changeButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  formSection: {
    marginTop: 24,
    gap: 20,
  },
  inputContainer: {
    gap: 8,
  },
  inputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  captionInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
  },
  locationInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    fontSize: 16,
  },
  postButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 24,
    marginBottom: 32,
    gap: 8,
  },
  postButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
