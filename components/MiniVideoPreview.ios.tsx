
import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

interface MiniVideoPreviewProps {
  videoUrl: string;
  posterUrl?: string;
  size?: number;
  borderRadius?: number;
  shouldPlay: boolean;
}

export function MiniVideoPreview({
  videoUrl,
  posterUrl,
  size = 72,
  borderRadius = 12,
  shouldPlay,
}: MiniVideoPreviewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const player = useVideoPlayer(videoUrl, (player) => {
    player.loop = true;
    player.muted = true;
  });

  useEffect(() => {
    if (shouldPlay) {
      console.log('MiniVideoPreview: Starting playback for', videoUrl);
      player.play();
    } else {
      console.log('MiniVideoPreview: Pausing playback for', videoUrl);
      player.pause();
    }
  }, [shouldPlay, player]);

  useEffect(() => {
    const subscription = player.addListener('statusChange', (status) => {
      if (status === 'readyToPlay') {
        setIsLoading(false);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [player]);

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius,
          overflow: 'hidden',
        },
      ]}
    >
      {isLoading && (
        <View style={[styles.loadingContainer, { backgroundColor: '#1A1A1A' }]}>
          <ActivityIndicator size="small" color="#FFFFFF" />
        </View>
      )}
      <VideoView
        player={player}
        style={styles.video}
        nativeControls={false}
        contentFit="cover"
        allowsFullscreen={false}
        allowsPictureInPicture={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1A1A1A',
    position: 'relative',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  video: {
    width: '100%',
    height: '100%',
  },
});
