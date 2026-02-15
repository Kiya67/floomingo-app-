
import React, { useState, useEffect } from "react";
import { IconSymbol } from "@/components/IconSymbol";
import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text, StyleSheet, TouchableOpacity, useColorScheme, TextInput, ScrollView, Alert, ActivityIndicator } from "react-native";
import { colors } from "@/styles/commonStyles";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';

export default function AddScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const bgColor = isDark ? colors.backgroundDark : colors.background;
  const textColor = isDark ? colors.textDark : colors.text;
  const textSecondaryColor = isDark ? colors.textSecondaryDark : colors.textSecondary;
  const cardColor = isDark ? colors.cardDark : colors.card;
  const primaryColor = isDark ? colors.primaryDark : colors.primary;

  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [selectedPlaceId, setSelectedPlaceId] = useState<string>('');
  const [selectedPlaceName, setSelectedPlaceName] = useState<string>('');
  const [selectedLocationType, setSelectedLocationType] = useState<'city' | 'place' | ''>('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (params.selectedPlaceId && params.selectedPlaceName && params.selectedLocationType) {
      console.log('Location selected from search:', {
        placeId: params.selectedPlaceId,
        placeName: params.selectedPlaceName,
        locationType: params.selectedLocationType,
      });
      
      setSelectedPlaceId(params.selectedPlaceId as string);
      setSelectedPlaceName(params.selectedPlaceName as string);
      setSelectedLocationType(params.selectedLocationType as 'city' | 'place');
    }
  }, [params.selectedPlaceId, params.selectedPlaceName, params.selectedLocationType]);

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
      videoMaxDuration: 120, // 2 minutes = 120 seconds
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
      videoMaxDuration: 120, // 2 minutes = 120 seconds
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
      console.log('Uploading video with data:', {
        caption,
        place_id: selectedPlaceId,
        place_name: selectedPlaceName,
        location_type: selectedLocationType,
      });

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        Alert.alert('Error', 'You must be logged in to post');
        return;
      }

      // Upload video to Supabase storage
      const fileExt = videoUri.split('.').pop() || 'mp4';
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      // Fetch the video file
      const response = await fetch(videoUri);
      const blob = await response.blob();
      
      console.log('Uploading video to storage:', fileName);
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('videos')
        .upload(fileName, blob, {
          cacheControl: '3600',
          upsert: false,
          contentType: `video/${fileExt}`,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        Alert.alert('Upload Error', uploadError.message);
        return;
      }

      console.log('Video uploaded successfully:', uploadData);

      // Get public URL for the video
      const { data: { publicUrl } } = supabase.storage
        .from('videos')
        .getPublicUrl(fileName);

      console.log('Video public URL:', publicUrl);

      // Insert post into database
      const { data: postData, error: postError } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          video_url: publicUrl,
          caption: caption.trim(),
          place_id: selectedPlaceId || null,
          place_name: selectedPlaceName || null,
          location_type: selectedLocationType || null,
        })
        .select()
        .single();

      if (postError) {
        console.error('Post creation error:', postError);
        Alert.alert('Error', 'Failed to create post: ' + postError.message);
        return;
      }

      console.log('Post created successfully:', postData);
      
      Alert.alert('Success', 'Video posted successfully!');
      
      // Reset form
      setVideoUri(null);
      setCaption('');
      setSelectedPlaceId('');
      setSelectedPlaceName('');
      setSelectedLocationType('');
      
      // Navigate to home to see the new post
      router.push('/(tabs)/(home)');
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
    setSelectedPlaceId('');
    setSelectedPlaceName('');
    setSelectedLocationType('');
  };

  const handleOpenLocationSearch = () => {
    console.log('User tapped location field, opening search');
    router.push('/search-location');
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
                ios_icon_name="video.fill"
                android_material_icon_name="videocam" 
                size={64} 
                color={textSecondaryColor}
              />
              <Text style={[styles.placeholderText, { color: textSecondaryColor }]}>
                No video selected
              </Text>
              <Text style={[styles.placeholderSubtext, { color: textSecondaryColor }]}>
                Up to 2 minutes
              </Text>
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: primaryColor }]}
                onPress={pickVideo}
              >
                <IconSymbol 
                  ios_icon_name="photo.on.rectangle"
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
                  ios_icon_name="video.fill"
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
                ios_icon_name="checkmark.circle.fill"
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
                ios_icon_name="text.alignleft"
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
                ios_icon_name="location.fill"
                android_material_icon_name="location-on" 
                size={20} 
                color={textColor}
              />
              <Text style={[styles.inputLabel, { color: textColor }]}>Location</Text>
            </View>
            <TouchableOpacity
              style={[styles.locationButton, { 
                backgroundColor: cardColor,
                borderColor: isDark ? '#333' : '#E5E7EB'
              }]}
              onPress={handleOpenLocationSearch}
            >
              <Text style={[
                styles.locationButtonText,
                { color: selectedPlaceName ? textColor : textSecondaryColor }
              ]}>
                {selectedPlaceName || locationPlaceholder}
              </Text>
              <IconSymbol 
                ios_icon_name="chevron.right"
                android_material_icon_name="arrow-forward" 
                size={20} 
                color={textSecondaryColor}
              />
            </TouchableOpacity>
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
                  ios_icon_name="paperplane.fill"
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
  placeholderSubtext: {
    fontSize: 14,
    marginTop: 4,
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
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  locationButtonText: {
    fontSize: 16,
    flex: 1,
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
