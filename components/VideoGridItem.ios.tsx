
import React, { useEffect, useState, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Text, Image } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { IconSymbol } from '@/components/IconSymbol';
import { useRouter } from 'expo-router';

interface VideoGridItemProps {
  videoUrl: string;
  postId: string;
  onPress?: () => void;
  size: number;
  cardColor: string;
  shouldPlay?: boolean; // NEW: Control whether this video should play
}

export function VideoGridItem({ videoUrl, postId, onPress, size, cardColor, shouldPlay = false }: VideoGridItemProps) {
  const router = useRouter();
  const [hasError, setHasError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const isMountedRef = useRef(true);
  const retryCountRef = useRef(0);
  const maxRetries = 3;
  
  // Ensure video URL is properly formatted
  const formattedVideoUrl = videoUrl?.startsWith('http') ? videoUrl : '';
  
  console.log(`VideoGridItem [${postId}] rendering - shouldPlay: ${shouldPlay}, URL: ${formattedVideoUrl}`);
  
  // ALWAYS call useVideoPlayer unconditionally (pass empty string if no URL)
  // This ensures hooks are called in the same order every render
  const player = useVideoPlayer(formattedVideoUrl || '', (player) => {
    player.loop = true;
    player.muted = true;
    player.volume = 0;
  });

  useEffect(() => {
    isMountedRef.current = true;
    retryCountRef.current = 0;
    setHasError(false);
    
    if (!formattedVideoUrl) {
      console.error('Invalid video URL provided to VideoGridItem');
      setHasError(true);
      return;
    }
    
    if (!player) {
      console.error('Player not initialized');
      setHasError(true);
      return;
    }
    
    // If shouldPlay is false, pause the video and show thumbnail
    if (!shouldPlay) {
      console.log(`VideoGridItem [${postId}] shouldPlay=false, pausing video`);
      try {
        if (player.playing) {
          player.pause();
        }
        setIsPlaying(false);
      } catch (error) {
        console.error(`VideoGridItem [${postId}] error pausing:`, error);
      }
      return;
    }
    
    let playTimeout: NodeJS.Timeout;
    
    const attemptPlay = async () => {
      if (!isMountedRef.current || !player || !shouldPlay) {
        return;
      }

      try {
        const status = player.status;
        console.log(`VideoGridItem [${postId}] attempt ${retryCountRef.current + 1}: status=${status}`);

        if (status === 'readyToPlay') {
          console.log(`VideoGridItem [${postId}] ready, starting playback`);
          await player.play();
          setIsPlaying(true);
          console.log(`VideoGridItem [${postId}] playback started`);
          return;
        }
        
        if (status === 'error') {
          console.error(`VideoGridItem [${postId}] player in error state`);
          
          if (retryCountRef.current < maxRetries) {
            retryCountRef.current++;
            const delay = 1000 * retryCountRef.current;
            console.log(`VideoGridItem [${postId}] retrying in ${delay}ms (attempt ${retryCountRef.current}/${maxRetries})`);
            
            // Try to replace the source
            try {
              await player.replace(formattedVideoUrl);
              playTimeout = setTimeout(attemptPlay, delay);
            } catch (replaceError) {
              console.error(`VideoGridItem [${postId}] replace failed:`, replaceError);
              setHasError(true);
            }
          } else {
            console.error(`VideoGridItem [${postId}] max retries reached, giving up`);
            setHasError(true);
          }
          return;
        }
        
        if (status === 'idle' || status === 'loading') {
          if (retryCountRef.current < maxRetries) {
            retryCountRef.current++;
            const delay = 500 * retryCountRef.current;
            console.log(`VideoGridItem [${postId}] still loading, checking again in ${delay}ms`);
            playTimeout = setTimeout(attemptPlay, delay);
          } else {
            console.error(`VideoGridItem [${postId}] loading timeout`);
            setHasError(true);
          }
          return;
        }
        
      } catch (error) {
        console.error(`VideoGridItem [${postId}] playback error:`, error);
        
        if (retryCountRef.current < maxRetries) {
          retryCountRef.current++;
          playTimeout = setTimeout(attemptPlay, 1000);
        } else {
          setHasError(true);
        }
      }
    };
    
    // Start attempting playback after a short delay
    playTimeout = setTimeout(attemptPlay, 800);
    
    return () => {
      console.log(`VideoGridItem [${postId}] unmounting`);
      isMountedRef.current = false;
      if (playTimeout) clearTimeout(playTimeout);
      
      try {
        if (player && player.playing) {
          player.pause();
        }
      } catch (error) {
        // Safe to ignore
      }
    };
  }, [player, formattedVideoUrl, postId, shouldPlay]);

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
      {formattedVideoUrl && !hasError && player ? (
        <>
          <VideoView
            style={styles.videoThumbnail}
            player={player}
            nativeControls={false}
            contentFit="cover"
            allowsFullscreen={false}
            allowsPictureInPicture={false}
          />
          {!isPlaying && (
            <View style={styles.videoOverlay}>
              <IconSymbol 
                ios_icon_name="play.fill"
                android_material_icon_name="play-arrow" 
                size={32} 
                color="#FFFFFF"
              />
            </View>
          )}
        </>
      ) : (
        <View style={styles.errorContainer}>
          <IconSymbol 
            ios_icon_name="exclamationmark.triangle.fill"
            android_material_icon_name="error" 
            size={24} 
            color="#999"
          />
          <Text style={styles.errorText}>Video unavailable</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
});
