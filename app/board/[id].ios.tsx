
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useColorScheme, ActivityIndicator, RefreshControl, Dimensions, Modal, TextInput, Alert } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { supabase } from '@/lib/supabase';
import { VideoGridItem } from '@/components/VideoGridItem';

interface Board {
  id: string;
  user_id: string;
  title: string;
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
  address: string | null;
  lat: number | null;
  lng: number | null;
  place_json: any;
  created_at: string;
}

type TabType = 'videos' | 'places';

const windowWidth = Dimensions.get('window').width;
const gridItemSize = (windowWidth - 48) / 3;

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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('videos');

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
      }

      const { data: placesData, error: placesError } = await supabase
        .from('board_places')
        .select('*')
        .eq('board_id', boardId)
        .order('created_at', { ascending: false });

      if (placesError) {
        console.error('Error fetching board places:', placesError);
        setPlaces([]);
      } else {
        console.log('Board places fetched successfully:', placesData?.length || 0);
        setPlaces(placesData || []);
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

  const handleEditBoard = () => {
    console.log('User tapped edit board');
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim()) {
      Alert.alert('Error', 'Please enter a title');
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
        Alert.alert('Error', 'Could not update trip');
      } else {
        console.log('Board updated successfully');
        setBoard(prev => prev ? { ...prev, title: editTitle.trim() } : null);
        setEditModalVisible(false);
      }
    } catch (error) {
      console.error('Error in handleSaveEdit:', error);
      Alert.alert('Error', 'Could not update trip');
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
        Alert.alert('Error', 'Could not delete trip');
      } else {
        console.log('Board deleted successfully');
        setDeleteModalVisible(false);
        router.back();
      }
    } catch (error) {
      console.error('Error in confirmDelete:', error);
      Alert.alert('Error', 'Could not delete trip');
    }
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
            ios_icon_name="exclamationmark.triangle"
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

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={[styles.header, { backgroundColor: bgColor }]}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={handleBack}
          activeOpacity={0.7}
        >
          <IconSymbol 
            ios_icon_name="chevron.left"
            android_material_icon_name="arrow-back" 
            size={24} 
            color={textColor}
          />
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleEditBoard}
            activeOpacity={0.7}
          >
            <IconSymbol 
              ios_icon_name="pencil"
              android_material_icon_name="edit" 
              size={24} 
              color={textColor}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleDeleteBoard}
            activeOpacity={0.7}
          >
            <IconSymbol 
              ios_icon_name="trash"
              android_material_icon_name="delete" 
              size={24} 
              color="#FF3B30"
            />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.titleContainer}>
        <Text style={[styles.title, { color: textColor }]}>{board.title}</Text>
        <Text style={[styles.itemCount, { color: textSecondaryColor }]}>
          {posts.length} {posts.length === 1 ? 'video' : 'videos'} • {places.length} {places.length === 1 ? 'place' : 'places'}
        </Text>
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
        {activeTab === 'videos' ? (
          posts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <IconSymbol 
                ios_icon_name="video.fill"
                android_material_icon_name="videocam" 
                size={64} 
                color={textSecondaryColor}
              />
              <Text style={[styles.emptyText, { color: textSecondaryColor }]}>
                No videos saved yet
              </Text>
            </View>
          ) : (
            <View style={styles.gridContainer}>
              {posts.map((post) => (
                <VideoGridItem
                  key={post.id}
                  post={post}
                  size={gridItemSize}
                  onPress={() => handleVideoPress(post)}
                  shouldPlay={false}
                  showFollowButton={false}
                />
              ))}
            </View>
          )
        ) : (
          places.length === 0 ? (
            <View style={styles.emptyContainer}>
              <IconSymbol 
                ios_icon_name="mappin.circle.fill"
                android_material_icon_name="location-on" 
                size={64} 
                color={textSecondaryColor}
              />
              <Text style={[styles.emptyText, { color: textSecondaryColor }]}>
                No places saved yet
              </Text>
            </View>
          ) : (
            <View style={styles.placesContainer}>
              {places.map((place) => {
                const placeName = place.place_name || 'Unknown Place';
                const placeAddress = place.address || 'No address available';
                
                return (
                  <TouchableOpacity
                    key={place.id}
                    style={[styles.placeCard, { backgroundColor: cardColor }]}
                    onPress={() => console.log('Place tapped:', place.place_id)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.placeIconContainer, { backgroundColor: isDark ? '#333' : '#F5F5F5' }]}>
                      <IconSymbol 
                        ios_icon_name="mappin.circle.fill"
                        android_material_icon_name="location-on" 
                        size={24} 
                        color={primaryColor}
                      />
                    </View>
                    <View style={styles.placeInfo}>
                      <Text style={[styles.placeName, { color: textColor }]} numberOfLines={1}>
                        {placeName}
                      </Text>
                      <Text style={[styles.placeAddress, { color: textSecondaryColor }]} numberOfLines={2}>
                        {placeAddress}
                      </Text>
                    </View>
                    <IconSymbol 
                      ios_icon_name="chevron.right"
                      android_material_icon_name="arrow-forward" 
                      size={20} 
                      color={textSecondaryColor}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  headerButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
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
  titleContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  itemCount: {
    fontSize: 16,
  },
  segmentedControl: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
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
  scrollView: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 6,
  },
  placesContainer: {
    padding: 16,
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
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeInfo: {
    flex: 1,
  },
  placeName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  placeAddress: {
    fontSize: 14,
    lineHeight: 18,
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
