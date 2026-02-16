
import React, { useState, useEffect } from "react";
import { IconSymbol } from "@/components/IconSymbol";
import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text, StyleSheet, TouchableOpacity, useColorScheme, TextInput, ScrollView, Alert, ActivityIndicator, Platform } from "react-native";
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
  const [selectedLocationType, setSelectedLocationType] = useState<string>('');
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
      setSelectedLocationType(params.selectedLocationType as string);
    }
  }, [params.selectedPlaceId, params.selectedPlaceName, params.selectedLocationType]);

  const pickVideo = async () => {
    console.log('User tapped Pick Video button');
    
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        console.log('Media library permission denied');
        Alert.alert('Permission Required', 'Permission to access media library is required!');
        return;
      }

      console.log('Launching image library picker for videos');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        quality: 1,
        videoMaxDuration: 120,
      });

      console.log('Image picker result:', { canceled: result.canceled, assetsCount: result.assets?.length });

      if (!result.canceled && result.assets && result.assets[0]) {
        console.log('Video selected successfully:', result.assets[0].uri);
        setVideoUri(result.assets[0].uri);
      } else {
        console.log('Video selection was canceled or no assets returned');
      }
    } catch (error) {
      console.error('Error picking video:', error);
      Alert.alert('Error', 'Failed to pick video. Please try again.');
    }
  };

  const handlePost = async () => {
    console.log('User tapped Post button');
    
    if (!videoUri) {
      Alert.alert('No Video', 'Please select a video first');
      return;
    }

    if (!caption.trim()) {
      Alert.alert('No Caption', 'Please add a caption for your video');
      return;
    }

    setUploading(true);
    
    try {
      console.log('Starting video upload process');
      console.log('Upload data:', {
        videoUri,
        caption,
        place_id: selectedPlaceId,
        place_name: selectedPlaceName,
        location_type: selectedLocationType,
      });

      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.error('No authenticated user found');
        Alert.alert('Error', 'You must be logged in to post');
        setUploading(false);
        return;
      }

      console.log('Authenticated user ID:', user.id);

      const fileExt = videoUri.split('.').pop() || 'mp4';
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      console.log('Preparing video file for upload');
      
      let uploadData;
      let uploadError;

      if (Platform.OS === 'web') {
        console.log('Web platform: Fetching video blob from URI:', videoUri);
        const response = await fetch(videoUri);
        const blob = await response.blob();
        console.log('Video blob size:', blob.size, 'bytes');
        
        const result = await supabase.storage
          .from('videos')
          .upload(fileName, blob, {
            cacheControl: '3600',
            upsert: false,
            contentType: `video/${fileExt}`,
          });
        
        uploadData = result.data;
        uploadError = result.error;
      } else {
        console.log('Native platform: Uploading video from URI:', videoUri);
        const result = await supabase.storage
          .from('videos')
          .upload(fileName, {
            uri: videoUri,
            type: `video/${fileExt}`,
            name: fileName,
          } as any, {
            cacheControl: '3600',
            upsert: false,
          });
        
        uploadData = result.data;
        uploadError = result.error;
      }

      if (uploadError) {
        console.error('Supabase upload error:', uploadError);
        Alert.alert('Upload Error', uploadError.message);
        setUploading(false);
        return;
      }

      console.log('Video uploaded successfully to storage:', uploadData);

      const { data: { publicUrl } } = supabase.storage
        .from('videos')
        .getPublicUrl(fileName);

      console.log('Video public URL generated:', publicUrl);

      console.log('Creating post record in database');
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
        setUploading(false);
        return;
      }

      console.log('Post created successfully in database:', postData);
      
      Alert.alert('Success', 'Video posted successfully!');
      
      setVideoUri(null);
      setCaption('');
      setSelectedPlaceId('');
      setSelectedPlaceName('');
      setSelectedLocationType('');
      
      console.log('Navigating to home tab');
      router.push('/(tabs)/(home)');
    } catch (error) {
      console.error('Unexpected error posting video:', error);
      Alert.alert('Error', 'Failed to post video. Please try again.');
    } finally {
      setUploading(false);
    }
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
        <Text style={[styles.headerTitle, { color: textColor }]}>Create Post</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {!videoUri ? (
          <View style={styles.videoPickerSection}>
            <TouchableOpacity 
              style={[styles.videoPlaceholder, { backgroundColor: cardColor }]}
              onPress={pickVideo}
            >
              <IconSymbol 
                ios_icon_name="video.fill"
                android_material_icon_name="videocam" 
                size={64} 
                color={primaryColor}
              />
              <Text style={[styles.placeholderText, { color: textColor }]}>
                Tap to select video
              </Text>
              <Text style={[styles.placeholderSubtext, { color: textSecondaryColor }]}>
                Up to 2 minutes
              </Text>
            </TouchableOpacity>
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
                Video ready to post
              </Text>
            </View>

            <TouchableOpacity 
              style={[styles.changeButton, { borderColor: primaryColor }]}
              onPress={pickVideo}
            >
              <IconSymbol 
                ios_icon_name="pencil"
                android_material_icon_name="edit" 
                size={20} 
                color={primaryColor}
              />
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
                { color: selectedPlaceName ? '#FF69B4' : textSecondaryColor }
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
              <>
                <ActivityIndicator color="#FFFFFF" />
                <Text style={styles.postButtonText}>Uploading...</Text>
              </>
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
  },
  headerTitle: {
    fontSize: 28,
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
    height: 400,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#999',
  },
  placeholderText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  placeholderSubtext: {
    fontSize: 14,
    marginTop: 4,
  },
  videoSelectedSection: {
    marginTop: 24,
  },
  videoPreview: {
    height: 280,
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
  changeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    gap: 8,
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
    fontWeight: '600',
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
