
import React, { useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

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
}

interface VideoGridItemProps {
  post: Post;
  size: number;
  shouldPlay?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  showViewCount?: boolean;
}

function InlineVideoPreview({ videoUrl, width, height }: { videoUrl: string; width: number; height: number }) {
  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop = true;
    p.muted = true;
  });

  useEffect(() => {
    console.log('VideoGridItem (iOS): starting inline video preview for', videoUrl);
    player.play();
    return () => {
      player.pause();
    };
  }, [player, videoUrl]);

  return (
    <VideoView
      player={player}
      style={{ width, height }}
      nativeControls={false}
      contentFit="cover"
      allowsFullscreen={false}
      allowsPictureInPicture={false}
    />
  );
}

export function VideoGridItem({ post, size, onPress, onLongPress, showViewCount = false }: VideoGridItemProps) {
  if (!post) return null;

  const viewCount = post?.view_count ?? 0;
  const viewCountText = viewCount >= 1000 ? `${(viewCount / 1000).toFixed(1)}K` : viewCount.toString();
  const itemHeight = size * 1.8;
  const hasVideo = !!post.video_url;

  return (
    <TouchableOpacity
      style={[styles.container, { width: size, height: itemHeight }]}
      onPress={() => {
        console.log('User tapped video grid item (iOS), post id:', post.id);
        onPress?.();
      }}
      onLongPress={onLongPress}
      activeOpacity={0.9}
    >
      {hasVideo ? (
        <InlineVideoPreview videoUrl={post.video_url} width={size} height={itemHeight} />
      ) : null}

      {showViewCount && viewCount > 0 ? (
        <View style={styles.viewCountBadge}>
          <Text style={styles.viewCountText}>{viewCountText}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: '#111',
    position: 'relative',
  },
  viewCountBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  viewCountText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});
