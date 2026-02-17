
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useColorScheme, ActivityIndicator, TextInput, ScrollView, Alert } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';

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

  const fetchBoards = useCallback(async () => {
    console.log('Fetching user boards for save modal');
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('No authenticated user');
        setBoards([]);
        setLoading(false);
        return;
      }

      // Fetch boards with counts
      const { data, error } = await supabase
        .from('boards')
        .select(`
          id,
          title,
          board_posts (id)
        `)
        .eq('user_id', user.id)
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
        .eq('boards.user_id', user.id);

      if (!savedError && savedData) {
        const savedBoardIds = new Set(savedData.map(item => item.board_id));
        setAlreadySavedBoards(savedBoardIds);
        console.log('Post already saved to boards:', savedBoardIds.size);
      }
    } catch (error) {
      console.error('Error in fetchBoards:', error);
      setBoards([]);
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
      Alert.alert('Error', 'Please enter a trip name');
      return;
    }

    console.log('Creating new board:', trimmedTitle);
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in to create a trip');
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
        Alert.alert('Error', 'Could not create trip. Please try again.');
      } else {
        console.log('Board created successfully:', data.id);
        setSelectedBoardId(data.id);
        setShowCreateNew(false);
        setNewBoardTitle('');
        await fetchBoards();
      }
    } catch (error) {
      console.error('Error in handleCreateNewBoard:', error);
      Alert.alert('Error', 'Could not create trip. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleSave = async () => {
    if (!selectedBoardId) {
      Alert.alert('Error', 'Please select a trip');
      return;
    }

    console.log('Saving post to board:', selectedBoardId);
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in to save');
        return;
      }

      // Check if already saved to this board
      if (alreadySavedBoards.has(selectedBoardId)) {
        Alert.alert('Already Saved', 'This video is already in this trip');
        setSaving(false);
        return;
      }

      // Save video to board
      const { error: itemError } = await supabase
        .from('board_posts')
        .insert({
          board_id: selectedBoardId,
          post_id: postId,
        });

      if (itemError) {
        console.error('Error saving to board:', itemError);
        Alert.alert('Error', 'Could not save to trip. Please try again.');
        setSaving(false);
        return;
      }

      console.log('Video saved to board successfully');

      // Save location if selected and available
      if (saveWithLocation && placeId) {
        console.log('Saving location to board:', placeId);
        const { error: placeError } = await supabase
          .from('board_places')
          .upsert({
            board_id: selectedBoardId,
            place_id: placeId,
            place_name: placeName,
            address: null,
            lat: null,
            lng: null,
            place_json: null,
          }, {
            onConflict: 'board_id,place_id',
          });

        if (placeError) {
          console.error('Error saving location:', placeError);
          // Don't fail the whole operation if location save fails
        } else {
          console.log('Location saved to board successfully');
        }
      }

      // Get board title for toast
      const selectedBoard = boards.find(b => b.id === selectedBoardId);
      const boardTitle = selectedBoard?.title || 'Trip';

      // Emit refresh event for Trips tab
      console.log('Emitting TRIPS_REFRESH event');
      if (global.tripsRefreshCallback) {
        global.tripsRefreshCallback();
      }

      Alert.alert(
        'Saved!',
        `Saved to ${boardTitle}`,
        [
          { text: 'OK', onPress: () => onClose() },
          {
            text: 'View Trip',
            onPress: () => {
              onClose();
              router.push(`/board/${selectedBoardId}`);
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error in handleSave:', error);
      Alert.alert('Error', 'Could not save to trip. Please try again.');
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
        Alert.alert('Error', 'Could not remove from trip');
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
        
        Alert.alert('Removed', 'Video removed from trip');
      }
    } catch (error) {
      console.error('Error in handleRemove:', error);
      Alert.alert('Error', 'Could not remove from trip');
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

                {placeId && (
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
                    (!selectedBoardId || saving || alreadySavedBoards.has(selectedBoardId || '')) && { opacity: 0.5 },
                  ]}
                  onPress={handleSave}
                  disabled={!selectedBoardId || saving || alreadySavedBoards.has(selectedBoardId || '')}
                  activeOpacity={0.8}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
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
