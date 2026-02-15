
import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { IconSymbol } from '@/components/IconSymbol';

interface VideoGridItemProps {
  videoUrl: string;
  onPress?: () => void;
  size: number;
  cardColor: string;
}

export function VideoGridItem({ videoUrl, onPress, size, cardColor }: VideoGridItemProps) {
  const player = useVideoPlayer(videoUrl, (player) => {
    player.loop = false;
    player.muted = true;
  });

  return (
    <TouchableOpacity 
      style={[styles.gridItem, { width: size, height: size, backgroundColor: cardColor }]}
      activeOpacity={0.8}
      onPress={onPress}
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
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
});
