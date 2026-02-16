
import React, { useEffect, useState, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Text, Image, useColorScheme } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';

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
}

interface VideoGridItemProps {
  post: Post;
  size: number;
  onPress: () => void;
  shouldPlay: boolean;
}

export function VideoGridItem({ post, size, onPress, shouldPlay }: VideoGridItemProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const cardColor = isDark ? colors.cardDark : colors.card;
  
  // Initialize all hooks BEFORE any conditional returns
  const [hasError, setHasError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const isMountedRef = useRef(true);
  const retryCountRef = useRef(0);
  const maxRetries = 2;
  
  // Ensure video URL is properly formatted
  const formattedVideoUrl = post?.video_url?.startsWith('http') ? post.video_url : '';
  const formattedThumbnailUrl = post?.thumbnail_url?.startsWith('http') ? post.thumbnail_url : '';
  
  // ALWAYS call useVideoPlayer unconditionally
  const player = useVideoPlayer(formattedVideoUrl || '', (player) => {
    player.loop = true;
    player.muted = true;
    player.volume = 0;
  });

  useEffect(() => {
    isMountedRef.current = true;
    retryCountRef.current = 0;
    setHasError(false);
    
    if (!post || !formattedVideoUrl) {
      if (!post) {
        console.error('VideoGridItem: post is undefined');
      } else {
        console.error(`VideoGridItem [${post.id}] Invalid video URL`);
      }
      setHasError(true);
      return;
    }
    
    if (!player) {
      console.error(`VideoGridItem [${post.id}] Player not initialized`);
      setHasError(true);
      return;
    }
    
    console.log(`VideoGridItem [${post.id}] rendering - shouldPlay: ${shouldPlay}`);
    
    // If shouldPlay is false, pause the video and show thumbnail
    if (!shouldPlay) {
      console.log(`VideoGridItem [${post.id}] shouldPlay=false, pausing video`);
      try {
        if (player.playing) {
          player.pause();
        }
        setIsPlaying(false);
      } catch (error) {
        console.error(`VideoGridItem [${post.id}] error pausing:`, error);
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
        console.log(`VideoGridItem [${post.id}] attempt ${retryCountRef.current + 1}: status=${status}`);

        if (status === 'readyToPlay') {
          console.log(`VideoGridItem [${post.id}] ready, starting playback`);
          await player.play();
          setIsPlaying(true);
          console.log(`VideoGridItem [${post.id}] playback started`);
          return;
        }
        
        if (status === 'error') {
          console.error(`VideoGridItem [${post.id}] player in error state`);
          
          if (retryCountRef.current < maxRetries) {
            retryCountRef.current++;
            const delay = 1000 * retryCountRef.current;
            console.log(`VideoGridItem [${post.id}] retrying in ${delay}ms`);
            
            try {
              await player.replace(formattedVideoUrl);
              playTimeout = setTimeout(attemptPlay, delay);
            } catch (replaceError) {
              console.error(`VideoGridItem [${post.id}] replace failed:`, replaceError);
              setHasError(true);
            }
          } else {
            console.error(`VideoGridItem [${post.id}] max retries reached, showing thumbnail`);
            setHasError(true);
          }
          return;
        }
        
        if (status === 'idle' || status === 'loading') {
          if (retryCountRef.current < maxRetries) {
            retryCountRef.current++;
            const delay = 500 * retryCountRef.current;
            console.log(`VideoGridItem [${post.id}] still loading, checking again in ${delay}ms`);
            playTimeout = setTimeout(attemptPlay, delay);
          } else {
            console.error(`VideoGridItem [${post.id}] loading timeout, showing thumbnail`);
            setHasError(true);
          }
          return;
        }
        
      } catch (error) {
        console.error(`VideoGridItem [${post.id}] playback error:`, error);
        
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
      console.log(`VideoGridItem [${post.id}] unmounting`);
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
  }, [player, formattedVideoUrl, post, shouldPlay]);

  // NOW we can do conditional rendering after all hooks are called
  if (!post) {
    return (
      <View style={[styles.gridItem, { width: size, height: size * 1.5, backgroundColor: cardColor }]}>
        <View style={styles.errorContainer}>
          <IconSymbol 
            ios_icon_name="exclamationmark.triangle"
            android_material_icon_name="error" 
            size={24} 
            color="#999"
          />
          <Text style={styles.errorText}>Video unavailable</Text>
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity 
      style={[styles.gridItem, { width: size, height: size * 1.5, backgroundColor: cardColor }]}
      activeOpacity={0.8}
      onPress={onPress}
    >
      {shouldPlay && formattedVideoUrl && !hasError && player && isPlaying ? (
        <>
          <VideoView
            style={styles.videoThumbnail}
            player={player}
            nativeControls={false}
            contentFit="cover"
            allowsFullscreen={false}
            allowsPictureInPicture={false}
          />
        </>
      ) : formattedThumbnailUrl ? (
        <>
          <Image
            source={{ uri: formattedThumbnailUrl }}
            style={styles.videoThumbnail}
            resizeMode="cover"
          />
          <View style={styles.videoOverlay}>
            <IconSymbol 
              ios_icon_name="play.fill"
              android_material_icon_name="play-arrow" 
              size={32} 
              color="#FFFFFF"
            />
          </View>
        </>
      ) : (
        <View style={styles.errorContainer}>
          <IconSymbol 
            ios_icon_name="exclamationmark.triangle"
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
