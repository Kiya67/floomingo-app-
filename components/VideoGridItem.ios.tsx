
import React, { useEffect, useState } from 'react';
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
  
  const player = useVideoPlayer(videoUrl, (player) => {
    player.loop = true;
    player.muted = true;
    player.volume = 0;
  });

  useEffect(() => {
    console.log('VideoGridItem mounted for:', videoUrl);
    
    let isMounted = true;
    let playTimeout: NodeJS.Timeout;
    let retryTimeout: NodeJS.Timeout;
    
    const attemptPlay = async () => {
      if (!isMounted || !player) {
        console.log('Component unmounted or player not available');
        return;
      }

      try {
        const status = player.status;
        console.log('Player status:', status);

        if (status === 'readyToPlay') {
          console.log('Player ready, starting playback');
          await player.play();
          setIsPlayerReady(true);
          console.log('Video playback started successfully');
        } else if (status === 'idle' || status === 'loading') {
          console.log('Player still loading, will retry...');
          retryTimeout = setTimeout(attemptPlay, 500);
        } else if (status === 'error') {
          console.log('Player in error state, attempting to replace player');
          player.replace(videoUrl);
          retryTimeout = setTimeout(attemptPlay, 800);
        }
      } catch (error) {
        console.log('Error attempting playback:', error);
        retryTimeout = setTimeout(attemptPlay, 1000);
      }
    };
    
    playTimeout = setTimeout(attemptPlay, 400);
    
    return () => {
      console.log('VideoGridItem unmounting');
      isMounted = false;
      if (playTimeout) clearTimeout(playTimeout);
      if (retryTimeout) clearTimeout(retryTimeout);
      
      try {
        if (player && player.playing) {
          player.pause();
        }
      } catch (error) {
        console.log('Error pausing video (safe to ignore):', error);
      }
    };
  }, [player, videoUrl]);

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
      <VideoView
        style={styles.videoThumbnail}
        player={player}
        nativeControls={false}
        contentFit="cover"
      />
      <View style={styles.videoOverlay}>
        <IconSymbol 
          ios_icon_name="play.fill"
          android_material_icon_name="play-arrow" 
          size={32} 
          color="#FFFFFF"
        />
      </View>
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
});
