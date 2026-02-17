
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useColorScheme, ActivityIndicator, TextInput, ScrollView } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { saveVideoWithLocation, saveVideoOnly } from '@/utils/api';
import CustomModal from '@/components/ui/Modal';

interface Board {
  id: string;
  title: string;
  item_count?: number;
}

interface SaveToTripsModalProps {
  isVisible: boolean;
  onClose: () => void;
  postId: string;
  placeId: string | null;
  placeName: string | null;
  locationType: string | null;
}

export function SaveToTripsModal({ isVisible, onClose, postId, placeId, placeName, locationType }: SaveToTripsModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  
  const bgColor = isDark ? colors.backgroundDark : colors.background;
  const textColor = isDark ? colors.textDark : colors.text;
  const textSecondaryColor = isDark ? colors.textSecondaryDark : colors.textSecondary;
  const cardColor = isDark ? colors.cardDark : colors.card;
  const primaryColor = isDark ? colors.primaryDark : colors.primary;

  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['75%'], []);

  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [saveWithLocation, setSaveWithLocation] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreateNew, setShowCreateNew] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [alreadySavedBoards, setAlreadySavedBoards] = useState<Set<string>>(new Set());
  const [sessionReady, setSessionReady] = useState(false);
  const [modalState, setModalState] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info';
    onConfirm?: () => void;
    secondaryAction?: {
      label: string;
      onPress: () => void;
    };
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
  });

  const fetchBoards = useCallback(async () => {
    console.log('Fetching user boards for save modal');
    setLoading(true);
    setSessionReady(false);
    try {
      // Load session on modal open
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (!session?.user) {
        console.log('No authenticated user or session');
        setBoards([]);
        setLoading(false);
        setSessionReady(false);
        return;
      }

      // Session is ready
      setSessionReady(true);
      console.log('Session loaded successfully for user:', session.user.id);

      // Fetch boards with counts
      const { data, error } = await supabase
        .from('boards')
        .select(`
          id,
          title,
          board_posts (id)
        `)
        .eq('user_id', session.user.id)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error fetching boards:', error);
        setBoards([]);
      } else {
        const boardsWithCounts = (data || []).map(board => ({
          id: board.id,
          title: board.title,
          item_count: board.board_posts?.length || 0,
        }));
        console.log('Boards fetched for modal:', boardsWithCounts.length);
        setBoards(boardsWithCounts);
      }

      // Check which boards already have this post saved
      const { data: savedData, error: savedError } = await supabase
        .from('board_posts')
        .select('board_id, boards!inner(user_id)')
        .eq('post_id', postId)
        .eq('boards.user_id', session.user.id);

      if (!savedError && savedData) {
        const savedBoardIds = new Set(savedData.map(item => item.board_id));
        setAlreadySavedBoards(savedBoardIds);
        console.log('Post already saved to boards:', savedBoardIds.size);
      }
    } catch (error) {
      console.error('Error in fetchBoards:', error);
      setBoards([]);
      setSessionReady(false);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    if (isVisible) {
      console.log('Opening Save to Trips modal for post:', postId);
      bottomSheetRef.current?.expand();
      fetchBoards();
    } else {
      bottomSheetRef.current?.close();
    }
  }, [isVisible, postId, fetchBoards]);

  const handleCreateNewBoard = async () => {
    const trimmedTitle = newBoardTitle.trim();
    if (!trimmedTitle) {
      setModalState({
        visible: true,
        title: 'Error',
        message: 'Please enter a trip name',
        type: 'error',
      });
      return;
    }

    console.log('Creating new board:', trimmedTitle);
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setModalState({
          visible: true,
          title: 'Error',
          message: 'You must be logged in to create a trip',
          type: 'error',
        });
        return;
      }

      const { data, error } = await supabase
        .from('boards')
        .insert({
          user_id: user.id,
          title: trimmedTitle,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating board:', error);
        setModalState({
          visible: true,
          title: 'Error',
          message: 'Could not create trip. Please try again.',
          type: 'error',
        });
      } else {
        console.log('Board created successfully:', data.id);
        setSelectedBoardId(data.id);
        setShowCreateNew(false);
        setNewBoardTitle('');
        await fetchBoards();
      }
    } catch (error) {
      console.error('Error in handleCreateNewBoard:', error);
      setModalState({
        visible: true,
        title: 'Error',
        message: 'Could not create trip. Please try again.',
        type: 'error',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleSave = async () => {
    if (!selectedBoardId) {
      setModalState({
        visible: true,
        title: 'Error',
        message: 'Please select a trip',
        type: 'error',
      });
      return;
    }

    console.log('Saving post to board:', selectedBoardId);
    setSaving(true);
    try {
      // CRITICAL: Fetch session at tap-time and guard if missing
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        console.warn('No session token in handleSave', { error: sessionError });
        
        // Attempt to refresh session
        console.log('Attempting to refresh session...');
        await supabase.auth.refreshSession();
        
        // Check again after refresh
        const { data: { session: refreshedSession } } = await supabase.auth.getSession();
        
        if (!refreshedSession?.access_token) {
          console.error('Session refresh failed - no token available');
          setModalState({
            visible: true,
            title: 'Authentication Error',
            message: 'Authentication token not found. Please sign in again.',
            type: 'error',
          });
          setSaving(false);
          return;
        }
        
        console.log('Session refreshed successfully');
      }

      // Check if already saved to this board
      if (alreadySavedBoards.has(selectedBoardId)) {
        setModalState({
          visible: true,
          title: 'Already Saved',
          message: 'This video is already in this trip',
          type: 'info',
        });
        setSaving(false);
        return;
      }

      let response;
      
      // Save video with or without location using backend API
      if (saveWithLocation && placeId && placeName) {
        console.log('Saving video with location to board:', placeId);
        
        // Fetch post details to get place address
        const { data: postData } = await supabase
          .from('posts')
          .select('place_id, place_name, location_type')
          .eq('id', postId)
          .single();

        response = await saveVideoWithLocation(
          selectedBoardId,
          postId,
          placeId,
          placeName,
          '', // place_address - we don't have this in the current data
          locationType || postData?.location_type || ''
        );
      } else {
        console.log('Saving video only to board');
        response = await saveVideoOnly(selectedBoardId, postId);
      }

      console.log('Video saved successfully:', response);

      // Get board title for message
      const selectedBoard = boards.find(b => b.id === selectedBoardId);
      const boardTitle = selectedBoard?.title || 'Trip';

      // Emit refresh event for Trips tab
      console.log('Emitting TRIPS_REFRESH event');
      if (global.tripsRefreshCallback) {
        global.tripsRefreshCallback();
      }

      setModalState({
        visible: true,
        title: 'Saved!',
        message: `Saved to ${boardTitle}`,
        type: 'success',
        onConfirm: () => onClose(),
        secondaryAction: {
          label: 'View Trip',
          onPress: () => {
            onClose();
            router.push(`/board/${selectedBoardId}`);
          },
        },
      });
    } catch (error: any) {
      console.error('Error in handleSave:', error);
      const errorMessage = error?.message || 'Could not save to trip. Please try again.';
      
      // Check if it's a duplicate error (409)
      if (errorMessage.includes('409') || errorMessage.includes('already saved')) {
        setModalState({
          visible: true,
          title: 'Already Saved',
          message: 'This video is already in this trip',
          type: 'info',
        });
      } else {
        setModalState({
          visible: true,
          title: 'Error',
          message: errorMessage,
          type: 'error',
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (boardId: string) => {
    console.log('Removing post from board:', boardId);
    try {
      const { error } = await supabase
        .from('board_posts')
        .delete()
        .eq('board_id', boardId)
        .eq('post_id', postId);

      if (error) {
        console.error('Error removing from board:', error);
        setModalState({
          visible: true,
          title: 'Error',
          message: 'Could not remove from trip',
          type: 'error',
        });
      } else {
        console.log('Post removed from board successfully');
        setAlreadySavedBoards(prev => {
          const newSet = new Set(prev);
          newSet.delete(boardId);
          return newSet;
        });
        
        // Emit refresh event
        if (global.tripsRefreshCallback) {
          global.tripsRefreshCallback();
        }
        
        setModalState({
          visible: true,
          title: 'Removed',
          message: 'Video removed from trip',
          type: 'success',
        });
      }
    } catch (error) {
      console.error('Error in handleRemove:', error);
      setModalState({
        visible: true,
        title: 'Error',
        message: 'Could not remove from trip',
        type: 'error',
      });
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
      <BottomSheetScrollView style={[styles.container, { backgroundColor: bgColor }]}>
        <Text style={[styles.title, { color: textColor }]}>Save to Trips</Text>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={primaryColor} />
          </View>
        ) : (
          <>
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

                <Text style={[styles.sectionTitle, { color: textColor }]}>Select a Trip</Text>

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
                      const isSaved = alreadySavedBoards.has(board.id);
                      const itemCountText = board.item_count === 1 ? '1 item' : `${board.item_count || 0} items`;
                      
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
                            <View style={styles.boardItemInfo}>
                              <Text style={[styles.boardItemTitle, { color: textColor }]} numberOfLines={1}>
                                {board.title}
                              </Text>
                              <Text style={[styles.boardItemCount, { color: textSecondaryColor }]}>
                                {itemCountText}
                              </Text>
                            </View>
                            <View style={styles.boardItemActions}>
                              {isSaved && (
                                <TouchableOpacity
                                  style={[styles.removeButton, { backgroundColor: '#FF3B30' }]}
                                  onPress={() => handleRemove(board.id)}
                                  activeOpacity={0.7}
                                >
                                  <Text style={styles.removeButtonText}>Remove</Text>
                                </TouchableOpacity>
                              )}
                              {isSelected && !isSaved && (
                                <IconSymbol
                                  ios_icon_name="checkmark.circle.fill"
                                  android_material_icon_name="check-circle"
                                  size={24}
                                  color={primaryColor}
                                />
                              )}
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {placeId && placeName && (
                  <View style={[styles.optionsContainer, { backgroundColor: cardColor }]}>
                    <Text style={[styles.optionsTitle, { color: textColor }]}>Save Options</Text>
                    <TouchableOpacity
                      style={styles.optionRow}
                      onPress={() => setSaveWithLocation(!saveWithLocation)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.optionLeft}>
                        <IconSymbol
                          ios_icon_name="location.fill"
                          android_material_icon_name="location-on"
                          size={20}
                          color={textColor}
                        />
                        <Text style={[styles.optionText, { color: textColor }]}>Save video + location</Text>
                      </View>
                      <View style={[styles.checkbox, { borderColor: textSecondaryColor }]}>
                        {saveWithLocation && (
                          <IconSymbol
                            ios_icon_name="checkmark"
                            android_material_icon_name="check"
                            size={18}
                            color={primaryColor}
                          />
                        )}
                      </View>
                    </TouchableOpacity>
                  </View>
                )}

                <TouchableOpacity
                  style={[
                    styles.saveButton,
                    { backgroundColor: primaryColor },
                    (!selectedBoardId || saving || !sessionReady || alreadySavedBoards.has(selectedBoardId || '')) && { opacity: 0.5 },
                  ]}
                  onPress={handleSave}
                  disabled={!selectedBoardId || saving || !sessionReady || alreadySavedBoards.has(selectedBoardId || '')}
                  activeOpacity={0.8}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : !sessionReady ? (
                    <Text style={styles.saveButtonText}>Loading session...</Text>
                  ) : (
                    <Text style={styles.saveButtonText}>
                      {selectedBoardId && alreadySavedBoards.has(selectedBoardId) ? 'Already Saved' : 'Save'}
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </>
        )}
      </BottomSheetScrollView>
    </BottomSheet>

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
      secondaryAction={modalState.secondaryAction}
    />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  createNewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  createNewText: {
    fontSize: 16,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  boardsList: {
    gap: 12,
    marginBottom: 20,
  },
  boardItem: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  boardItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    fontSize: 14,
  },
  boardItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  removeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  removeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
  optionsContainer: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  optionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  optionText: {
    fontSize: 15,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 40,
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
