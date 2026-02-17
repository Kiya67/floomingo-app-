
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
  showFollowButton?: boolean;
  onFollowToggle?: (userId: string, isFollowing: boolean) => void;
  isFollowing?: boolean;
}

export function VideoGridItem({ post, size, onPress, shouldPlay, showFollowButton = false, onFollowToggle, isFollowing = false }: VideoGridItemProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const cardColor = isDark ? colors.cardDark : colors.card;
  
  // Initialize all hooks BEFORE any conditional returns
  const [showThumbnail, setShowThumbnail] = useState(true);
  const isMountedRef = useRef(true);
  const hasAttemptedPlayRef = useRef(false);
  
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
    hasAttemptedPlayRef.current = false;
    
    if (!post || !formattedVideoUrl) {
      setShowThumbnail(true);
      return;
    }
    
    if (!player) {
      setShowThumbnail(true);
      return;
    }
    
    // If shouldPlay is false, show thumbnail
    if (!shouldPlay) {
      setShowThumbnail(true);
      try {
        if (player.playing) {
          player.pause();
        }
      } catch (error) {
        // Ignore pause errors
      }
      return;
    }
    
    // If shouldPlay is true, attempt to play
    let playTimeout: NodeJS.Timeout;
    
    const attemptPlay = async () => {
      if (!isMountedRef.current || !player || !shouldPlay || hasAttemptedPlayRef.current) {
        return;
      }

      hasAttemptedPlayRef.current = true;

      try {
        const status = player.status;

        if (status === 'readyToPlay') {
          await player.play();
          setShowThumbnail(false);
          return;
        }
        
        if (status === 'error') {
          // Don't retry, just show thumbnail
          setShowThumbnail(true);
          return;
        }
        
        if (status === 'idle' || status === 'loading') {
          // Wait a bit and try again (only once)
          playTimeout = setTimeout(() => {
            hasAttemptedPlayRef.current = false;
            attemptPlay();
          }, 1000);
          return;
        }
        
      } catch (error) {
        // On any error, show thumbnail
        setShowThumbnail(true);
      }
    };
    
    // Start attempting playback after a short delay
    playTimeout = setTimeout(attemptPlay, 500);
    
    return () => {
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

  const handleFollowPress = (e: any) => {
    e.stopPropagation();
    if (onFollowToggle && post?.user_id) {
      console.log('User tapped follow button on grid item');
      onFollowToggle(post.user_id, isFollowing);
    }
  };

  const followButtonText = isFollowing ? 'Following' : 'Follow';

  return (
    <TouchableOpacity 
      style={[styles.gridItem, { width: size, height: size * 1.5, backgroundColor: cardColor }]}
      activeOpacity={0.8}
      onPress={onPress}
    >
      {shouldPlay && formattedVideoUrl && !showThumbnail && player ? (
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
      {showFollowButton && (
        <TouchableOpacity
          style={[
            styles.followButtonOverlay,
            { backgroundColor: isFollowing ? 'rgba(0, 0, 0, 0.7)' : '#FF69B4' }
          ]}
          onPress={handleFollowPress}
          activeOpacity={0.8}
        >
          <Text style={styles.followButtonOverlayText}>{followButtonText}</Text>
        </TouchableOpacity>
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
  followButtonOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  followButtonOverlayText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});
