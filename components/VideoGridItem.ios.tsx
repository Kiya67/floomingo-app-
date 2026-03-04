
import React from 'react';
import { View, TouchableOpacity, StyleSheet, Image, Text, ImageSourcePropType } from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';

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

function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: '' };
  if (typeof source === 'string') return { uri: source };
  return source as ImageSourcePropType;
}

export function VideoGridItem({ post, size, shouldPlay = false, onPress, onLongPress, showViewCount = false }: VideoGridItemProps) {
  // CRITICAL: Guard against undefined post
  if (!post) return null;
  
  // CRITICAL: Safe access to view_count with default
  const viewCount = post?.view_count ?? 0;
  const viewCountText = viewCount >= 1000 ? `${(viewCount / 1000).toFixed(1)}K` : viewCount.toString();

  // Make grid items taller (1.5x aspect ratio instead of 1:1)
  const itemHeight = size * 1.5;

  return (
    <TouchableOpacity
      style={[styles.container, { width: size, height: itemHeight }]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.9}
    >
      <Image
        source={resolveImageSource(post.thumbnail_url)}
        style={styles.thumbnail}
        resizeMode="cover"
      />
      
      {showViewCount && viewCount > 0 ? (
        <View style={styles.viewCountBadge}>
          <IconSymbol
            ios_icon_name="eye.fill"
            android_material_icon_name="visibility"
            size={14}
            color="#FFFFFF"
          />
          <Text style={styles.viewCountText}>{viewCountText}</Text>
        </View>
      ) : null}
      
      <View style={styles.playIconContainer}>
        <IconSymbol
          ios_icon_name="play.fill"
          android_material_icon_name="play-arrow"
          size={32}
          color="rgba(255, 255, 255, 0.9)"
        />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: '#000',
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  playIconContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
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
