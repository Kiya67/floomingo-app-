
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
  });

  useEffect(() => {
    console.log('VideoGridItem mounted, starting playback for:', videoUrl);
    
    const playVideo = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 200));
        if (player && player.status === 'readyToPlay') {
          await player.play();
          console.log('Video playback started successfully');
        }
      } catch (error) {
        console.log('Error starting video playback:', error);
      }
    };
    
    playVideo();
    
    return () => {
      console.log('VideoGridItem unmounting, pausing playback');
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
