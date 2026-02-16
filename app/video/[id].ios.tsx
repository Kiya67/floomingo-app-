
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useColorScheme, ActivityIndicator, Dimensions, StatusBar, Image, ImageSourcePropType } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { supabase } from '@/lib/supabase';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';

interface Post {
  id: string;
  user_id: string;
  video_url: string;
  caption: string;
  place_id: string | null;
  place_name: string | null;
  location_type: string | null;
  created_at: string;
  profiles?: {
    display_name: string;
    avatar_url: string | null;
  };
}

const { width, height } = Dimensions.get('window');

function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: '' };
  if (typeof source === 'string') return { uri: source };
  return source as ImageSourcePropType;
}

export default function VideoFullScreenScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const isMountedRef = useRef(true);

  const bgColor = isDark ? colors.backgroundDark : colors.background;
  const textColor = isDark ? colors.textDark : colors.text;
  const textSecondaryColor = isDark ? colors.textSecondaryDark : colors.textSecondary;
  const primaryColor = isDark ? colors.primaryDark : colors.primary;

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [showControls, setShowControls] = useState(true);

  const fetchPost = useCallback(async () => {
    console.log('Loading video post with ID:', id);
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
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching post:', error);
      } else {
        console.log('Post fetched successfully:', data);
        
        let videoUrl = data.video_url;
        if (videoUrl && !videoUrl.startsWith('http')) {
          const { data: urlData } = supabase.storage
            .from('videos')
            .getPublicUrl(videoUrl);
          videoUrl = urlData.publicUrl;
          console.log('Converted video path to public URL:', videoUrl);
        }
        
        setPost({
          ...data,
          video_url: videoUrl
        });
      }
    } catch (error) {
      console.error('Error in fetchPost:', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchPost();
    
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchPost]);

  const player = useVideoPlayer(post?.video_url || '', (player) => {
    if (post?.video_url) {
      player.loop = true;
      player.muted = false;
    }
  });

  useEffect(() => {
    if (player && post?.video_url && isMountedRef.current) {
      console.log('Starting video playback in full screen for URL:', post.video_url);
      
      let playTimeout: NodeJS.Timeout;
      let retryCount = 0;
      const maxRetries = 3;
      
      const attemptPlay = async () => {
        if (!isMountedRef.current) return;
        
        try {
          const status = player.status;
          console.log(`Full screen video attempt ${retryCount + 1}: Player status:`, status);
          
          if (status === 'readyToPlay') {
            await player.play();
            player.volume = 1;
            console.log('Full screen video playback started with sound');
          } else if (status === 'idle' || status === 'loading') {
            if (retryCount < maxRetries) {
              retryCount++;
              const delay = 500 * retryCount;
              playTimeout = setTimeout(attemptPlay, delay);
            }
          } else if (status === 'error') {
            console.error('Player in error state - stopping retry attempts');
          }
        } catch (error) {
          console.error('Error starting video playback:', error);
          if (retryCount < maxRetries) {
            retryCount++;
            playTimeout = setTimeout(attemptPlay, 1000);
          }
        }
      };
      
      playTimeout = setTimeout(attemptPlay, 500);
      
      return () => {
        if (playTimeout) clearTimeout(playTimeout);
        console.log('Pausing video playback on unmount');
        try {
          if (player && player.playing) {
            player.pause();
          }
        } catch (error) {
          console.log('Error pausing video (safe to ignore):', error);
        }
      };
    }
  }, [player, post?.video_url]);

  const handleClose = () => {
    console.log('User tapped close button');
    router.back();
  };

  const toggleControls = () => {
    setShowControls(!showControls);
  };

  const handleLocationPress = () => {
    if (post?.place_id) {
      console.log('User tapped location, navigating to location details:', post.place_id);
      router.push(`/location/${post.place_id}`);
    }
  };

  const displayName = post?.profiles?.display_name || 'Unknown User';
  const avatarUrl = post?.profiles?.avatar_url || '';
  const caption = post?.caption || '';
  const placeName = post?.place_name || '';

  const getInitials = (name: string) => {
    const names = name.split(' ');
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const initials = getInitials(displayName);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: bgColor }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar hidden />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={primaryColor} />
          <Text style={[styles.loadingText, { color: textColor }]}>Loading video...</Text>
        </View>
      </View>
    );
  }

  if (!post) {
    return (
      <View style={[styles.container, { backgroundColor: bgColor }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar hidden />
        <View style={styles.errorContainer}>
          <IconSymbol 
            ios_icon_name="exclamationmark.triangle.fill"
            android_material_icon_name="error" 
            size={64} 
            color={textSecondaryColor}
          />
          <Text style={[styles.errorText, { color: textColor }]}>Video not found</Text>
          <TouchableOpacity 
            style={[styles.backButton, { backgroundColor: primaryColor }]}
            onPress={handleClose}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar hidden />
      
      <TouchableOpacity 
        style={styles.videoContainer}
        activeOpacity={1}
        onPress={toggleControls}
      >
        <VideoView
          style={styles.video}
          player={player}
          nativeControls={false}
          contentFit="contain"
          allowsFullscreen={false}
          allowsPictureInPicture={false}
        />
      </TouchableOpacity>

      {showControls && (
        <>
          <View style={styles.topControls}>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={handleClose}
            >
              <IconSymbol 
                ios_icon_name="xmark"
                android_material_icon_name="close" 
                size={28} 
                color="#FFFFFF"
              />
            </TouchableOpacity>
          </View>

          <View style={styles.bottomInfo}>
            <View style={styles.infoContent}>
              <View style={styles.userRow}>
                {avatarUrl ? (
                  <Image 
                    source={resolveImageSource(avatarUrl)} 
                    style={styles.avatar}
                  />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarInitials}>{initials}</Text>
                  </View>
                )}
                <Text style={styles.displayName}>{displayName}</Text>
              </View>
              {caption ? (
                <Text style={styles.caption}>{caption}</Text>
              ) : null}
              {placeName ? (
                <TouchableOpacity 
                  style={styles.locationRow}
                  onPress={handleLocationPress}
                  activeOpacity={0.7}
                >
                  <IconSymbol 
                    ios_icon_name="location.fill"
                    android_material_icon_name="location-on" 
                    size={16} 
                    color="#FF69B4"
                  />
                  <Text style={styles.placeName}>{placeName}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  videoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: width,
    height: height,
  },
  topControls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 50,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 40,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  infoContent: {
    gap: 8,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#333',
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF69B4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  displayName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  caption: {
    fontSize: 16,
    color: '#FFFFFF',
    lineHeight: 22,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  placeName: {
    fontSize: 14,
    color: '#FF69B4',
    fontWeight: '600',
  },
});
