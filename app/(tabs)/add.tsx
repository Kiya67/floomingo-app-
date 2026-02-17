
import React, { useState } from "react";
import { IconSymbol } from "@/components/IconSymbol";
import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text, StyleSheet, TouchableOpacity, useColorScheme, TextInput, ScrollView, Alert, ActivityIndicator, Platform } from "react-native";
import { colors } from "@/styles/commonStyles";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { supabase } from '@/lib/supabase';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

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
  const [selectedPlace, setSelectedPlace] = useState<{
    place_id: string;
    main_text: string;
    location_type: string;
  } | null>(null);
  const [isPosting, setIsPosting] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      console.log('Add screen focused, checking for location params');
      if (params.selectedPlaceId && params.selectedPlaceName && params.selectedLocationType) {
        console.log('Location selected from search:', {
          placeId: params.selectedPlaceId,
          placeName: params.selectedPlaceName,
          locationType: params.selectedLocationType,
        });
        
        setSelectedPlace({
          place_id: params.selectedPlaceId as string,
          main_text: params.selectedPlaceName as string,
          location_type: params.selectedLocationType as string,
        });
      }
    }, [params.selectedPlaceId, params.selectedPlaceName, params.selectedLocationType])
  );

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
    
    // Step 1: Validate
    if (!videoUri) {
      Alert.alert('Select a video', 'Please select a video to post');
      return;
    }

    // Disable Post button + show loading
    setIsPosting(true);
    
    try {
      console.log('Starting post creation process');
      
      // Get authenticated user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.error('No authenticated user found');
        Alert.alert('Error', 'You must be logged in to post');
        setIsPosting(false);
        return;
      }

      console.log('Authenticated user ID:', user.id);

      // Step 2: Create IDs + paths for video_public bucket
      const postId = uuidv4();
      const timestamp = Date.now();
      const videoPath = `videos/${user.id}/${timestamp}.mp4`;
      const thumbPath = `thumbs/${user.id}/${timestamp}.jpg`;
      
      console.log('Generated postId:', postId);
      console.log('Video path for video_public bucket:', videoPath);
      console.log('Thumbnail path for video_public bucket:', thumbPath);

      // Step 3: Upload VIDEO to Supabase Storage (video_public bucket)
      console.log('Step 3: Uploading video to video_public bucket');
      
      const videoFormData = new FormData();
      
      const videoFile = {
        uri: videoUri,
        type: 'video/mp4',
        name: `${timestamp}.mp4`,
      } as any;
      
      videoFormData.append('file', videoFile);
      
      console.log('Uploading video via FormData to video_public bucket');
      
      const { data: videoUploadData, error: videoUploadError } = await supabase.storage
        .from('video_public')
        .upload(videoPath, videoFormData, {
          contentType: 'video/mp4',
          cacheControl: '3600',
          upsert: false,
        });

      if (videoUploadError) {
        console.error('Video upload error:', videoUploadError);
        throw videoUploadError;
      }

      console.log('Video uploaded successfully to video_public:', videoUploadData);

      // Step 4: Get PUBLIC URL for video (no signed URL needed)
      const { data: videoPublicUrlData } = supabase.storage
        .from('video_public')
        .getPublicUrl(videoPath);
      
      if (!videoPublicUrlData?.publicUrl) {
        throw new Error('Failed to get public URL for video');
      }
      
      const videoPublicUrl = videoPublicUrlData.publicUrl;
      console.log('✅ VIDEO UPLOAD SUCCESS - Bucket: video_public, Path:', videoPath, 'Public URL:', videoPublicUrl);

      // Step 5: Generate THUMBNAIL (client side)
      console.log('Step 5: Generating thumbnail from video');
      
      const { uri: thumbnailUri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
        time: 0, // First frame
      });
      
      console.log('Thumbnail generated:', thumbnailUri);

      // Step 6: Upload THUMBNAIL to Supabase Storage (video_public bucket)
      console.log('Step 6: Uploading thumbnail to video_public bucket');
      
      const thumbnailFormData = new FormData();
      
      const thumbnailFile = {
        uri: thumbnailUri,
        type: 'image/jpeg',
        name: `${timestamp}.jpg`,
      } as any;
      
      thumbnailFormData.append('file', thumbnailFile);
      
      console.log('Uploading thumbnail via FormData to video_public bucket');
      
      const { data: thumbnailUploadData, error: thumbnailUploadError } = await supabase.storage
        .from('video_public')
        .upload(thumbPath, thumbnailFormData, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: false,
        });

      if (thumbnailUploadError) {
        console.error('Thumbnail upload error:', thumbnailUploadError);
        throw thumbnailUploadError;
      }

      console.log('Thumbnail uploaded successfully to video_public:', thumbnailUploadData);

      // Get public URL for thumbnail
      const { data: thumbnailPublicUrlData } = supabase.storage
        .from('video_public')
        .getPublicUrl(thumbPath);
      
      const thumbnailPublicUrl = thumbnailPublicUrlData.publicUrl;
      console.log('✅ THUMBNAIL UPLOAD SUCCESS - Bucket: video_public, Path:', thumbPath, 'Public URL:', thumbnailPublicUrl);

      // Step 7: Insert DB row into posts with PUBLIC URL
      console.log('Step 7: Inserting post into database with public URLs');
      
      const { error: insertError } = await supabase
        .from('posts')
        .insert({
          id: postId,
          user_id: user.id,
          video_url: videoPublicUrl, // Store full public HTTPS URL
          thumbnail_url: thumbnailPublicUrl,
          caption: caption.trim() || null,
          place_id: selectedPlace?.place_id || null,
          place_name: selectedPlace?.main_text || null,
          location_type: selectedPlace?.location_type || null,
        });

      if (insertError) {
        console.error('Post insert error:', insertError);
        throw insertError;
      }

      console.log('✅ Post created successfully in database with public URLs - Video:', videoPublicUrl, 'Thumbnail:', thumbnailPublicUrl);

      // Step 8: Success UX
      Alert.alert('Posted!', 'Your video has been posted successfully');
      
      // Clear fields
      setVideoUri(null);
      setCaption('');
      setSelectedPlace(null);
      
      // Navigate to Home
      console.log('Navigating to Home tab');
      router.replace('/(tabs)/(home)');
      
    } catch (error: any) {
      // Step 9: Error handling
      console.error('Error posting video:', error);
      Alert.alert('Error', error.message || 'Failed to post video. Please try again.');
    } finally {
      // Re-enable Post button + stop loading
      setIsPosting(false);
    }
  };

  const handleOpenLocationSearch = () => {
    console.log('User tapped location field, opening search');
    router.push('/search-location');
  };

  const captionPlaceholder = 'Share your travel story...';
  const locationPlaceholder = 'Add location (optional)';
  const selectedPlaceText = selectedPlace?.main_text || locationPlaceholder;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: textColor }]}>Create Post</Text>
      </View>

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
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
                ios_icon_name="doc.text"
                android_material_icon_name="description" 
                size={20} 
                color={textColor}
              />
              <Text style={[styles.inputLabel, { color: textColor }]}>Caption</Text>
              <Text style={[styles.optionalLabel, { color: textSecondaryColor }]}>(optional)</Text>
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
              <Text style={[styles.optionalLabel, { color: textSecondaryColor }]}>(optional)</Text>
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
                { color: selectedPlace ? primaryColor : textSecondaryColor }
              ]}>
                {selectedPlaceText}
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

        <TouchableOpacity 
          style={[styles.postButton, { 
            backgroundColor: videoUri ? primaryColor : '#999',
            opacity: isPosting ? 0.6 : 1
          }]}
          onPress={handlePost}
          disabled={!videoUri || isPosting}
        >
          {isPosting ? (
            <>
              <ActivityIndicator color="#FFFFFF" />
              <Text style={styles.postButtonText}>Posting...</Text>
            </>
          ) : (
            <>
              <IconSymbol 
                ios_icon_name="paperplane.fill"
                android_material_icon_name="send" 
                size={24} 
                color="#FFFFFF"
              />
              <Text style={styles.postButtonText}>Post</Text>
            </>
          )}
        </TouchableOpacity>
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
  scrollContent: {
    paddingBottom: 120,
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
  optionalLabel: {
    fontSize: 14,
    fontStyle: 'italic',
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
    gap: 8,
  },
  postButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
