
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useColorScheme, ActivityIndicator, Dimensions, StatusBar, Image, ImageSourcePropType, FlatList, Share, TextInput } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { supabase } from '@/lib/supabase';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { SaveToTripsModal } from '@/components/SaveToTripsModal';
import { Modal } from '@/components/ui/Modal';
import { Toast } from '@/components/ui/Toast';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { authenticatedApiCall } from '@/utils/api';

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

interface PostStats {
  like_count: number;
  comment_count: number;
  share_count: number;
}

interface Comment {
  id: string;
  comment_text: string;
  created_at: string;
  user_id: string;
  profiles?: {
    display_name: string;
    avatar_url: string | null;
  };
}

const { width, height } = Dimensions.get('window');

function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: '' };
  if (typeof source === 'string') return { uri: source };
  return source as ImageSourcePropType;
}

// Video Player Component - uses public URLs directly with tap to play/pause and mute toggle
function VideoPlayer({ videoUrl, postId, isMuted, onToggleMute }: { videoUrl: string; postId: string; isMuted: boolean; onToggleMute: () => void }) {
  const [isPlaying, setIsPlaying] = useState(true);
  const isMountedRef = useRef(true);

  const player = useVideoPlayer(videoUrl, (player) => {
    player.loop = true;
    player.muted = isMuted;
  });

  useEffect(() => {
    if (player) {
      player.muted = isMuted;
      console.log('Video mute state changed:', isMuted ? 'muted' : 'unmuted');
    }
  }, [isMuted, player]);

  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      try {
        if (player && player.playing) {
          player.pause();
        }
      } catch (error) {
        console.log('Error pausing video on unmount:', error);
      }
    };
  }, [player]);

  useEffect(() => {
    if (!player) return;
    
    const playTimeout = setTimeout(() => {
      if (isMountedRef.current && player.status === 'readyToPlay') {
        try {
          player.play();
          setIsPlaying(true);
          console.log('Video playing for post:', postId);
        } catch (error) {
          console.error('Error playing video:', error);
        }
      }
    }, 300);

    return () => {
      clearTimeout(playTimeout);
    };
  }, [player, postId]);

  const handleTap = () => {
    console.log('User tapped video center - toggling play/pause');
    if (!player) return;

    try {
      if (isPlaying) {
        player.pause();
        setIsPlaying(false);
        console.log('Video paused');
      } else {
        player.play();
        setIsPlaying(true);
        console.log('Video playing');
      }
    } catch (error) {
      console.error('Error toggling play/pause:', error);
    }
  };

  if (!videoUrl) {
    console.log('VideoPlayer: No video URL provided for post:', postId);
    return null;
  }

  return (
    <>
      <TouchableOpacity 
        style={styles.video} 
        activeOpacity={1} 
        onPress={handleTap}
      >
        <VideoView
          style={styles.video}
          player={player}
          nativeControls={false}
          contentFit="cover"
          allowsFullscreen={true}
          allowsPictureInPicture={false}
        />
        {!isPlaying && (
          <View style={styles.playPauseIndicator}>
            <IconSymbol 
              android_material_icon_name="play-arrow" 
              size={64} 
              color="#FFFFFF"
            />
          </View>
        )}
      </TouchableOpacity>
      
      {/* Mute/Unmute button - positioned at top right */}
      <TouchableOpacity 
        style={styles.muteButton}
        onPress={onToggleMute}
        activeOpacity={0.7}
      >
        <IconSymbol 
          android_material_icon_name={isMuted ? "volume-off" : "volume-up"} 
          size={24} 
          color="#FFFFFF"
        />
      </TouchableOpacity>
    </>
  );
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

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isSharing, setIsSharing] = useState(false);
  
  const [showMoreModal, setShowMoreModal] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
  
  const [postInteractions, setPostInteractions] = useState<Map<string, {
    isLiked: boolean;
    isSaved: boolean;
    stats: PostStats;
  }>>(new Map());
  
  const [likeLoading, setLikeLoading] = useState(false);
  
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [deleteCommentId, setDeleteCommentId] = useState<string | null>(null);
  const [showDeleteCommentModal, setShowDeleteCommentModal] = useState(false);
  
  const commentsSheetRef = useRef<BottomSheet>(null);
  const flatListRef = useRef<FlatList>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  const loadPostInteractions = useCallback(async (postId: string, userId: string) => {
    console.log('Loading interactions for post:', postId);
    
    try {
      const { data: likeData } = await supabase
        .from('post_likes')
        .select('*')
        .eq('post_id', postId)
        .eq('user_id', userId)
        .limit(1);
      
      const isLiked = likeData && likeData.length > 0;
      
      const { data: statsData } = await supabase
        .from('post_stats')
        .select('*')
        .eq('post_id', postId)
        .single();
      
      const stats = statsData ? {
        like_count: statsData.like_count || 0,
        comment_count: statsData.comment_count || 0,
        share_count: statsData.share_count || 0,
      } : { like_count: 0, comment_count: 0, share_count: 0 };
      
      // Check if post is saved to ANY of user's boards
      const { data: savedData } = await supabase
        .from('board_posts')
        .select('id, board_id, boards!inner(user_id)')
        .eq('post_id', postId)
        .eq('boards.user_id', userId)
        .limit(1);
      
      const isSaved = savedData && savedData.length > 0;
      console.log('Post saved status:', isSaved);
      
      setPostInteractions(prev => {
        const newMap = new Map(prev);
        newMap.set(postId, { isLiked, isSaved, stats });
        return newMap;
      });
    } catch (error) {
      console.error('Error loading post interactions:', error);
      setPostInteractions(prev => {
        const newMap = new Map(prev);
        newMap.set(postId, {
          isLiked: false,
          isSaved: false,
          stats: { like_count: 0, comment_count: 0, share_count: 0 }
        });
        return newMap;
      });
    }
  }, []);

  const checkBlockStatus = useCallback(async (targetUserId: string, currentUserId: string) => {
    console.log('[API] Checking block status for user:', targetUserId);
    try {
      const response = await authenticatedApiCall(`/api/blocks/check/${targetUserId}`, {
        method: 'GET',
      });
      
      if (response.ok) {
        const data = await response.json();
        setIsBlocked(data.isBlocked || false);
        console.log('[API] Block status:', data.isBlocked);
      } else {
        console.error('[API] Error checking block status:', response.status);
        setIsBlocked(false);
      }
    } catch (error) {
      console.error('[API] Error checking block status:', error);
      setIsBlocked(false);
    }
  }, []);

  const fetchPosts = useCallback(async () => {
    console.log('Loading video posts starting from ID:', id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }

      const { data: initialPost, error: initialError } = await supabase
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

      if (initialError) {
        console.error('Error fetching initial post:', initialError);
        setLoading(false);
        return;
      }

      if (user && initialPost) {
        await checkBlockStatus(initialPost.user_id, user.id);
      }

      let blockedUserIds: string[] = [];
      if (user) {
        try {
          const blocksResponse = await authenticatedApiCall('/api/blocks', {
            method: 'GET',
          });
          
          if (blocksResponse.ok) {
            const blocksData = await blocksResponse.json();
            console.log('[API] Blocked users fetched:', blocksData.length);
            blockedUserIds = blocksData.map((block: any) => 
              block.blockerId === user.id ? block.blockedId : block.blockerId
            );
          }
        } catch (error) {
          console.error('[API] Error fetching blocked users:', error);
        }
      }

      let query = supabase
        .from('posts')
        .select(`
          *,
          profiles!posts_user_id_fkey (
            display_name,
            avatar_url
          )
        `)
        .neq('id', id)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (blockedUserIds.length > 0) {
        query = query.not('user_id', 'in', `(${blockedUserIds.join(',')})`);
      }
      
      const { data: morePosts, error: moreError } = await query;

      const allPosts = [initialPost, ...(morePosts || [])];
      
      console.log('Posts fetched successfully:', allPosts.length);
      setPosts(allPosts);
      
      if (user && allPosts[0]) {
        await loadPostInteractions(allPosts[0].id, user.id);
      }
    } catch (error) {
      console.error('Error in fetchPosts:', error);
    } finally {
      setLoading(false);
    }
  }, [id, loadPostInteractions, checkBlockStatus]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchPosts();
    
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchPosts]);

  const handleViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      const newIndex = viewableItems[0].index;
      setCurrentIndex(newIndex);
      
      const currentPost = posts[newIndex];
      if (currentPost && currentUserId) {
        loadPostInteractions(currentPost.id, currentUserId);
        checkBlockStatus(currentPost.user_id, currentUserId);
        
        if (currentPost.user_id !== currentUserId) {
          supabase
            .from('follows')
            .select('*')
            .eq('follower_id', currentUserId)
            .eq('following_id', currentPost.user_id)
            .limit(1)
            .then(({ data }) => {
              setIsFollowing(data && data.length > 0);
            });
        } else {
          setIsFollowing(false);
        }
      }
    }
  }, [posts, currentUserId, loadPostInteractions, checkBlockStatus]);

  const viewabilityConfig = {
    itemVisiblePercentThreshold: 50,
  };

  const handleClose = () => {
    console.log('User tapped close button');
    router.back();
  };

  const handleLocationPress = (post: Post) => {
    if (post?.place_id) {
      console.log('User tapped location, navigating to location details:', post.place_id);
      router.push(`/location/${post.place_id}`);
    }
  };

  const handleProfilePress = (post: Post) => {
    if (post?.user_id) {
      console.log('User tapped profile, navigating to user profile:', post.user_id);
      router.push(`/user/${post.user_id}`);
    }
  };

  const handleFollowToggle = async (post: Post) => {
    console.log('User tapped follow/unfollow button');
    if (followLoading || !post?.user_id || !currentUserId) return;

    if (post.user_id === currentUserId) {
      console.log('Cannot follow yourself, ignoring action');
      return;
    }

    try {
      setFollowLoading(true);

      if (isFollowing) {
        console.log('Unfollowing user:', post.user_id);
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', currentUserId)
          .eq('following_id', post.user_id);

        if (error) throw error;

        setIsFollowing(false);
        console.log('Successfully unfollowed user');
      } else {
        console.log('Following user:', post.user_id);
        const { error } = await supabase
          .from('follows')
          .insert({
            follower_id: currentUserId,
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

  const handleLike = async (post: Post) => {
    console.log('User tapped like button for post:', post.id);
    if (likeLoading || !currentUserId) return;

    const currentInteraction = postInteractions.get(post.id);
    if (!currentInteraction) return;

    setLikeLoading(true);
    
    const wasLiked = currentInteraction.isLiked;
    setPostInteractions(prev => {
      const newMap = new Map(prev);
      const interaction = newMap.get(post.id);
      if (interaction) {
        newMap.set(post.id, {
          ...interaction,
          isLiked: !wasLiked,
          stats: {
            ...interaction.stats,
            like_count: wasLiked ? Math.max(0, interaction.stats.like_count - 1) : interaction.stats.like_count + 1,
          }
        });
      }
      return newMap;
    });

    try {
      if (wasLiked) {
        const { error } = await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', currentUserId);

        if (error) throw error;
        console.log('Post unliked successfully');
      } else {
        const { error } = await supabase
          .from('post_likes')
          .insert({
            post_id: post.id,
            user_id: currentUserId,
          });

        if (error) throw error;
        console.log('Post liked successfully');
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      setPostInteractions(prev => {
        const newMap = new Map(prev);
        const interaction = newMap.get(post.id);
        if (interaction) {
          newMap.set(post.id, {
            ...interaction,
            isLiked: wasLiked,
            stats: {
              ...interaction.stats,
              like_count: wasLiked ? interaction.stats.like_count + 1 : Math.max(0, interaction.stats.like_count - 1),
            }
          });
        }
        return newMap;
      });
    } finally {
      setLikeLoading(false);
    }
  };

  const handleComment = async (post: Post) => {
    console.log('User tapped comment button - opening comments');
    setShowCommentsModal(true);
    commentsSheetRef.current?.expand();
    
    setCommentsLoading(true);
    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`
          *,
          profiles!comments_user_id_fkey (
            display_name,
            avatar_url
          )
        `)
        .eq('post_id', post.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      setComments(data || []);
      console.log('Comments loaded:', data?.length || 0);
    } catch (error) {
      console.error('Error loading comments:', error);
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleSubmitComment = async () => {
    const trimmedComment = newComment.trim();
    if (!trimmedComment || commentSubmitting || !currentUserId) return;

    const currentPost = posts[currentIndex];
    if (!currentPost) return;

    console.log('Submitting comment:', trimmedComment);
    setCommentSubmitting(true);

    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({
          post_id: currentPost.id,
          user_id: currentUserId,
          comment_text: trimmedComment,
        })
        .select(`
          *,
          profiles!comments_user_id_fkey (
            display_name,
            avatar_url
          )
        `)
        .single();

      if (error) throw error;

      console.log('Comment submitted successfully');
      setComments(prev => [...prev, data]);
      
      setPostInteractions(prev => {
        const newMap = new Map(prev);
        const interaction = newMap.get(currentPost.id);
        if (interaction) {
          newMap.set(currentPost.id, {
            ...interaction,
            stats: {
              ...interaction.stats,
              comment_count: interaction.stats.comment_count + 1,
            }
          });
        }
        return newMap;
      });
      
      setNewComment('');
    } catch (error) {
      console.error('Error submitting comment:', error);
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleDeleteComment = (commentId: string, commentUserId: string) => {
    console.log('User long-pressed comment - checking ownership');
    
    if (commentUserId !== currentUserId) {
      console.warn('Cannot delete another user\'s comment');
      return;
    }
    
    setDeleteCommentId(commentId);
    setShowDeleteCommentModal(true);
  };

  const confirmDeleteComment = async () => {
    if (!deleteCommentId || !currentUserId) return;

    console.log('User confirmed delete comment:', deleteCommentId);
    
    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', deleteCommentId)
        .eq('user_id', currentUserId);

      if (error) throw error;

      console.log('Comment deleted successfully');
      
      setComments(prev => prev.filter(c => c.id !== deleteCommentId));
      
      const currentPost = posts[currentIndex];
      if (currentPost) {
        setPostInteractions(prev => {
          const newMap = new Map(prev);
          const interaction = newMap.get(currentPost.id);
          if (interaction) {
            newMap.set(currentPost.id, {
              ...interaction,
              stats: {
                ...interaction.stats,
                comment_count: Math.max(0, interaction.stats.comment_count - 1),
              }
            });
          }
          return newMap;
        });
      }
      
      setShowDeleteCommentModal(false);
      setDeleteCommentId(null);
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  const handleToggleMute = () => {
    console.log('User toggled mute/unmute');
    setIsMuted(prev => !prev);
  };

  const handleSave = (post: Post) => {
    console.log('User tapped save button - opening Save to Trips modal');
    setSelectedPostId(post.id);
    setShowSaveModal(true);
  };

  const handleSaveModalClose = () => {
    console.log('Closing Save to Trips modal');
    setShowSaveModal(false);
    setSelectedPostId(null);
    
    // Refresh saved state for current post
    const currentPost = posts[currentIndex];
    if (currentPost && currentUserId) {
      loadPostInteractions(currentPost.id, currentUserId);
    }
  };

  const handleShare = async (post: Post) => {
    console.log('User tapped share button for post:', post.id);
    
    if (!post.video_url) {
      console.warn('Share failed: No video URL available');
      showToast('No share link available', 'error');
      return;
    }
    
    if (isSharing) {
      console.log('Share already in progress, ignoring tap');
      return;
    }
    
    setIsSharing(true);
    
    try {
      let shareMessage = post.caption || '';
      
      if (post.place_name) {
        shareMessage = shareMessage 
          ? `${shareMessage} • ${post.place_name}` 
          : post.place_name;
      }
      
      console.log('Sharing with message:', shareMessage);
      console.log('Sharing video URL:', post.video_url);
      
      const result = await Share.share({
        message: shareMessage,
        url: post.video_url,
      });

      console.log('Share result:', result);

      if (result.action === Share.sharedAction) {
        console.log('User completed share successfully');
        
        if (currentUserId) {
          try {
            const { error: insertError } = await supabase
              .from('post_shares')
              .insert({
                post_id: post.id,
                user_id: currentUserId,
                share_target: 'system',
              });
            
            if (insertError) {
              console.error('Error logging share:', insertError);
            } else {
              console.log('Share logged to database successfully');
              await loadPostInteractions(post.id, currentUserId);
            }
          } catch (dbError) {
            console.error('Database error logging share:', dbError);
          }
        }
        
        showToast('Shared', 'success');
      } else if (result.action === Share.dismissedAction) {
        console.log('User cancelled share');
      }
    } catch (error) {
      console.error('Error sharing:', error);
      showToast('Couldn\'t share', 'error');
    } finally {
      setIsSharing(false);
    }
  };

  const handleMoreOptions = (post: Post) => {
    console.log('User tapped more options button');
    const currentPost = posts[currentIndex];
    if (currentPost && currentPost.user_id === currentUserId) {
      console.log('Cannot block/report yourself');
      return;
    }
    setShowMoreModal(true);
  };

  const handleBlockUser = async () => {
    console.log('[API] User tapped block user');
    const currentPost = posts[currentIndex];
    if (!currentPost || !currentUserId) return;

    if (currentPost.user_id === currentUserId) {
      console.log('Cannot block yourself');
      showToast('Cannot block yourself', 'error');
      return;
    }

    setShowMoreModal(false);
    setBlockLoading(true);

    try {
      if (isBlocked) {
        console.log('[API] Unblocking user:', currentPost.user_id);
        const response = await authenticatedApiCall(`/api/blocks/${currentPost.user_id}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error('Failed to unblock user');
        }

        const data = await response.json();
        console.log('[API] Unblock response:', data);

        setIsBlocked(false);
        showToast('User unblocked', 'success');
        console.log('[API] User unblocked successfully');
      } else {
        console.log('[API] Blocking user:', currentPost.user_id);
        const response = await authenticatedApiCall('/api/blocks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            blocked_id: currentPost.user_id,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to block user');
        }

        const data = await response.json();
        console.log('[API] Block response:', data);

        console.log('Unfollowing blocked user');
        await supabase
          .from('follows')
          .delete()
          .or(`and(follower_id.eq.${currentUserId},following_id.eq.${currentPost.user_id}),and(follower_id.eq.${currentPost.user_id},following_id.eq.${currentUserId})`);

        setIsBlocked(true);
        setIsFollowing(false);
        showToast('User blocked', 'success');
        console.log('[API] User blocked successfully');

        setTimeout(() => {
          router.back();
        }, 1000);
      }
    } catch (error) {
      console.error('[API] Error blocking/unblocking user:', error);
      showToast('Failed to update block status', 'error');
    } finally {
      setBlockLoading(false);
    }
  };

  const handleReportUser = () => {
    console.log('User tapped report user');
    setShowMoreModal(false);
    showToast('Report functionality coming soon', 'info');
  };

  const getInitials = (name: string) => {
    if (!name) return '??';
    const names = name.split(' ');
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const renderBackdrop = (props: any) => (
    <BottomSheetBackdrop
      {...props}
      disappearsOnIndex={-1}
      appearsOnIndex={0}
      opacity={0.5}
      pressBehavior="close"
    />
  );

  const renderVideoItem = ({ item: post }: { item: Post }) => {
    if (!post?.video_url) {
      console.log('Post missing video_url, skipping render for post:', post?.id);
      return null;
    }

    const displayName = post?.profiles?.display_name || 'Unknown User';
    const avatarUrl = post?.profiles?.avatar_url || '';
    const caption = post?.caption || '';
    const placeName = post?.place_name || '';
    const isOwnVideo = currentUserId === post?.user_id;
    const initials = getInitials(displayName);
    
    const interaction = postInteractions.get(post.id) || {
      isLiked: false,
      isSaved: false,
      stats: { like_count: 0, comment_count: 0, share_count: 0 }
    };
    
    const likeCountText = String(interaction.stats.like_count);
    const commentCountText = String(interaction.stats.comment_count);
    const shareCountText = String(interaction.stats.share_count);
    
    const shareDisabled = !post.video_url || isSharing;

    return (
      <View style={styles.videoSlide}>
        <VideoPlayer 
          videoUrl={post.video_url} 
          postId={post.id} 
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
        />
        
        <View style={styles.overlay}>
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
            <View style={styles.infoContent}>
              <View style={styles.userRowContainer}>
                <TouchableOpacity 
                  style={styles.userRow}
                  onPress={() => handleProfilePress(post)}
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
                    onPress={() => handleFollowToggle(post)}
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
                <Text style={styles.caption} numberOfLines={3}>{caption}</Text>
              ) : null}
              {placeName ? (
                <TouchableOpacity 
                  style={styles.locationRow}
                  onPress={() => handleLocationPress(post)}
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
                  onPress={() => handleLike(post)}
                  disabled={likeLoading}
                  activeOpacity={0.7}
                >
                  <IconSymbol 
                    android_material_icon_name={interaction.isLiked ? "favorite" : "favorite-border"} 
                    size={28} 
                    color={interaction.isLiked ? "#FF69B4" : "#FFFFFF"}
                  />
                  <Text style={styles.actionButtonText}>{likeCountText}</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={() => handleComment(post)}
                  activeOpacity={0.7}
                >
                  <IconSymbol 
                    android_material_icon_name="chat-bubble-outline" 
                    size={28} 
                    color="#FFFFFF"
                  />
                  <Text style={styles.actionButtonText}>{commentCountText}</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={() => handleSave(post)}
                  activeOpacity={0.7}
                >
                  <IconSymbol 
                    android_material_icon_name={interaction.isSaved ? "bookmark" : "bookmark-border"} 
                    size={28} 
                    color={interaction.isSaved ? "#FF69B4" : "#FFFFFF"}
                  />
                  <Text style={styles.actionButtonText}>Save</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.actionButton, { opacity: shareDisabled ? 0.5 : 1 }]}
                  onPress={() => handleShare(post)}
                  disabled={shareDisabled}
                  activeOpacity={0.7}
                >
                  <IconSymbol 
                    android_material_icon_name="share" 
                    size={28} 
                    color="#FFFFFF"
                  />
                  <Text style={styles.actionButtonText}>{shareCountText}</Text>
                </TouchableOpacity>
                
                {!isOwnVideo && (
                  <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={() => handleMoreOptions(post)}
                    activeOpacity={0.7}
                  >
                    <IconSymbol 
                      android_material_icon_name="more-horiz" 
                      size={28} 
                      color="#FFFFFF"
                    />
                    <Text style={styles.actionButtonText}>More</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: bgColor }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar hidden />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={primaryColor} />
          <Text style={[styles.loadingText, { color: textColor }]}>Loading videos...</Text>
        </View>
      </View>
    );
  }

  if (posts.length === 0) {
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

  const selectedPost = selectedPostId ? posts.find(p => p.id === selectedPostId) : null;
  const currentPost = posts[currentIndex];
  const blockButtonText = isBlocked ? 'Unblock User' : 'Block User';

  return (
    <GestureHandlerRootView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar hidden />
      
      <FlatList
        ref={flatListRef}
        data={posts}
        renderItem={renderVideoItem}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={height}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={handleViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        removeClippedSubviews
        maxToRenderPerBatch={2}
        windowSize={3}
      />

      <Modal
        visible={showMoreModal}
        onClose={() => setShowMoreModal(false)}
        title="More Options"
      >
        <View style={{ gap: 12, marginBottom: 20 }}>
          <TouchableOpacity
            style={[styles.modalOptionButton, { borderBottomColor: textSecondaryColor }]}
            onPress={handleBlockUser}
            disabled={blockLoading}
            activeOpacity={0.7}
          >
            {blockLoading ? (
              <ActivityIndicator size="small" color={primaryColor} />
            ) : (
              <>
                <IconSymbol 
                  android_material_icon_name={isBlocked ? "check-circle" : "block"} 
                  size={24} 
                  color={isBlocked ? primaryColor : '#FF3B30'}
                />
                <Text style={[styles.modalOptionText, { color: isBlocked ? primaryColor : '#FF3B30' }]}>
                  {blockButtonText}
                </Text>
              </>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.modalOptionButton}
            onPress={handleReportUser}
            activeOpacity={0.7}
          >
            <IconSymbol 
              android_material_icon_name="flag" 
              size={24} 
              color={textColor}
            />
            <Text style={[styles.modalOptionText, { color: textColor }]}>Report User</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {showCommentsModal && (
        <BottomSheet
          ref={commentsSheetRef}
          index={0}
          snapPoints={['75%']}
          enablePanDownToClose
          onClose={() => setShowCommentsModal(false)}
          backdropComponent={renderBackdrop}
          backgroundStyle={{ backgroundColor: bgColor }}
          handleIndicatorStyle={{ backgroundColor: textSecondaryColor }}
        >
          <View style={[styles.commentsContainer, { backgroundColor: bgColor }]}>
            <Text style={[styles.commentsTitle, { color: textColor }]}>Comments</Text>
            
            <BottomSheetScrollView style={styles.commentsList}>
              {commentsLoading ? (
                <ActivityIndicator size="large" color={primaryColor} style={{ marginTop: 20 }} />
              ) : comments.length === 0 ? (
                <Text style={[styles.noCommentsText, { color: textSecondaryColor }]}>
                  No comments yet. Be the first to comment!
                </Text>
              ) : (
                comments.map((comment) => {
                  const commentDisplayName = comment.profiles?.display_name || 'Unknown User';
                  const commentAvatarUrl = comment.profiles?.avatar_url || '';
                  const commentInitials = getInitials(commentDisplayName);
                  const commentText = comment.comment_text || '';
                  const isOwnComment = comment.user_id === currentUserId;
                  
                  return (
                    <TouchableOpacity
                      key={comment.id}
                      style={styles.commentItem}
                      onLongPress={() => isOwnComment ? handleDeleteComment(comment.id, comment.user_id) : null}
                      activeOpacity={isOwnComment ? 0.7 : 1}
                    >
                      <View style={styles.commentHeader}>
                        {commentAvatarUrl ? (
                          <Image 
                            source={resolveImageSource(commentAvatarUrl)} 
                            style={styles.commentAvatar}
                          />
                        ) : (
                          <View style={styles.commentAvatarPlaceholder}>
                            <Text style={styles.commentAvatarInitials}>{commentInitials}</Text>
                          </View>
                        )}
                        <View style={styles.commentContent}>
                          <View style={styles.commentAuthorRow}>
                            <Text style={[styles.commentAuthor, { color: textColor }]}>
                              {commentDisplayName}
                            </Text>
                            {isOwnComment && (
                              <Text style={[styles.commentYouBadge, { color: primaryColor }]}>You</Text>
                            )}
                          </View>
                          <Text style={[styles.commentText, { color: textColor }]}>
                            {commentText}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </BottomSheetScrollView>
            
            <View style={[styles.commentInputContainer, { backgroundColor: bgColor, borderTopColor: textSecondaryColor }]}>
              <TextInput
                style={[styles.commentInput, { backgroundColor: isDark ? '#333' : '#F0F0F0', color: textColor }]}
                placeholder="Add a comment..."
                placeholderTextColor={textSecondaryColor}
                value={newComment}
                onChangeText={setNewComment}
                multiline
              />
              <TouchableOpacity
                style={[styles.commentSendButton, { backgroundColor: primaryColor, opacity: (!newComment.trim() || commentSubmitting) ? 0.5 : 1 }]}
                onPress={handleSubmitComment}
                disabled={commentSubmitting || !newComment.trim()}
              >
                {commentSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <IconSymbol 
                    android_material_icon_name="send" 
                    size={20} 
                    color="#FFFFFF"
                  />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </BottomSheet>
      )}

      <Modal
        visible={showDeleteCommentModal}
        onClose={() => {
          setShowDeleteCommentModal(false);
          setDeleteCommentId(null);
        }}
        title="Delete Comment?"
        message="This will permanently delete your comment."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDeleteComment}
        confirmColor="#FF3B30"
      />

      {selectedPost && (
        <SaveToTripsModal
          isVisible={showSaveModal}
          onClose={handleSaveModalClose}
          postId={selectedPost.id}
          placeId={selectedPost.place_id}
          placeName={selectedPost.place_name}
          locationType={selectedPost.location_type}
        />
      )}

      <Toast
        message={toastMessage}
        visible={toastVisible}
        onHide={() => setToastVisible(false)}
        type={toastType}
      />
    </GestureHandlerRootView>
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
  videoSlide: {
    width: width,
    height: height,
    backgroundColor: '#000000',
  },
  video: {
    width: width,
    height: height,
  },
  playPauseIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -32 }, { translateY: -32 }],
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 40,
    padding: 12,
  },
  muteButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 8,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  topControls: {
    paddingTop: 50,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'flex-end',
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
    paddingBottom: 40,
    paddingHorizontal: 16,
  },
  infoContent: {
    gap: 12,
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
    paddingTop: 12,
    paddingBottom: 8,
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
  commentsContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  commentsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  commentsList: {
    flex: 1,
  },
  noCommentsText: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
  },
  commentItem: {
    marginBottom: 16,
  },
  commentHeader: {
    flexDirection: 'row',
    gap: 12,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333',
  },
  commentAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF69B4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentAvatarInitials: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  commentContent: {
    flex: 1,
  },
  commentAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: '600',
  },
  commentYouBadge: {
    fontSize: 12,
    fontWeight: '600',
  },
  commentText: {
    fontSize: 14,
    lineHeight: 20,
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 12,
    paddingBottom: 20,
    borderTopWidth: 1,
  },
  commentInput: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
  },
  commentSendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalOptionText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
