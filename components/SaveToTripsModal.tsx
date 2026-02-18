
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useColorScheme, ActivityIndicator, TextInput, Image, ImageSourcePropType } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { saveVideoOnly } from '@/utils/api';
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
  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  const colorScheme = useColorScheme();
  const router = useRouter();
  const { session, user, loadingAuth } = useSupabaseAuth();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['85%'], []);

  const [boards, setBoards] = useState<Board[]>([]);
  const [boardCounts, setBoardCounts] = useState<Map<string, number>>(new Map());
  const [loadingBoards, setLoadingBoards] = useState(true);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showCreateNew, setShowCreateNew] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState('');
  const [creating, setCreating] = useState(false);
  
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');

  // Computed values
  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? colors.backgroundDark : colors.background;
  const textColor = isDark ? colors.textDark : colors.text;
  const textSecondaryColor = isDark ? colors.textSecondaryDark : colors.textSecondary;
  const cardColor = isDark ? colors.cardDark : colors.card;
  const primaryColor = isDark ? colors.primaryDark : colors.primary;

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  }, []);

  const fetchBoards = useCallback(async () => {
    console.log('SaveToTripsModal - fetchBoards called');
    setLoadingBoards(true);
    
    try {
      if (loadingAuth) {
        console.log('SaveToTripsModal - Auth still loading, waiting...');
        return;
      }

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
        
        // Fetch video counts for each board
        // CRITICAL: Use .contains() for uuid[] array query
        const counts = new Map<string, number>();
        for (const board of data || []) {
          const { count } = await supabase
            .from('board_posts')
            .select('*', { count: 'exact', head: true })
            .eq('board_id', board.id)
            .contains('saved_by', [user.id]); // ✅ CORRECT: Use .contains() for uuid[] array
          
          counts.set(board.id, count || 0);
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
  }, [loadingAuth, session, user, showToast]);

  useEffect(() => {
    if (isVisible && post) {
      console.log('SaveToTripsModal - Modal opened for post:', post.id);
      bottomSheetRef.current?.expand();
      fetchBoards();
    } else {
      bottomSheetRef.current?.close();
    }
  }, [isVisible, post, fetchBoards]);

  const handleCreateNewBoard = useCallback(async () => {
    const trimmedTitle = newBoardTitle.trim();
    if (!trimmedTitle) {
      showToast('Please enter a trip name', 'error');
      return;
    }

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
  }, [newBoardTitle, loadingAuth, session, user, router, showToast, fetchBoards]);

  const handleSave = useCallback(async () => {
    if (!selectedBoardId || !post || isSaving) {
      console.log('SaveToTripsModal - handleSave blocked:', { selectedBoardId, post: !!post, isSaving });
      return;
    }

    if (loadingAuth) {
      console.log('SaveToTripsModal - Auth still loading, blocking save');
      showToast('Loading authentication...', 'info');
      return;
    }

    console.log('SaveToTripsModal - Fetching fresh session for handleSave');
    const { data: sessionData } = await supabase.auth.getSession();
    const currentSession = sessionData?.session;
    
    if (!currentSession?.user) {
      console.warn('SaveToTripsModal - No session or user in handleSave');
      showToast('Authentication token not found. Please sign in.', 'error');
      router.push('/auth');
      return;
    }

    console.log('SaveToTripsModal - Saving video to board:', {
      boardId: selectedBoardId,
      postId: post.id,
      userId: currentSession.user.id,
    });

    setIsSaving(true);
    try {
      console.log('SaveToTripsModal - Saving video only');
      const result = await saveVideoOnly(selectedBoardId, post.id);

      console.log('SaveToTripsModal - Save result:', result);

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
        try {
          await AsyncStorage.setItem(LAST_USED_BOARD_KEY, selectedBoardId);
          console.log('SaveToTripsModal - Saved last used board to storage:', selectedBoardId);
        } catch (storageError) {
          console.error('SaveToTripsModal - Error saving last used board:', storageError);
        }

        const selectedBoard = boards.find(b => b.id === selectedBoardId);
        const boardTitle = selectedBoard?.title || 'trip';

        if (!selectedBoard?.cover_url && post.thumbnail_url) {
          console.log('SaveToTripsModal - Updating board cover with post thumbnail');
          await supabase
            .from('boards')
            .update({ cover_url: post.thumbnail_url })
            .eq('id', selectedBoardId);
        }

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
  }, [selectedBoardId, post, isSaving, loadingAuth, router, showToast, boards, onClose]);

  const renderBackdrop = useCallback((props: any) => (
    <BottomSheetBackdrop
      {...props}
      disappearsOnIndex={-1}
      appearsOnIndex={0}
      opacity={0.5}
      pressBehavior="close"
    />
  ), []);

  if (!isVisible || !post) {
    console.log('SaveToTripsModal - Not rendering: isVisible =', isVisible, ', post =', !!post);
    return null;
  }

  const postTitle = post?.caption ?? '';
  const postSubtitle = post?.place_name ?? '';
  const headerSubtitle = `${postTitle.substring(0, 40)}${postTitle.length > 40 ? '...' : ''}${postSubtitle ? ` • ${postSubtitle}` : ''}`;
  
  const isAuthReady = !loadingAuth && !!session && !!user;
  const canSave = selectedBoardId && isAuthReady && !isSaving;

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
                          const itemCountText = itemCount === 1 ? '1 video' : `${itemCount} videos`;
                          
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
                  </>
                )}
              </BottomSheetScrollView>

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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
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
