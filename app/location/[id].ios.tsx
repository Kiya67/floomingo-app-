
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useColorScheme, ActivityIndicator, Dimensions, RefreshControl, Linking, Alert } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { VideoGridItem } from '@/components/VideoGridItem';

interface Post {
  id: string;
  user_id: string;
  video_url: string;
  thumbnail_url: string;
  caption: string;
  place_id: string | null;
  place_name: string | null;
  location_type: string | null;
  created_at: string;
  view_count?: number;
  profiles?: {
    display_name: string;
    avatar_url: string | null;
  };
}

interface LocationDetails {
  name: string;
  formatted_address?: string;
  rating?: number;
  opening_hours?: {
    open_now?: boolean;
    weekday_text?: string[];
  };
}

const { width } = Dimensions.get('window');
const gridItemSize = (width - 48) / 3;

export default function LocationDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const bgColor = isDark ? colors.backgroundDark : colors.background;
  const textColor = isDark ? colors.textDark : colors.text;
  const textSecondaryColor = isDark ? colors.textSecondaryDark : colors.textSecondary;
  const cardColor = isDark ? colors.cardDark : colors.card;
  const primaryColor = isDark ? colors.primaryDark : colors.primary;

  const [locationDetails, setLocationDetails] = useState<LocationDetails | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLocationDetails = useCallback(async () => {
    console.log('Fetching location details for place_id:', id);
    try {
      const { data, error } = await supabase.functions.invoke('places-details', {
        body: JSON.stringify({ place_id: id }),
      });

      if (error) {
        console.error('Error fetching location details:', error);
        console.log('Attempting fallback to place-details function');
        
        const { data: fallbackData, error: fallbackError } = await supabase.functions.invoke('place-details', {
          body: JSON.stringify({ place_id: id }),
        });
        
        if (fallbackError) {
          console.error('Fallback also failed:', fallbackError);
        } else {
          console.log('Fallback location details fetched:', fallbackData);
          setLocationDetails(fallbackData?.result || fallbackData || null);
        }
      } else {
        console.log('Location details fetched:', data);
        setLocationDetails(data?.result || data || null);
      }
    } catch (error) {
      console.error('Error in fetchLocationDetails:', error);
    }
  }, [id]);

  const fetchLocationPosts = useCallback(async () => {
    console.log('Fetching posts for location:', id);
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles!posts_user_id_fkey (
            display_name,
            avatar_url
          )
        `)
        .eq('place_id', id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching location posts:', error);
      } else {
        console.log('Location posts fetched:', data?.length || 0, 'posts');
        console.log('Sample post data:', data?.[0]);
        setPosts(data || []);
      }
    } catch (error) {
      console.error('Error in fetchLocationPosts:', error);
    }
  }, [id]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchLocationDetails(), fetchLocationPosts()]);
      setLoading(false);
    };
    
    loadData();
  }, [fetchLocationDetails, fetchLocationPosts]);

  const onRefresh = async () => {
    console.log('User pulled to refresh location data');
    setRefreshing(true);
    await Promise.all([fetchLocationDetails(), fetchLocationPosts()]);
    setRefreshing(false);
  };

  const handleBack = () => {
    console.log('User tapped back button');
    router.back();
  };

  const handleDirections = async () => {
    console.log('User tapped Directions button');
    
    if (!id || typeof id !== 'string') {
      console.error('Missing Google Place ID');
      Alert.alert('Directions unavailable', 'Missing location ID');
      return;
    }
    
    const url = `https://www.google.com/maps/dir/?api=1&destination=place_id:${id}&travelmode=driving`;
    console.log('Opening directions URL:', url);
    
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
        console.log('Directions opened successfully');
      } else {
        console.error('Cannot open URL:', url);
        Alert.alert('Cannot open directions', 'Please install Google Maps');
      }
    } catch (error) {
      console.error('Error opening directions:', error);
      Alert.alert('Error opening directions', 'Please try again');
    }
  };

  const handleVideoPress = (post: Post) => {
    console.log('User tapped video:', post.id);
    router.push(`/video/${post.id}`);
  };

  const locationName = locationDetails?.name || 'Location';
  const address = locationDetails?.formatted_address || '';
  const rating = locationDetails?.rating || 0;
  const isOpen = locationDetails?.opening_hours?.open_now;
  const hours = locationDetails?.opening_hours?.weekday_text || [];

  const ratingText = rating > 0 ? `${rating.toFixed(1)} ★` : 'No rating';
  const statusText = isOpen !== undefined ? (isOpen ? 'Open now' : 'Closed') : 'Hours unknown';
  const videoCountText = `${posts.length} ${posts.length === 1 ? 'video' : 'videos'}`;

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: bgColor }]}>
        <Stack.Screen 
          options={{
            headerShown: true,
            title: 'Location',
            headerBackTitle: 'Back',
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={primaryColor} />
          <Text style={[styles.loadingText, { color: textColor }]}>Loading location...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <Stack.Screen 
        options={{
          headerShown: true,
          title: locationName,
          headerBackTitle: 'Back',
        }}
      />
      
      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={primaryColor}
            colors={[primaryColor]}
          />
        }
      >
        <View style={[styles.headerCard, { backgroundColor: cardColor }]}>
          <View style={styles.headerIcon}>
            <IconSymbol 
              ios_icon_name="location.fill"
              android_material_icon_name="location-on" 
              size={48} 
              color="#FF69B4"
            />
          </View>
          
          <Text style={[styles.locationName, { color: textColor }]}>{locationName}</Text>
          
          {address ? (
            <View style={styles.infoRow}>
              <IconSymbol 
                ios_icon_name="mappin.circle.fill"
                android_material_icon_name="place" 
                size={16} 
                color={textSecondaryColor}
              />
              <Text style={[styles.address, { color: textSecondaryColor }]}>{address}</Text>
            </View>
          ) : null}
          
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <IconSymbol 
                ios_icon_name="star.fill"
                android_material_icon_name="star" 
                size={20} 
                color="#FFD700"
              />
              <Text style={[styles.statText, { color: textColor }]}>{ratingText}</Text>
            </View>
            
            <View style={styles.statItem}>
              <IconSymbol 
                ios_icon_name="clock.fill"
                android_material_icon_name="schedule" 
                size={20} 
                color={isOpen ? '#4CAF50' : '#F44336'}
              />
              <Text style={[styles.statText, { color: textColor }]}>{statusText}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.directionsButton, { backgroundColor: primaryColor }]}
            onPress={handleDirections}
            activeOpacity={0.8}
          >
            <IconSymbol 
              ios_icon_name="arrow.triangle.turn.up.right.circle.fill"
              android_material_icon_name="directions" 
              size={24} 
              color="#FFFFFF"
            />
            <Text style={styles.directionsButtonText}>Get Directions</Text>
          </TouchableOpacity>

          {hours.length > 0 ? (
            <View style={styles.hoursSection}>
              <Text style={[styles.hoursTitle, { color: textColor }]}>Hours</Text>
              {hours.map((hour, index) => (
                <Text key={index} style={[styles.hourText, { color: textSecondaryColor }]}>
                  {hour}
                </Text>
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.videosSection}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>Videos from this location</Text>
          <Text style={[styles.videoCount, { color: textSecondaryColor }]}>{videoCountText}</Text>
          
          {posts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <IconSymbol 
                ios_icon_name="video.fill"
                android_material_icon_name="videocam" 
                size={64} 
                color={textSecondaryColor}
              />
              <Text style={[styles.emptyText, { color: textSecondaryColor }]}>
                No videos yet from this location
              </Text>
            </View>
          ) : (
            <View style={styles.gridContainer}>
              {posts.map((post) => (
                <VideoGridItem
                  key={post.id}
                  post={post}
                  size={gridItemSize}
                  onPress={() => handleVideoPress(post)}
                  showViewCount={true}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  content: {
    flex: 1,
  },
  headerCard: {
    padding: 20,
    margin: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  headerIcon: {
    marginBottom: 12,
  },
  locationName: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  address: {
    fontSize: 14,
    textAlign: 'center',
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 24,
    marginTop: 8,
    marginBottom: 20,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 16,
    fontWeight: '600',
  },
  directionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 8,
    width: '100%',
    justifyContent: 'center',
  },
  directionsButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  hoursSection: {
    marginTop: 20,
    width: '100%',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  hoursTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  hourText: {
    fontSize: 14,
    marginBottom: 4,
  },
  videosSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  videoCount: {
    fontSize: 14,
    marginBottom: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
});
