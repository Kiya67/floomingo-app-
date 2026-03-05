
import React, { useState, useEffect } from "react";
import { IconSymbol } from "@/components/IconSymbol";
import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text, StyleSheet, TouchableOpacity, useColorScheme, TextInput, ScrollView, Alert, ActivityIndicator, Platform } from "react-native";
import { colors } from "@/styles/commonStyles";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { supabase } from '@/lib/supabase';
import { uploadFileToSupabase } from '@/utils/supabaseHelpers';
import { useVideoPlayer, VideoView } from 'expo-video';
import { authenticatedPost } from '@/utils/api';

interface SelectedLocation {
  place_id: string;
  main_text: string;
  location_type: string;
}

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
  const [selectedLocations, setSelectedLocations] = useState<SelectedLocation[]>([]);
  const [isPosting, setIsPosting] = useState(false);

  const player = useVideoPlayer(videoUri || '', (player) => {
    player.loop = true;
    player.muted = true;
  });

  useEffect(() => {
    console.log('AddScreen (iOS) mounted');
    return () => console.log('AddScreen (iOS) unmounted');
  }, []);

  useEffect(() => {
    if (params.selectedPlaceId && params.selectedPlaceName && params.selectedLocationType) {
      console.log('Location selected from search (iOS) - ADDING to locations array:', {
        placeId: params.selectedPlaceId,
        placeName: params.selectedPlaceName,
        locationType: params.selectedLocationType,
        currentLocations: selectedLocations.length,
      });
      
      const newLocation: SelectedLocation = {
        place_id: params.selectedPlaceId as string,
        main_text: params.selectedPlaceName as string,
        location_type: params.selectedLocationType as string,
      };
      
      const alreadyExists = selectedLocations.some(loc => loc.place_id === newLocation.place_id);
      
      if (!alreadyExists) {
        setSelectedLocations(prev => [...prev, newLocation]);
        console.log('Location added successfully. Total locations:', selectedLocations.length + 1);
      } else {
        console.log('Location already exists in array, skipping duplicate');
      }
      
      router.setParams({
        selectedPlaceId: undefined,
        selectedPlaceName: undefined,
        selectedLocationType: undefined,
      });
    }
  }, [params.selectedPlaceId, params.selectedPlaceName, params.selectedLocationType, router, selectedLocations]);

  const pickVideo = async () => {
    console.log('User tapped Pick Video button (iOS)');
    
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
    console.log('User tapped Post button (iOS)');
    
    if (!videoUri) {
      Alert.alert('Select a video', 'Please select a video to post');
      return;
    }

    setIsPosting(true);
    
    try {
      console.log('Starting post creation process with', selectedLocations.length, 'locations');
      
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.error('No authenticated user found');
        Alert.alert('Error', 'You must be logged in to post');
        setIsPosting(false);
        return;
      }

      console.log('Authenticated user ID:', user.id);

      const timestamp = Date.now();
      const videoPath = `videos/${user.id}/${timestamp}.mp4`;
      const thumbPath = `thumbs/${user.id}/${timestamp}.jpg`;
      
      console.log('Video path for video_public bucket:', videoPath);
      console.log('Thumbnail path for video_public bucket:', thumbPath);

      console.log('Step 1: Uploading video to Supabase Storage (iOS)');
      const videoUploadResult = await uploadFileToSupabase(
        videoUri,
        videoPath,
        'video_public',
        'video/mp4'
      );
      console.log('✅ Video uploaded successfully:', videoUploadResult.publicUrl);

      console.log('Step 2: Generating thumbnail from video');
      const { uri: thumbnailUri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
        time: 0,
      });
      console.log('Thumbnail generated:', thumbnailUri);

      console.log('Step 3: Uploading thumbnail to Supabase Storage (iOS)');
      const thumbnailUploadResult = await uploadFileToSupabase(
        thumbnailUri,
        thumbPath,
        'video_public',
        'image/jpeg'
      );
      console.log('✅ Thumbnail uploaded successfully:', thumbnailUploadResult.publicUrl);

      console.log('Step 4: Creating post via backend API (iOS)');
      
      const firstLocation = selectedLocations[0] || null;
      
      const locationsPayload = selectedLocations.map((loc) => ({
        place_id: loc.place_id,
        place_name: loc.main_text,
        location_type: loc.location_type,
      }));

      const postPayload: any = {
        caption: caption.trim() || '',
        video_url: videoUploadResult.publicUrl,
        thumbnail_url: thumbnailUploadResult.publicUrl,
      };

      if (firstLocation) {
        postPayload.place_id = firstLocation.place_id;
        postPayload.place_name = firstLocation.main_text;
        postPayload.location_type = firstLocation.location_type;
      }

      if (locationsPayload.length > 0) {
        postPayload.locations = locationsPayload;
      }

      console.log('[API] POST /api/posts payload (iOS):', JSON.stringify(postPayload, null, 2));

      const createdPost = await authenticatedPost('/api/posts', postPayload);

      if (!createdPost || !createdPost.id) {
        throw new Error('Failed to create post via API');
      }

      console.log('✅ Post created successfully via backend API (iOS), post ID:', createdPost.id);

      Alert.alert('Posted!', 'Your video has been posted successfully');
      
      setVideoUri(null);
      setCaption('');
      setSelectedLocations([]);
      
      console.log('Navigating to Home tab');
      router.replace('/(tabs)/(home)');
      
    } catch (error: any) {
      console.error('Error posting video:', error);
      Alert.alert('Error', error.message || 'Failed to post video. Please try again.');
    } finally {
      setIsPosting(false);
    }
  };

  const handleOpenLocationSearch = () => {
    console.log('User tapped location field, opening search (iOS) - preserving form state (video + caption + existing locations)');
    router.push('/search-location');
  };

  const handleRemoveLocation = (placeId: string) => {
    console.log('User tapped remove location:', placeId);
    setSelectedLocations(prev => prev.filter(loc => loc.place_id !== placeId));
  };

  const captionPlaceholder = 'Share your travel story...';
  const locationPlaceholder = 'Add location (optional)';
  const addMoreLocationText = 'Add another location';

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
            <View style={styles.videoPreviewContainer}>
              <VideoView
                player={player}
                style={styles.videoPreview}
                contentFit="cover"
                nativeControls={false}
              />
              <View style={styles.videoOverlay}>
                <View style={[styles.videoBadge, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
                  <IconSymbol 
                    ios_icon_name="checkmark.circle.fill"
                    android_material_icon_name="check-circle" 
                    size={20} 
                    color="#4ADE80"
                  />
                  <Text style={styles.videoBadgeText}>Video Ready</Text>
                </View>
              </View>
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
              <Text style={[styles.inputLabel, { color: textColor }]}>Locations</Text>
              <Text style={[styles.optionalLabel, { color: textSecondaryColor }]}>(optional)</Text>
            </View>
            
            {selectedLocations.length > 0 && (
              <View style={styles.selectedLocationsContainer}>
                {selectedLocations.map((location, index) => (
                  <View 
                    key={location.place_id}
                    style={[styles.locationChip, { backgroundColor: isDark ? '#333' : '#F3F4F6' }]}
                  >
                    <IconSymbol 
                      ios_icon_name="mappin.circle.fill"
                      android_material_icon_name="location-on" 
                      size={16} 
                      color={primaryColor}
                    />
                    <Text style={[styles.locationChipText, { color: textColor }]} numberOfLines={1}>
                      {location.main_text}
                    </Text>
                    <TouchableOpacity 
                      onPress={() => handleRemoveLocation(location.place_id)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <IconSymbol 
                        ios_icon_name="xmark.circle.fill"
                        android_material_icon_name="cancel" 
                        size={18} 
                        color={textSecondaryColor}
                      />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
            
            <TouchableOpacity
              style={[styles.locationButton, { 
                backgroundColor: cardColor,
                borderColor: isDark ? '#333' : '#E5E7EB'
              }]}
              onPress={handleOpenLocationSearch}
            >
              <Text style={[
                styles.locationButtonText,
                { color: selectedLocations.length > 0 ? primaryColor : textSecondaryColor }
              ]}>
                {selectedLocations.length > 0 ? addMoreLocationText : locationPlaceholder}
              </Text>
              <IconSymbol 
                ios_icon_name="plus"
                android_material_icon_name="add" 
                size={20} 
                color={selectedLocations.length > 0 ? primaryColor : textSecondaryColor}
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
  videoPreviewContainer: {
    height: 400,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  videoPreview: {
    width: '100%',
    height: '100%',
  },
  videoOverlay: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  videoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  videoBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
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
  selectedLocationsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    maxWidth: '100%',
  },
  locationChipText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
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
