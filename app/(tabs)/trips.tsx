
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useColorScheme, ActivityIndicator, RefreshControl, Dimensions, Image, ImageSourcePropType } from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';

interface Board {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  item_count?: number;
  first_thumbnail?: string;
}

const windowWidth = Dimensions.get('window').width;
const cardWidth = (windowWidth - 48) / 2;

function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: '' };
  if (typeof source === 'string') return { uri: source };
  return source as ImageSourcePropType;
}

export default function TripsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const bgColor = isDark ? colors.backgroundDark : colors.background;
  const textColor = isDark ? colors.textDark : colors.text;
  const textSecondaryColor = isDark ? colors.textSecondaryDark : colors.textSecondary;
  const cardColor = isDark ? colors.cardDark : colors.card;
  const primaryColor = isDark ? colors.primaryDark : colors.primary;

  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBoards = useCallback(async () => {
    console.log('Fetching user boards');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('No authenticated user');
        setBoards([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('boards')
        .select(`
          *,
          board_items (
            id,
            posts (
              thumbnail_url
            )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching boards:', error);
        setBoards([]);
      } else {
        const boardsWithCounts = (data || []).map(board => {
          const items = board.board_items || [];
          const itemCount = items.length;
          const firstThumbnail = items[0]?.posts?.thumbnail_url || null;
          
          return {
            id: board.id,
            user_id: board.user_id,
            title: board.title,
            created_at: board.created_at,
            item_count: itemCount,
            first_thumbnail: firstThumbnail,
          };
        });
        
        console.log('Boards fetched successfully:', boardsWithCounts.length);
        setBoards(boardsWithCounts);
      }
    } catch (error) {
      console.error('Error in fetchBoards:', error);
      setBoards([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBoards();
    
    // Set up global refresh callback for TRIPS_REFRESH event
    global.tripsRefreshCallback = () => {
      console.log('TRIPS_REFRESH event received - refreshing boards');
      fetchBoards();
    };
    
    return () => {
      // Clean up callback on unmount
      global.tripsRefreshCallback = undefined;
    };
  }, [fetchBoards]);

  const onRefresh = useCallback(async () => {
    console.log('User pulled to refresh boards');
    setRefreshing(true);
    await fetchBoards();
    setRefreshing(false);
  }, [fetchBoards]);

  const handleBoardPress = (boardId: string) => {
    console.log('User tapped board:', boardId);
    router.push(`/board/${boardId}`);
  };

  const handleCreateBoard = () => {
    console.log('User tapped create new trip');
    router.push('/board/create');
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: bgColor }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={primaryColor} />
          <Text style={[styles.loadingText, { color: textColor }]}>Loading trips...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={[styles.header, { backgroundColor: bgColor }]}>
        <Text style={[styles.headerTitle, { color: textColor }]}>My Trips</Text>
        <TouchableOpacity
          style={[styles.createButton, { backgroundColor: primaryColor }]}
          onPress={handleCreateBoard}
          activeOpacity={0.8}
        >
          <IconSymbol 
            android_material_icon_name="add" 
            size={24} 
            color="#FFFFFF"
          />
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
        {boards.length === 0 ? (
          <View style={styles.emptyContainer}>
            <IconSymbol 
              android_material_icon_name="explore" 
              size={64} 
              color={textSecondaryColor}
            />
            <Text style={[styles.emptyTitle, { color: textColor }]}>No trips yet</Text>
            <Text style={[styles.emptyText, { color: textSecondaryColor }]}>
              Save videos to trips to organize your favorite content
            </Text>
            <TouchableOpacity
              style={[styles.emptyButton, { backgroundColor: primaryColor }]}
              onPress={handleCreateBoard}
              activeOpacity={0.8}
            >
              <Text style={styles.emptyButtonText}>Create Your First Trip</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.gridContainer}>
            {boards.map((board) => {
              const itemCountText = board.item_count === 1 ? '1 item' : `${board.item_count || 0} items`;
              
              return (
                <TouchableOpacity
                  key={board.id}
                  style={[styles.boardCard, { width: cardWidth, backgroundColor: cardColor }]}
                  onPress={() => handleBoardPress(board.id)}
                  activeOpacity={0.8}
                >
                  {board.first_thumbnail ? (
                    <Image
                      source={resolveImageSource(board.first_thumbnail)}
                      style={styles.boardImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.boardImagePlaceholder, { backgroundColor: isDark ? '#333' : '#E0E0E0' }]}>
                      <IconSymbol 
                        android_material_icon_name="image" 
                        size={48} 
                        color={textSecondaryColor}
                      />
                    </View>
                  )}
                  <View style={styles.boardInfo}>
                    <Text style={[styles.boardTitle, { color: textColor }]} numberOfLines={2}>
                      {board.title}
                    </Text>
                    <Text style={[styles.boardCount, { color: textSecondaryColor }]}>
                      {itemCountText}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
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
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  createButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
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
  scrollView: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 8,
    textAlign: 'center',
  },
  emptyButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 12,
  },
  boardCard: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 4,
  },
  boardImage: {
    width: '100%',
    height: cardWidth * 1.2,
  },
  boardImagePlaceholder: {
    width: '100%',
    height: cardWidth * 1.2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  boardInfo: {
    padding: 12,
  },
  boardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  boardCount: {
    fontSize: 14,
  },
});
