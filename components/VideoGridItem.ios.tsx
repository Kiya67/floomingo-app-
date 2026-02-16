
import React, { useEffect } from 'react';
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
  
  const player = useVideoPlayer(videoUrl, (player) => {
    player.loop = true;
    player.muted = true;
    player.play();
  });

  useEffect(() => {
    console.log('VideoGridItem mounted, starting playback for:', videoUrl);
    
    // Small delay to ensure player is ready
    const playTimeout = setTimeout(() => {
      try {
        if (player) {
          player.play();
        }
      } catch (error) {
        console.log('Error starting video playback:', error);
      }
    }, 100);
    
    return () => {
      console.log('VideoGridItem unmounting, pausing playback');
      clearTimeout(playTimeout);
      try {
        // Check if player exists and is in a valid state before pausing
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
      style={[styles.gridItem, { width: size, height: size, backgroundColor: cardColor }]}
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
