
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useColorScheme, ActivityIndicator, RefreshControl, Dimensions, Modal, TextInput, FlatList, ViewToken, Image, ImageSourcePropType } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/styles/commonStyles';
import { supabase } from '@/lib/supabase';
import { VideoGridItem } from '@/components/VideoGridItem';
import { MiniVideoPreview } from '@/components/MiniVideoPreview';
import { getBoardPlaces } from '@/utils/api';
import CustomModal from '@/components/ui/Modal';

interface Board {
  id: string;
  user_id: string;
  title: string;
  cover_url: string | null;
  created_at: string;
}

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

interface BoardPlace {
  id: string;
  board_id: string;
  place_id: string;
  place_name: string | null;
  place_primary_type: string | null;
  place_address: string | null;
  post_id: string | null;
  created_at: string;
}

type TabType = 'videos' | 'places';

const windowWidth = Dimensions.get('window').width;
const videoCardWidth = (windowWidth - 48) / 2;

function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: '' };
  if (typeof source === 'string') return { uri: source };
  return source as ImageSourcePropType;
}

export default function BoardDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const boardId = params.id as string;
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const bgColor = isDark ? colors.backgroundDark : colors.background;
  const textColor = isDark ? colors.textDark : colors.text;
  const textSecondaryColor = isDark ? colors.textSecondaryDark : colors.textSecondary;
  const cardColor = isDark ? colors.cardDark : colors.card;
  const primaryColor = isDark ? colors.primaryDark : colors.primary;

  const [board, setBoard] = useState<Board | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [places, setPlaces] = useState<BoardPlace[]>([]);
  const [placesWithVideos, setPlacesWithVideos] = useState<Map<string, Post>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('videos');
  const [visibleVideoIds, setVisibleVideoIds] = useState<Set<string>>(new Set());
  const [visiblePlaceIds, setVisiblePlaceIds] = useState<Set<string>>(new Set());
  const [coverImageUrl, setCoverImageUrl] = useState<string>('');
  const [modalState, setModalState] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info';
    onConfirm?: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
  });

  const fetchBoardDetails = useCallback(async () => {
    console.log('Fetching board details for:', boardId);
    try {
      const { data: boardData, error: boardError } = await supabase
        .from('boards')
        .select('*')
        .eq('id', boardId)
        .single();

      if (boardError) {
        console.error('Error fetching board:', boardError);
        setLoading(false);
        return;
      }

      setBoard(boardData);
      setEditTitle(boardData.title);

      const { data: postsData, error: postsError } = await supabase
        .from('board_posts')
        .select(`
          post_id,
          posts (
            id,
            user_id,
            video_url,
            thumbnail_url,
            caption,
            place_id,
            place_name,
            location_type,
            created_at
          )
        `)
        .eq('board_id', boardId)
        .order('created_at', { ascending: false });

      if (postsError) {
        console.error('Error fetching board posts:', postsError);
        setPosts([]);
      } else {
        const postsArray = (postsData || [])
          .map(item => item.posts)
          .filter(post => post !== null) as Post[];
        
        console.log('Board posts fetched successfully:', postsArray.length);
        setPosts(postsArray);
        
        let resolvedCoverUrl = '';
        if (boardData.cover_url) {
          resolvedCoverUrl = boardData.cover_url;
        } else if (postsArray.length > 0 && postsArray[0].thumbnail_url) {
          resolvedCoverUrl = postsArray[0].thumbnail_url;
        }
        setCoverImageUrl(resolvedCoverUrl);
      }

      // Fetch places using backend API
      try {
        const placesData = await getBoardPlaces(boardId);
        console.log('Board places fetched successfully from backend:', placesData?.length || 0);
        setPlaces(placesData || []);
        
        // Fetch videos for places that have post_id
        const videosMap = new Map<string, Post>();
        const postIds = (placesData || [])
          .map(p => p.post_id)
          .filter(Boolean) as string[];
        
        if (postIds.length > 0) {
          const { data: postsForPlaces } = await supabase
            .from('posts')
            .select('id, video_url, thumbnail_url, caption')
            .in('id', postIds);
          
          if (postsForPlaces) {
            postsForPlaces.forEach(post => {
              videosMap.set(post.id, post as Post);
            });
          }
        }
        
        setPlacesWithVideos(videosMap);
      } catch (placesError) {
        console.error('Error fetching board places from backend:', placesError);
        setPlaces([]);
      }
    } catch (error) {
      console.error('Error in fetchBoardDetails:', error);
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    fetchBoardDetails();
  }, [fetchBoardDetails]);

  const onRefresh = useCallback(async () => {
    console.log('User pulled to refresh board');
    setRefreshing(true);
    await fetchBoardDetails();
    setRefreshing(false);
  }, [fetchBoardDetails]);

  const handleBack = () => {
    console.log('User tapped back button');
    router.back();
  };

  const handleVideoPress = (post: Post) => {
    console.log('User tapped video:', post.id);
    router.push(`/video/${post.id}`);
  };

  const handlePlacePress = (place: BoardPlace) => {
    console.log('User tapped place:', place.place_id);
    if (place.post_id) {
      router.push(`/video/${place.post_id}`);
    } else if (place.place_id) {
      router.push(`/location/${place.place_id}`);
    }
  };

  const handleEditBoard = () => {
    console.log('User tapped edit board');
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim()) {
      setModalState({
        visible: true,
        title: 'Error',
        message: 'Please enter a title',
        type: 'error',
      });
      return;
    }

    console.log('Saving board title:', editTitle);
    try {
      const { error } = await supabase
        .from('boards')
        .update({ title: editTitle.trim() })
        .eq('id', boardId);

      if (error) {
        console.error('Error updating board:', error);
        setModalState({
          visible: true,
          title: 'Error',
          message: 'Could not update trip',
          type: 'error',
        });
      } else {
        console.log('Board updated successfully');
        setBoard(prev => prev ? { ...prev, title: editTitle.trim() } : null);
        setEditModalVisible(false);
      }
    } catch (error) {
      console.error('Error in handleSaveEdit:', error);
      setModalState({
        visible: true,
        title: 'Error',
        message: 'Could not update trip',
        type: 'error',
      });
    }
  };

  const handleDeleteBoard = () => {
    console.log('User tapped delete board');
    setDeleteModalVisible(true);
  };

  const confirmDelete = async () => {
    console.log('User confirmed delete board');
    try {
      const { error } = await supabase
        .from('boards')
        .delete()
        .eq('id', boardId);

      if (error) {
        console.error('Error deleting board:', error);
        setModalState({
          visible: true,
          title: 'Error',
          message: 'Could not delete trip',
          type: 'error',
        });
      } else {
        console.log('Board deleted successfully');
        setDeleteModalVisible(false);
        router.back();
      }
    } catch (error) {
      console.error('Error in confirmDelete:', error);
      setModalState({
        visible: true,
        title: 'Error',
        message: 'Could not delete trip',
        type: 'error',
      });
    }
  };

  const handleSaveFromHome = () => {
    console.log('User tapped Save from Home');
    router.push('/(tabs)/(home)');
  };

  const onViewableVideosChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const visibleIds = new Set(
      viewableItems
        .map(item => item.item?.id)
        .filter(Boolean)
    );
    console.log('Viewable videos changed:', visibleIds.size);
    setVisibleVideoIds(visibleIds);
  }).current;

  const onViewablePlacesChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const visibleIds = new Set(
      viewableItems
        .map(item => item.item?.id)
        .filter(Boolean)
    );
    console.log('Viewable places changed:', visibleIds.size);
    setVisiblePlaceIds(visibleIds);
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const renderVideoItem = ({ item, index }: { item: Post; index: number }) => {
    const shouldPlay = visibleVideoIds.has(item.id);
    return (
      <View style={[styles.videoCard, { width: videoCardWidth }]}>
        <MiniVideoPreview
          videoUrl={item.video_url}
          posterUrl={item.thumbnail_url || undefined}
          size={videoCardWidth}
          borderRadius={12}
          shouldPlay={shouldPlay}
        />
        <TouchableOpacity
          style={styles.videoOverlay}
          onPress={() => handleVideoPress(item)}
          activeOpacity={0.9}
        />
      </View>
    );
  };

  const renderPlaceItem = ({ item }: { item: BoardPlace }) => {
    const placeName = item.place_name || 'Unknown Place';
    const placeType = item.place_primary_type || '';
    const placeAddress = item.place_address || 'No address available';
    const shouldPlayVideo = visiblePlaceIds.has(item.id);
    
    const videoData = item.post_id ? placesWithVideos.get(item.post_id) : null;

    return (
      <TouchableOpacity
        style={[styles.placeCard, { backgroundColor: cardColor }]}
        onPress={() => handlePlacePress(item)}
        activeOpacity={0.8}
      >
        {videoData?.video_url ? (
          <MiniVideoPreview
            videoUrl={videoData.video_url}
            posterUrl={videoData.thumbnail_url || undefined}
            size={72}
            borderRadius={12}
            shouldPlay={shouldPlayVideo}
          />
        ) : (
          <View style={[styles.placeIconContainer, { backgroundColor: isDark ? '#333' : '#F5F5F5' }]}>
            <IconSymbol 
              android_material_icon_name="location-on" 
              size={24} 
              color={primaryColor}
            />
          </View>
        )}
        <View style={styles.placeInfo}>
          <Text style={[styles.placeName, { color: textColor }]} numberOfLines={1}>
            {placeName}
          </Text>
          {placeType ? (
            <Text style={[styles.placeType, { color: textSecondaryColor }]} numberOfLines={1}>
              {placeType}
            </Text>
          ) : null}
          <Text style={[styles.placeAddress, { color: textSecondaryColor }]} numberOfLines={1}>
            {placeAddress}
          </Text>
        </View>
        <IconSymbol 
          android_material_icon_name="arrow-forward" 
          size={20} 
          color={textSecondaryColor}
        />
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: bgColor }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={primaryColor} />
          <Text style={[styles.loadingText, { color: textColor }]}>Loading trip...</Text>
        </View>
      </View>
    );
  }

  if (!board) {
    return (
      <View style={[styles.container, { backgroundColor: bgColor }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.errorContainer}>
          <IconSymbol 
            android_material_icon_name="error" 
            size={64} 
            color={textSecondaryColor}
          />
          <Text style={[styles.errorText, { color: textColor }]}>Trip not found</Text>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: primaryColor }]}
            onPress={handleBack}
            activeOpacity={0.8}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const videoCountText = posts.length === 1 ? '1 video' : `${posts.length} videos`;
  const placeCountText = places.length === 1 ? '1 place' : `${places.length} places`;
  const countsText = `${videoCountText} • ${placeCountText}`;

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={primaryColor}
            colors={[primaryColor]}
          />
        }
      >
        <View style={styles.coverSection}>
          {coverImageUrl ? (
            <Image
              source={resolveImageSource(coverImageUrl)}
              style={styles.coverImage}
              resizeMode="cover"
            />
          ) : (
            <LinearGradient
              colors={['#FF69B4', '#FF8C94', '#FFA07A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.coverImagePlaceholder}
            >
              <IconSymbol 
                android_material_icon_name="location-on" 
                size={64} 
                color="rgba(255, 255, 255, 0.8)"
              />
            </LinearGradient>
          )}
          <LinearGradient
            colors={['rgba(0, 0, 0, 0.6)', 'transparent', 'rgba(0, 0, 0, 0.8)']}
            style={styles.coverOverlay}
          >
            <View style={styles.coverHeader}>
              <TouchableOpacity
                style={styles.coverHeaderButton}
                onPress={handleBack}
                activeOpacity={0.7}
              >
                <IconSymbol 
                  android_material_icon_name="arrow-back" 
                  size={24} 
                  color="#FFFFFF"
                />
              </TouchableOpacity>
              <View style={styles.coverHeaderActions}>
                <TouchableOpacity
                  style={styles.coverHeaderButton}
                  onPress={handleEditBoard}
                  activeOpacity={0.7}
                >
                  <IconSymbol 
                    android_material_icon_name="edit" 
                    size={24} 
                    color="#FFFFFF"
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.coverHeaderButton}
                  onPress={handleDeleteBoard}
                  activeOpacity={0.7}
                >
                  <IconSymbol 
                    android_material_icon_name="delete" 
                    size={24} 
                    color="#FF3B30"
                  />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.coverInfo}>
              <Text style={styles.coverTitle}>{board.title}</Text>
              <Text style={styles.coverCounts}>{countsText}</Text>
            </View>
          </LinearGradient>
        </View>

        <View style={[styles.segmentedControl, { backgroundColor: isDark ? '#222' : '#F0F0F0' }]}>
          <TouchableOpacity
            style={[
              styles.segmentButton,
              activeTab === 'videos' && { backgroundColor: isDark ? '#444' : '#FFFFFF' }
            ]}
            onPress={() => setActiveTab('videos')}
            activeOpacity={0.8}
          >
            <Text style={[
              styles.segmentText,
              { color: activeTab === 'videos' ? textColor : textSecondaryColor },
              activeTab === 'videos' && styles.segmentTextActive
            ]}>
              Videos
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.segmentButton,
              activeTab === 'places' && { backgroundColor: isDark ? '#444' : '#FFFFFF' }
            ]}
            onPress={() => setActiveTab('places')}
            activeOpacity={0.8}
          >
            <Text style={[
              styles.segmentText,
              { color: activeTab === 'places' ? textColor : textSecondaryColor },
              activeTab === 'places' && styles.segmentTextActive
            ]}>
              Places
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'videos' ? (
          posts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <IconSymbol 
                android_material_icon_name="videocam" 
                size={64} 
                color={textSecondaryColor}
              />
              <Text style={[styles.emptyTitle, { color: textColor }]}>
                No videos saved yet
              </Text>
              <Text style={[styles.emptyText, { color: textSecondaryColor }]}>
                Save videos from your feed to this trip
              </Text>
              <TouchableOpacity
                style={[styles.emptyButton, { backgroundColor: primaryColor }]}
                onPress={handleSaveFromHome}
                activeOpacity={0.8}
              >
                <Text style={styles.emptyButtonText}>Save from Home</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={posts}
              renderItem={renderVideoItem}
              keyExtractor={(item) => item.id}
              numColumns={2}
              columnWrapperStyle={styles.videoRow}
              contentContainerStyle={styles.videosContainer}
              scrollEnabled={false}
              onViewableItemsChanged={onViewableVideosChanged}
              viewabilityConfig={viewabilityConfig}
            />
          )
        ) : (
          places.length === 0 ? (
            <View style={styles.emptyContainer}>
              <IconSymbol 
                android_material_icon_name="location-on" 
                size={64} 
                color={textSecondaryColor}
              />
              <Text style={[styles.emptyTitle, { color: textColor }]}>
                No places saved yet
              </Text>
              <Text style={[styles.emptyText, { color: textSecondaryColor }]}>
                Save videos with locations to see them here
              </Text>
              <TouchableOpacity
                style={[styles.emptyButton, { backgroundColor: primaryColor }]}
                onPress={handleSaveFromHome}
                activeOpacity={0.8}
              >
                <Text style={styles.emptyButtonText}>Save video + location</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={places}
              renderItem={renderPlaceItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.placesContainer}
              scrollEnabled={false}
              onViewableItemsChanged={onViewablePlacesChanged}
              viewabilityConfig={viewabilityConfig}
            />
          )
        )}
      </ScrollView>

      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: cardColor }]}>
            <Text style={[styles.modalTitle, { color: textColor }]}>Edit Trip</Text>
            <TextInput
              style={[styles.input, { color: textColor, borderColor: isDark ? '#444' : '#DDD', backgroundColor: bgColor }]}
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder="Trip name"
              placeholderTextColor={textSecondaryColor}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: isDark ? '#444' : '#E0E0E0' }]}
                onPress={() => setEditModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={[styles.modalButtonText, { color: textColor }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: primaryColor }]}
                onPress={handleSaveEdit}
                activeOpacity={0.8}
              >
                <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: cardColor }]}>
            <Text style={[styles.modalTitle, { color: textColor }]}>Delete Trip?</Text>
            <Text style={[styles.modalMessage, { color: textSecondaryColor }]}>
              This will permanently delete this trip and remove all saved videos from it.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: isDark ? '#444' : '#E0E0E0' }]}
                onPress={() => setDeleteModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={[styles.modalButtonText, { color: textColor }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#FF3B30' }]}
                onPress={confirmDelete}
                activeOpacity={0.8}
              >
                <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <CustomModal
        visible={modalState.visible}
        title={modalState.title}
        message={modalState.message}
        type={modalState.type}
        onClose={() => {
          setModalState({ ...modalState, visible: false });
          if (modalState.onConfirm) {
            modalState.onConfirm();
          }
        }}
        confirmText="OK"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  coverSection: {
    position: 'relative',
    height: 300,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  coverHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
  },
  coverHeaderButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 22,
  },
  coverHeaderActions: {
    flexDirection: 'row',
    gap: 8,
  },
  coverInfo: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  coverTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  coverCounts: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.95)',
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  segmentedControl: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 16,
    borderRadius: 10,
    padding: 4,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentText: {
    fontSize: 15,
    fontWeight: '500',
  },
  segmentTextActive: {
    fontWeight: '600',
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
    paddingHorizontal: 32,
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
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  videosContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  videoRow: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  videoCard: {
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  placesContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  placeIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeInfo: {
    flex: 1,
  },
  placeName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  placeType: {
    fontSize: 13,
    marginBottom: 2,
  },
  placeAddress: {
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  modalMessage: {
    fontSize: 16,
    marginBottom: 20,
    lineHeight: 22,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
