
import React, { useEffect, useState, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { IconSymbol } from '@/components/IconSymbol';
import { useRouter } from 'expo-router';

interface VideoGridItemProps {
  videoUrl: string;
  postId: string;
  onPress?: () => void;
  size: number;
  cardColor: string;
}

export function VideoGridItem({ videoUrl, postId, onPress, size, cardColor }: VideoGridItemProps) {
  const router = useRouter();
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const isMountedRef = useRef(true);
  
  // Ensure video URL is properly formatted
  const formattedVideoUrl = videoUrl?.startsWith('http') ? videoUrl : '';
  
  console.log('VideoGridItem rendering with URL:', formattedVideoUrl);
  
  const player = useVideoPlayer(formattedVideoUrl, (player) => {
    if (formattedVideoUrl) {
      player.loop = true;
      player.muted = true;
      player.volume = 0;
    }
  });

  useEffect(() => {
    isMountedRef.current = true;
    console.log('VideoGridItem mounted for:', formattedVideoUrl);
    
    if (!formattedVideoUrl) {
      console.error('Invalid video URL provided to VideoGridItem');
      return;
    }
    
    let playTimeout: NodeJS.Timeout;
    let retryCount = 0;
    const maxRetries = 5;
    
    const attemptPlay = async () => {
      if (!isMountedRef.current || !player) {
        console.log('Component unmounted or player not available');
        return;
      }

      try {
        const status = player.status;
        console.log(`VideoGridItem attempt ${retryCount + 1}: Player status:`, status);

        if (status === 'readyToPlay') {
          console.log('Player ready, starting playback');
          await player.play();
          setIsPlayerReady(true);
          console.log('Video playback started successfully');
        } else if (status === 'idle' || status === 'loading') {
          if (retryCount < maxRetries) {
            retryCount++;
            const delay = 300 * Math.pow(1.5, retryCount - 1);
            console.log(`Player still loading, retrying in ${delay}ms...`);
            playTimeout = setTimeout(attemptPlay, delay);
          } else {
            console.error('Max retries reached, player failed to load');
          }
        } else if (status === 'error') {
          console.error('Player in error state for URL:', formattedVideoUrl);
          if (retryCount < maxRetries) {
            retryCount++;
            console.log('Attempting to replace player source...');
            try {
              await player.replace(formattedVideoUrl);
              playTimeout = setTimeout(attemptPlay, 800);
            } catch (replaceError) {
              console.error('Error replacing player source:', replaceError);
            }
          } else {
            console.error('Max retries reached, cannot recover from error state');
          }
        }
      } catch (error) {
        console.error('Error attempting playback:', error);
        if (retryCount < maxRetries) {
          retryCount++;
          playTimeout = setTimeout(attemptPlay, 1000);
        }
      }
    };
    
    // Initial delay before first attempt
    playTimeout = setTimeout(attemptPlay, 500);
    
    return () => {
      console.log('VideoGridItem unmounting');
      isMountedRef.current = false;
      if (playTimeout) clearTimeout(playTimeout);
      
      try {
        if (player && player.playing) {
          player.pause();
        }
      } catch (error) {
        console.log('Error pausing video on unmount (safe to ignore):', error);
      }
    };
  }, [player, formattedVideoUrl]);

  const handlePress = () => {
    console.log('User tapped video grid item, opening full screen:', postId);
    if (onPress) {
      onPress();
    } else {
      router.push(`/video/${postId}`);
    }
  };

  return (
    <TouchableOpacity 
      style={[styles.gridItem, { width: size, height: size * 1.5, backgroundColor: cardColor }]}
      activeOpacity={0.8}
      onPress={handlePress}
    >
      {formattedVideoUrl ? (
        <>
          <VideoView
            style={styles.videoThumbnail}
            player={player}
            nativeControls={false}
            contentFit="cover"
            allowsFullscreen={false}
            allowsPictureInPicture={false}
          />
          <View style={styles.videoOverlay}>
            <IconSymbol 
              android_material_icon_name="play-arrow" 
              size={32} 
              color="#FFFFFF"
            />
          </View>
        </>
      ) : (
        <View style={styles.errorContainer}>
          <IconSymbol 
            android_material_icon_name="error" 
            size={24} 
            color="#999"
          />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  gridItem: {
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
