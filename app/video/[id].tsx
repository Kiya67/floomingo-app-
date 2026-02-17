
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useColorScheme, ActivityIndicator, Dimensions, StatusBar, Image, ImageSourcePropType, ScrollView } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { supabase } from '@/lib/supabase';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';

interface Post {
  id: string;
  user_id: string;
  video_url: string;
  caption: string;
  place_id: string | null;
  place_name: string | null;
  location_type: string | null;
  created_at: string;
  profiles?: {
    display_name: string;
    avatar_url: string | null;
  };
}

interface ProfileStats {
  follower_count: number;
  following_count: number;
  post_count: number;
}

const { width, height } = Dimensions.get('window');

function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: '' };
  if (typeof source === 'string') return { uri: source };
  return source as ImageSourcePropType;
}

export default function VideoFullScreenScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const isMountedRef = useRef(true);

  const bgColor = isDark ? colors.backgroundDark : colors.background;
  const textColor = isDark ? colors.textDark : colors.text;
  const textSecondaryColor = isDark ? colors.textSecondaryDark : colors.textSecondary;
  const primaryColor = isDark ? colors.primaryDark : colors.primary;

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const fetchPost = useCallback(async () => {
    console.log('Loading video post with ID:', id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }

      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles!posts_user_id_fkey (
            display_name,
            avatar_url
          )
        `)
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching post:', error);
      } else {
        console.log('Post fetched successfully:', data);
        
        let videoUrl = data.video_url;
        if (videoUrl && !videoUrl.startsWith('http')) {
          const { data: urlData } = supabase.storage
            .from('videos')
            .getPublicUrl(videoUrl);
          videoUrl = urlData.publicUrl;
          console.log('Converted video path to public URL:', videoUrl);
        }
        
        setPost({
          ...data,
          video_url: videoUrl
        });

        // Check follow status
        if (user && data.user_id !== user.id) {
          const { data: followData } = await supabase
            .from('follows')
            .select('*')
            .eq('follower_id', user.id)
            .eq('following_id', data.user_id)
            .limit(1);
          
          setIsFollowing(followData && followData.length > 0);
          console.log('Follow status:', followData && followData.length > 0);
        }

        // Check if post is saved
        if (user) {
          const { data: savedData } = await supabase
            .from('board_items')
            .select('id, board_id, boards!inner(user_id)')
            .eq('post_id', id)
            .eq('boards.user_id', user.id)
            .limit(1);
          
          setIsSaved(savedData && savedData.length > 0);
          console.log('Save status:', savedData && savedData.length > 0);
        }
      }
    } catch (error) {
      console.error('Error in fetchPost:', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchPost();
    
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchPost]);

  const player = useVideoPlayer(post?.video_url || '', (player) => {
    if (post?.video_url) {
      player.loop = true;
      player.muted = false;
    }
  });

  useEffect(() => {
    if (!player || !post?.video_url || !isMountedRef.current) {
      return;
    }

    console.log('Setting up video playback for URL:', post.video_url);
    
    let playTimeout: NodeJS.Timeout | null = null;
    let retryCount = 0;
    const maxRetries = 5;
    
    const attemptPlay = async () => {
      if (!isMountedRef.current) {
        console.log('Component unmounted, stopping playback attempts');
        return;
      }
      
      try {
        const status = player.status;
        console.log(`Full screen video attempt ${retryCount + 1}: Player status:`, status);
        
        if (status === 'readyToPlay') {
          console.log('Player ready, starting playback');
          player.play();
          player.volume = 1;
          console.log('Full screen video playback started with sound');
        } else if (status === 'idle' || status === 'loading') {
          if (retryCount < maxRetries) {
            retryCount++;
            const delay = 500 * retryCount;
            console.log(`Player not ready (${status}), retrying in ${delay}ms`);
            playTimeout = setTimeout(attemptPlay, delay);
          } else {
            console.log('Max retries reached, player still not ready');
          }
        } else if (status === 'error') {
          console.error('Player in error state - video may be corrupted or unavailable');
        }
      } catch (error) {
        console.error('Error in attemptPlay:', error);
        if (retryCount < maxRetries) {
          retryCount++;
          playTimeout = setTimeout(attemptPlay, 1000);
        }
      }
    };
    
    playTimeout = setTimeout(attemptPlay, 300);
    
    return () => {
      console.log('Cleaning up video playback');
      if (playTimeout) {
        clearTimeout(playTimeout);
        playTimeout = null;
      }
      try {
        if (player && player.playing) {
          player.pause();
          console.log('Video paused on cleanup');
        }
      } catch (error) {
        console.log('Error pausing video during cleanup (safe to ignore):', error);
      }
    };
  }, [player, post?.video_url]);

  const handleClose = () => {
    console.log('User tapped close button');
    router.back();
  };

  const toggleControls = () => {
    setShowControls(!showControls);
  };

  const handleLocationPress = () => {
    if (post?.place_id) {
      console.log('User tapped location, navigating to location details:', post.place_id);
      router.push(`/location/${post.place_id}`);
    }
  };

  const handleProfilePress = () => {
    if (post?.user_id) {
      console.log('User tapped profile, navigating to user profile:', post.user_id);
      router.push(`/user/${post.user_id}`);
    }
  };

  const handleFollowToggle = async () => {
    console.log('User tapped follow/unfollow button');
    if (followLoading || !post?.user_id) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('No authenticated user');
        return;
      }

      setFollowLoading(true);

      if (isFollowing) {
        console.log('Unfollowing user:', post.user_id);
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', post.user_id);

        if (error) throw error;

        setIsFollowing(false);
        console.log('Successfully unfollowed user');
      } else {
        console.log('Following user:', post.user_id);
        const { error } = await supabase
          .from('follows')
          .insert({
            follower_id: user.id,
            following_id: post.user_id,
          });

        if (error) throw error;

        setIsFollowing(true);
        console.log('Successfully followed user');
      }
    } catch (error: any) {
      console.error('Error toggling follow:', error);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleLike = () => {
    console.log('User tapped like button');
    // TODO: Implement like functionality
  };

  const handleComment = () => {
    console.log('User tapped comment button');
    // TODO: Implement comment functionality
  };

  const handleSave = () => {
    console.log('User tapped save button');
    // TODO: Open save to trips modal
  };

  const handleShare = () => {
    console.log('User tapped share button');
    // TODO: Implement share functionality
  };

  const displayName = post?.profiles?.display_name || 'Unknown User';
  const avatarUrl = post?.profiles?.avatar_url || '';
  const caption = post?.caption || '';
  const placeName = post?.place_name || '';
  const isOwnVideo = currentUserId === post?.user_id;

  const getInitials = (name: string) => {
    const names = name.split(' ');
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const initials = getInitials(displayName);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: bgColor }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar hidden />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={primaryColor} />
          <Text style={[styles.loadingText, { color: textColor }]}>Loading video...</Text>
        </View>
      </View>
    );
  }

  if (!post) {
    return (
      <View style={[styles.container, { backgroundColor: bgColor }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar hidden />
        <View style={styles.errorContainer}>
          <IconSymbol 
            android_material_icon_name="error" 
            size={64} 
            color={textSecondaryColor}
          />
          <Text style={[styles.errorText, { color: textColor }]}>Video not found</Text>
          <TouchableOpacity 
            style={[styles.backButton, { backgroundColor: primaryColor }]}
            onPress={handleClose}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar hidden />
      
      <TouchableOpacity 
        style={styles.videoContainer}
        activeOpacity={1}
        onPress={toggleControls}
      >
        <VideoView
          style={styles.video}
          player={player}
          nativeControls={false}
          contentFit="contain"
          allowsFullscreen={false}
          allowsPictureInPicture={false}
        />
      </TouchableOpacity>

      {showControls && (
        <>
          <View style={styles.topControls}>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={handleClose}
            >
              <IconSymbol 
                android_material_icon_name="close" 
                size={28} 
                color="#FFFFFF"
              />
            </TouchableOpacity>
          </View>

          <View style={styles.bottomInfo}>
            <ScrollView 
              style={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.infoContent}>
                <View style={styles.userRowContainer}>
                  <TouchableOpacity 
                    style={styles.userRow}
                    onPress={handleProfilePress}
                    activeOpacity={0.7}
                  >
                    {avatarUrl ? (
                      <Image 
                        source={resolveImageSource(avatarUrl)} 
                        style={styles.avatar}
                      />
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarInitials}>{initials}</Text>
                      </View>
                    )}
                    <Text style={styles.displayName}>{displayName}</Text>
                  </TouchableOpacity>
                  {!isOwnVideo && (
                    <TouchableOpacity
                      style={[
                        styles.followButtonSmall,
                        { backgroundColor: isFollowing ? 'rgba(255, 255, 255, 0.2)' : '#FF69B4' }
                      ]}
                      onPress={handleFollowToggle}
                      disabled={followLoading}
                      activeOpacity={0.7}
                    >
                      {followLoading ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.followButtonSmallText}>
                          {isFollowing ? 'Following' : 'Follow'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
                {caption ? (
                  <Text style={styles.caption}>{caption}</Text>
                ) : null}
                {placeName ? (
                  <TouchableOpacity 
                    style={styles.locationRow}
                    onPress={handleLocationPress}
                    activeOpacity={0.7}
                  >
                    <IconSymbol 
                      android_material_icon_name="location-on" 
                      size={16} 
                      color="#FF69B4"
                    />
                    <Text style={styles.placeName}>{placeName}</Text>
                  </TouchableOpacity>
                ) : null}
                
                <View style={styles.actionButtons}>
                  <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={handleLike}
                    activeOpacity={0.7}
                  >
                    <IconSymbol 
                      android_material_icon_name="favorite-border" 
                      size={28} 
                      color="#FFFFFF"
                    />
                    <Text style={styles.actionButtonText}>Like</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={handleComment}
                    activeOpacity={0.7}
                  >
                    <IconSymbol 
                      android_material_icon_name="chat-bubble-outline" 
                      size={28} 
                      color="#FFFFFF"
                    />
                    <Text style={styles.actionButtonText}>Comment</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={handleSave}
                    activeOpacity={0.7}
                  >
                    <IconSymbol 
                      android_material_icon_name={isSaved ? "bookmark" : "bookmark-border"} 
                      size={28} 
                      color={isSaved ? "#FF69B4" : "#FFFFFF"}
                    />
                    <Text style={styles.actionButtonText}>Save</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={handleShare}
                    activeOpacity={0.7}
                  >
                    <IconSymbol 
                      android_material_icon_name="share" 
                      size={28} 
                      color="#FFFFFF"
                    />
                    <Text style={styles.actionButtonText}>Share</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  videoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: width,
    height: height,
  },
  topControls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 50,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: height * 0.5,
    paddingBottom: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  infoContent: {
    gap: 12,
    paddingTop: 16,
  },
  userRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  followButtonSmall: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followButtonSmallText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#333',
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF69B4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  displayName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  caption: {
    fontSize: 16,
    color: '#FFFFFF',
    lineHeight: 22,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  placeName: {
    fontSize: 14,
    color: '#FF69B4',
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 8,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  actionButton: {
    alignItems: 'center',
    gap: 4,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
});
