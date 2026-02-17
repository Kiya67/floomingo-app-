
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
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';

interface Board {
  id: string;
  title: string;
  cover_url: string | null;
  created_at: string;
}

interface Post {
  id: string;
  caption: string;
  thumbnail_url?: string;
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
  const { session, user, loadingAuth } = useSupabaseAuth();
  
  const bgColor = isDark ? colors.backgroundDark : colors.background;
  const textColor = isDark ? colors.textDark : colors.text;
  const textSecondaryColor = isDark ? colors.textSecondaryDark : colors.textSecondary;
  const cardColor = isDark ? colors.cardDark : colors.card;
  const primaryColor = isDark ? colors.primaryDark : colors.primary;

  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['85%'], []);

  const [boards, setBoards] = useState<Board[]>([]);
  const [boardCounts, setBoardCounts] = useState<Map<string, number>>(new Map());
  const [loadingBoards, setLoadingBoards] = useState(true);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [saveOption, setSaveOption] = useState<'video_only' | 'video_and_place'>('video_only');
  const [isSaving, setIsSaving] = useState(false);
  const [showCreateNew, setShowCreateNew] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState('');
  const [creating, setCreating] = useState(false);
  
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  const fetchBoards = useCallback(async () => {
    console.log('SaveToTripsModal - fetchBoards called');
    setLoadingBoards(true);
    
    try {
      // Check if auth is still loading
      if (loadingAuth) {
        console.log('SaveToTripsModal - Auth still loading, waiting...');
        return;
      }

      // Check if user is authenticated
      if (!session || !user) {
        console.warn('SaveToTripsModal - No session or user, cannot fetch boards');
        setBoards([]);
        setLoadingBoards(false);
        return;
      }

      console.log('SaveToTripsModal - Fetching boards for user:', user.id);

      const { data, error } = await supabase
        .from('boards')
        .select('id, title, cover_url, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('SaveToTripsModal - Error fetching boards:', error);
        showToast('Failed to load trips', 'error');
        setBoards([]);
      } else {
        console.log('SaveToTripsModal - Boards fetched:', data?.length || 0);
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
            console.log('SaveToTripsModal - Restored last used board:', lastUsedBoardId);
          } else if (data && data.length > 0) {
            setSelectedBoardId(data[0].id);
          }
        } catch (storageError) {
          console.error('SaveToTripsModal - Error loading last used board:', storageError);
          if (data && data.length > 0) {
            setSelectedBoardId(data[0].id);
          }
        }
      }
    } catch (error) {
      console.error('SaveToTripsModal - Error in fetchBoards:', error);
      showToast('Failed to load trips', 'error');
      setBoards([]);
    } finally {
      setLoadingBoards(false);
    }
  }, [loadingAuth, session, user]);

  useEffect(() => {
    if (isVisible) {
      console.log('SaveToTripsModal - Modal opened for post:', post.id);
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

    // Check auth before creating
    if (loadingAuth) {
      showToast('Loading authentication...', 'info');
      return;
    }

    if (!session || !user) {
      showToast('Please sign in to create a trip', 'error');
      router.push('/auth');
      return;
    }

    console.log('SaveToTripsModal - Creating new board:', trimmedTitle);
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('boards')
        .insert({
          user_id: user.id,
          title: trimmedTitle,
        })
        .select()
        .single();

      if (error) {
        console.error('SaveToTripsModal - Error creating board:', error);
        showToast('Could not create trip. Please try again.', 'error');
      } else {
        console.log('SaveToTripsModal - Board created successfully:', data.id);
        setSelectedBoardId(data.id);
        setShowCreateNew(false);
        setNewBoardTitle('');
        await fetchBoards();
        showToast('Trip created!', 'success');
      }
    } catch (error) {
      console.error('SaveToTripsModal - Error in handleCreateNewBoard:', error);
      showToast('Could not create trip. Please try again.', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleSave = async () => {
    if (!selectedBoardId || !post || isSaving) {
      console.log('SaveToTripsModal - handleSave blocked:', { selectedBoardId, post: !!post, isSaving });
      return;
    }

    // Validate save option
    if (saveOption === 'video_and_place' && !post.place_id) {
      showToast('No place attached to this video', 'error');
      return;
    }

    // Auth guard: Check if auth is still loading
    if (loadingAuth) {
      console.log('SaveToTripsModal - Auth still loading, blocking save');
      showToast('Loading authentication...', 'info');
      return;
    }

    // Auth guard: Ensure session is valid before proceeding
    const { data: sessionData } = await supabase.auth.getSession();
    const currentSession = sessionData?.session;
    
    if (!currentSession?.user) {
      console.warn('SaveToTripsModal - No session or user in handleSave');
      showToast('Please sign in to save videos', 'error');
      router.push('/auth');
      return;
    }

    console.log('SaveToTripsModal - Saving post to board:', {
      boardId: selectedBoardId,
      postId: post.id,
      userId: currentSession.user.id,
      saveOption,
    });

    setIsSaving(true);
    try {
      let result;
      
      if (saveOption === 'video_and_place' && post.place_id && post.place_name) {
        console.log('SaveToTripsModal - Saving video with location');
        result = await saveVideoWithLocation(
          selectedBoardId,
          post.id,
          post.place_id,
          post.place_name,
          '',
          post.location_type || ''
        );
      } else {
        console.log('SaveToTripsModal - Saving video only');
        result = await saveVideoOnly(selectedBoardId, post.id);
      }

      console.log('SaveToTripsModal - Save result:', result);

      // Check for errors in the result
      if (result?.error) {
        if (result.error.code === 409) {
          showToast('Already saved to this trip!', 'info');
        } else {
          console.error('SaveToTripsModal - Save failed:', {
            sessionExists: !!currentSession,
            userId: currentSession.user.id,
            errorCode: result.error.code,
            errorMessage: result.error.message,
          });
          showToast(`Failed to save: ${result.error.message}`, 'error');
        }
      } else {
        // Save last used board to AsyncStorage
        try {
          await AsyncStorage.setItem(LAST_USED_BOARD_KEY, selectedBoardId);
          console.log('SaveToTripsModal - Saved last used board to storage:', selectedBoardId);
        } catch (storageError) {
          console.error('SaveToTripsModal - Error saving last used board:', storageError);
        }

        const selectedBoard = boards.find(b => b.id === selectedBoardId);
        const boardTitle = selectedBoard?.title || 'trip';

        // Update board cover if it was null and we have a thumbnail
        if (!selectedBoard?.cover_url && post.thumbnail_url) {
          console.log('SaveToTripsModal - Updating board cover with post thumbnail');
          await supabase
            .from('boards')
            .update({ cover_url: post.thumbnail_url })
            .eq('id', selectedBoardId);
        }

        // Trigger trips refresh if callback exists
        if (global.tripsRefreshCallback) {
          global.tripsRefreshCallback();
        }

        showToast(`Saved to ${boardTitle}!`, 'success');
        
        setTimeout(() => {
          onClose();
        }, 1000);
      }
    } catch (err: any) {
      console.error('SaveToTripsModal - Error in handleSave:', err);
      const errorMessage = err?.message || 'Could not save to trip. Please try again.';
      
      if (errorMessage.includes('Authentication token not found')) {
        showToast('Please sign in to save videos', 'error');
        router.push('/auth');
      } else if (errorMessage.includes('409') || errorMessage.includes('already saved')) {
        showToast('This video is already in this trip', 'info');
      } else {
        showToast(errorMessage, 'error');
      }
    } finally {
      setIsSaving(false);
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
  
  // Determine if we can save
  const isAuthReady = !loadingAuth && !!session && !!user;
  const canSave = selectedBoardId && isAuthReady && !isSaving && !showPlaceWarning;

  // Show loading state while auth is initializing
  const showAuthLoading = loadingAuth;
  const showAuthMissing = !loadingAuth && (!session || !user);

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

          {showAuthLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={primaryColor} />
              <Text style={[styles.loadingText, { color: textSecondaryColor }]}>Loading session...</Text>
            </View>
          ) : showAuthMissing ? (
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
              <TouchableOpacity
                style={[styles.signInButton, { backgroundColor: primaryColor }]}
                onPress={() => {
                  onClose();
                  router.push('/auth');
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.signInButtonText}>Sign In</Text>
              </TouchableOpacity>
            </View>
          ) : loadingBoards ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={primaryColor} />
              <Text style={[styles.loadingText, { color: textSecondaryColor }]}>Loading trips...</Text>
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
                    {isSaving ? (
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
  signInButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginTop: 8,
  },
  signInButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
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
