
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useColorScheme, ActivityIndicator, TextInput, ScrollView, Image, ImageSourcePropType } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { saveVideoWithLocation, saveVideoOnly } from '@/utils/api';
import { Toast } from '@/components/ui/Toast';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';

interface Board {
  id: string;
  title: string;
  cover_url: string | null;
  created_at: string;
}

interface Post {
  id: string;
  caption: string;
  place_id: string | null;
  place_name: string | null;
  location_type: string | null;
}

interface SaveToTripsModalProps {
  isVisible: boolean;
  onClose: () => void;
  post: Post;
}

const LAST_USED_BOARD_KEY = 'lastUsedBoardId';

function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: '' };
  if (typeof source === 'string') return { uri: source };
  return source as ImageSourcePropType;
}

export function SaveToTripsModal({ isVisible, onClose, post }: SaveToTripsModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  
  const bgColor = isDark ? colors.backgroundDark : colors.background;
  const textColor = isDark ? colors.textDark : colors.text;
  const textSecondaryColor = isDark ? colors.textSecondaryDark : colors.textSecondary;
  const cardColor = isDark ? colors.cardDark : colors.card;
  const primaryColor = isDark ? colors.primaryDark : colors.primary;

  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['85%'], []);

  const [boards, setBoards] = useState<Board[]>([]);
  const [boardCounts, setBoardCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [saveOption, setSaveOption] = useState<'video_only' | 'video_and_place'>('video_only');
  const [saving, setSaving] = useState(false);
  const [showCreateNew, setShowCreateNew] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [authMissing, setAuthMissing] = useState(false);
  
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  const fetchBoards = useCallback(async () => {
    console.log('Fetching user boards for save modal');
    setLoading(true);
    setSessionReady(false);
    setAuthMissing(false);
    
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.user?.id) {
        console.warn('No session or user ID found for fetching boards:', sessionError);
        setBoards([]);
        setAuthMissing(true);
        setSessionReady(false);
        setLoading(false);
        return;
      }

      setSessionReady(true);
      console.log('Session loaded successfully for user:', session.user.id);

      const { data, error } = await supabase
        .from('boards')
        .select('id, title, cover_url, created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching boards:', error);
        setBoards([]);
      } else {
        console.log('Boards fetched for modal:', data?.length || 0);
        setBoards(data || []);
        
        // Fetch counts for each board
        const counts = new Map<string, number>();
        for (const board of data || []) {
          const { count: videoCount } = await supabase
            .from('board_posts')
            .select('*', { count: 'exact', head: true })
            .eq('board_id', board.id);
          
          const { count: placeCount } = await supabase
            .from('board_places')
            .select('*', { count: 'exact', head: true })
            .eq('board_id', board.id);
          
          const totalCount = (videoCount || 0) + (placeCount || 0);
          counts.set(board.id, totalCount);
        }
        setBoardCounts(counts);
        
        // Load last used board from AsyncStorage
        try {
          const lastUsedBoardId = await AsyncStorage.getItem(LAST_USED_BOARD_KEY);
          if (lastUsedBoardId && data?.some(b => b.id === lastUsedBoardId)) {
            setSelectedBoardId(lastUsedBoardId);
            console.log('Restored last used board:', lastUsedBoardId);
          } else if (data && data.length > 0) {
            setSelectedBoardId(data[0].id);
          }
        } catch (storageError) {
          console.error('Error loading last used board:', storageError);
          if (data && data.length > 0) {
            setSelectedBoardId(data[0].id);
          }
        }
      }
    } catch (error) {
      console.error('Error in fetchBoards:', error);
      setBoards([]);
      setSessionReady(false);
      setAuthMissing(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isVisible) {
      console.log('Opening Save to Trips modal for post:', post.id);
      bottomSheetRef.current?.expand();
      fetchBoards();
      
      // Set default save option based on place availability
      if (post.place_id && post.place_name) {
        setSaveOption('video_and_place');
      } else {
        setSaveOption('video_only');
      }
    } else {
      bottomSheetRef.current?.close();
    }
  }, [isVisible, post, fetchBoards]);

  const handleCreateNewBoard = async () => {
    const trimmedTitle = newBoardTitle.trim();
    if (!trimmedTitle) {
      showToast('Please enter a trip name', 'error');
      return;
    }

    console.log('Creating new board:', trimmedTitle);
    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        showToast('You must be logged in to create a trip', 'error');
        return;
      }

      const { data, error } = await supabase
        .from('boards')
        .insert({
          user_id: session.user.id,
          title: trimmedTitle,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating board:', error);
        showToast('Could not create trip. Please try again.', 'error');
      } else {
        console.log('Board created successfully:', data.id);
        setSelectedBoardId(data.id);
        setShowCreateNew(false);
        setNewBoardTitle('');
        await fetchBoards();
      }
    } catch (error) {
      console.error('Error in handleCreateNewBoard:', error);
      showToast('Could not create trip. Please try again.', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleSave = async () => {
    if (!selectedBoardId) {
      showToast('Please select a trip', 'error');
      return;
    }

    // Validate save option
    if (saveOption === 'video_and_place' && !post.place_id) {
      showToast('No place attached to this video', 'error');
      return;
    }

    console.log('Saving post to board:', selectedBoardId);
    setSaving(true);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        console.warn('No session token in handleSave', { error: sessionError });
        
        console.log('Attempting to refresh session...');
        await supabase.auth.refreshSession();
        
        const { data: { session: refreshedSession } } = await supabase.auth.getSession();
        
        if (!refreshedSession?.access_token) {
          console.error('Session refresh failed - no token available');
          showToast('Authentication token not found. Please sign in again.', 'error');
          setSaving(false);
          return;
        }
        
        console.log('Session refreshed successfully');
      }

      let response;
      
      if (saveOption === 'video_and_place' && post.place_id && post.place_name) {
        console.log('Saving video with location to board:', post.place_id);
        
        response = await saveVideoWithLocation(
          selectedBoardId,
          post.id,
          post.place_id,
          post.place_name,
          '',
          post.location_type || ''
        );
      } else {
        console.log('Saving video only to board');
        response = await saveVideoOnly(selectedBoardId, post.id);
      }

      console.log('Video saved successfully:', response);

      // Save last used board to AsyncStorage
      try {
        await AsyncStorage.setItem(LAST_USED_BOARD_KEY, selectedBoardId);
        console.log('Saved last used board to storage:', selectedBoardId);
      } catch (storageError) {
        console.error('Error saving last used board:', storageError);
      }

      const selectedBoard = boards.find(b => b.id === selectedBoardId);
      const boardTitle = selectedBoard?.title || 'Trip';

      if (global.tripsRefreshCallback) {
        global.tripsRefreshCallback();
      }

      showToast(`Saved to ${boardTitle}`, 'success');
      
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (error: any) {
      console.error('Error in handleSave:', error);
      const errorMessage = error?.message || 'Could not save to trip. Please try again.';
      
      if (errorMessage.includes('409') || errorMessage.includes('already saved')) {
        showToast('This video is already in this trip', 'info');
      } else {
        showToast(errorMessage, 'error');
      }
    } finally {
      setSaving(false);
    }
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

  if (!isVisible) return null;

  const postTitle = post.caption || 'Video';
  const postSubtitle = post.place_name ? ` • ${post.place_name}` : '';
  const headerSubtitle = `${postTitle.substring(0, 40)}${postTitle.length > 40 ? '...' : ''}${postSubtitle}`;
  
  const hasPlace = Boolean(post.place_id && post.place_name);
  const showPlaceWarning = saveOption === 'video_and_place' && !hasPlace;
  const canSave = selectedBoardId && sessionReady && !saving && !showPlaceWarning;

  return (
    <>
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        onClose={onClose}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: bgColor }}
        handleIndicatorStyle={{ backgroundColor: textSecondaryColor }}
      >
        <View style={[styles.container, { backgroundColor: bgColor }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={[styles.headerTitle, { color: textColor }]}>Save to Trips</Text>
              <Text style={[styles.headerSubtitle, { color: textSecondaryColor }]} numberOfLines={1}>
                {headerSubtitle}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.doneButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <IconSymbol
                ios_icon_name="xmark"
                android_material_icon_name="close"
                size={24}
                color={textColor}
              />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={primaryColor} />
              <Text style={[styles.loadingText, { color: textSecondaryColor }]}>Loading...</Text>
            </View>
          ) : authMissing ? (
            <View style={styles.emptyContainer}>
              <IconSymbol
                ios_icon_name="person.crop.circle.badge.exclamationmark"
                android_material_icon_name="error"
                size={48}
                color={textSecondaryColor}
              />
              <Text style={[styles.emptyText, { color: textSecondaryColor }]}>
                Please sign in to save videos to trips
              </Text>
            </View>
          ) : (
            <>
              <BottomSheetScrollView style={styles.scrollContent}>
                {/* Section 1: Board Picker */}
                {showCreateNew ? (
                  <View style={[styles.createNewContainer, { backgroundColor: cardColor }]}>
                    <Text style={[styles.sectionTitle, { color: textColor }]}>Create New Trip</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: bgColor, color: textColor, borderColor: textSecondaryColor }]}
                      placeholder="Trip name"
                      placeholderTextColor={textSecondaryColor}
                      value={newBoardTitle}
                      onChangeText={setNewBoardTitle}
                      autoFocus
                    />
                    <View style={styles.createActions}>
                      <TouchableOpacity
                        style={[styles.cancelButton, { borderColor: textSecondaryColor }]}
                        onPress={() => {
                          setShowCreateNew(false);
                          setNewBoardTitle('');
                        }}
                        disabled={creating}
                      >
                        <Text style={[styles.cancelButtonText, { color: textColor }]}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.createButton, { backgroundColor: primaryColor }]}
                        onPress={handleCreateNewBoard}
                        disabled={creating}
                      >
                        {creating ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={styles.createButtonText}>Create</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <>
                    <TouchableOpacity
                      style={[styles.createNewButton, { backgroundColor: cardColor }]}
                      onPress={() => setShowCreateNew(true)}
                      activeOpacity={0.7}
                    >
                      <IconSymbol
                        ios_icon_name="plus.circle.fill"
                        android_material_icon_name="add-circle"
                        size={24}
                        color={primaryColor}
                      />
                      <Text style={[styles.createNewText, { color: primaryColor }]}>Create New Trip</Text>
                    </TouchableOpacity>

                    {boards.length === 0 ? (
                      <View style={styles.emptyContainer}>
                        <Text style={[styles.emptyText, { color: textSecondaryColor }]}>
                          No trips yet. Create your first trip!
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.boardsList}>
                        {boards.map((board) => {
                          const isSelected = selectedBoardId === board.id;
                          const itemCount = boardCounts.get(board.id) || 0;
                          const itemCountText = itemCount === 1 ? '1 item' : `${itemCount} items`;
                          
                          return (
                            <TouchableOpacity
                              key={board.id}
                              style={[
                                styles.boardItem,
                                { backgroundColor: cardColor },
                                isSelected && { borderColor: primaryColor, borderWidth: 2 },
                              ]}
                              onPress={() => setSelectedBoardId(board.id)}
                              activeOpacity={0.7}
                            >
                              <View style={styles.boardItemContent}>
                                {board.cover_url ? (
                                  <Image
                                    source={resolveImageSource(board.cover_url)}
                                    style={styles.boardCover}
                                  />
                                ) : (
                                  <View style={[styles.boardCoverPlaceholder, { backgroundColor: primaryColor }]}>
                                    <IconSymbol
                                      ios_icon_name="photo"
                                      android_material_icon_name="image"
                                      size={24}
                                      color="#FFFFFF"
                                    />
                                  </View>
                                )}
                                <View style={styles.boardItemInfo}>
                                  <Text style={[styles.boardItemTitle, { color: textColor }]} numberOfLines={1}>
                                    {board.title}
                                  </Text>
                                  <Text style={[styles.boardItemCount, { color: textSecondaryColor }]}>
                                    {itemCountText}
                                  </Text>
                                </View>
                                {isSelected && (
                                  <IconSymbol
                                    ios_icon_name="checkmark.circle.fill"
                                    android_material_icon_name="check-circle"
                                    size={24}
                                    color={primaryColor}
                                  />
                                )}
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}

                    {/* Section 2: Save Options */}
                    <View style={styles.saveOptionsSection}>
                      <Text style={[styles.sectionTitle, { color: textColor }]}>Save Options</Text>
                      <View style={styles.segmentedControl}>
                        <TouchableOpacity
                          style={[
                            styles.segment,
                            { borderColor: textSecondaryColor },
                            saveOption === 'video_only' && { backgroundColor: primaryColor, borderColor: primaryColor },
                          ]}
                          onPress={() => setSaveOption('video_only')}
                          activeOpacity={0.7}
                        >
                          <Text style={[
                            styles.segmentText,
                            { color: saveOption === 'video_only' ? '#FFFFFF' : textColor }
                          ]}>
                            Video only
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.segment,
                            { borderColor: textSecondaryColor },
                            saveOption === 'video_and_place' && { backgroundColor: primaryColor, borderColor: primaryColor },
                          ]}
                          onPress={() => setSaveOption('video_and_place')}
                          activeOpacity={0.7}
                        >
                          <Text style={[
                            styles.segmentText,
                            { color: saveOption === 'video_and_place' ? '#FFFFFF' : textColor }
                          ]}>
                            Video + place
                          </Text>
                        </TouchableOpacity>
                      </View>
                      {showPlaceWarning && (
                        <View style={styles.warningContainer}>
                          <IconSymbol
                            ios_icon_name="exclamationmark.triangle"
                            android_material_icon_name="warning"
                            size={16}
                            color="#FF9500"
                          />
                          <Text style={styles.warningText}>No place attached to this video</Text>
                        </View>
                      )}
                    </View>

                    {/* Section 3: Place Preview */}
                    {saveOption === 'video_and_place' && hasPlace && (
                      <View style={[styles.placePreviewSection, { backgroundColor: cardColor }]}>
                        <View style={styles.placePreviewContent}>
                          <IconSymbol
                            ios_icon_name="mappin.circle.fill"
                            android_material_icon_name="location-on"
                            size={24}
                            color={primaryColor}
                          />
                          <View style={styles.placePreviewInfo}>
                            <Text style={[styles.placePreviewName, { color: textColor }]} numberOfLines={1}>
                              {post.place_name}
                            </Text>
                            <Text style={[styles.placePreviewSubtext, { color: textSecondaryColor }]}>
                              This will use the video's place
                            </Text>
                          </View>
                        </View>
                      </View>
                    )}
                  </>
                )}
              </BottomSheetScrollView>

              {/* Footer with gradient and Save button */}
              {!showCreateNew && (
                <LinearGradient
                  colors={isDark ? ['rgba(0,0,0,0)', 'rgba(0,0,0,0.9)'] : ['rgba(255,255,255,0)', 'rgba(255,255,255,0.95)']}
                  style={styles.footer}
                >
                  <TouchableOpacity
                    style={[
                      styles.saveButton,
                      { backgroundColor: primaryColor },
                      !canSave && { opacity: 0.5 },
                    ]}
                    onPress={handleSave}
                    disabled={!canSave}
                    activeOpacity={0.8}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.saveButtonText}>Save</Text>
                    )}
                  </TouchableOpacity>
                </LinearGradient>
              )}
            </>
          )}
        </View>
      </BottomSheet>

      <Toast
        message={toastMessage}
        visible={toastVisible}
        onHide={() => setToastVisible(false)}
        type={toastType}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
  },
  doneButton: {
    padding: 4,
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
  createNewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  createNewText: {
    fontSize: 16,
    fontWeight: '600',
  },
  boardsList: {
    gap: 12,
    marginBottom: 24,
  },
  boardItem: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  boardItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  boardCover: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#333',
  },
  boardCoverPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  boardItemInfo: {
    flex: 1,
  },
  boardItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  boardItemCount: {
    fontSize: 13,
  },
  saveOptionsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  segmentedControl: {
    flexDirection: 'row',
    gap: 8,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '500',
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 12,
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
    borderRadius: 8,
  },
  warningText: {
    fontSize: 13,
    color: '#FF9500',
    flex: 1,
  },
  placePreviewSection: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  placePreviewContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  placePreviewInfo: {
    flex: 1,
  },
  placePreviewName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  placePreviewSubtext: {
    fontSize: 13,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  saveButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  createNewContainer: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  createActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  createButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
