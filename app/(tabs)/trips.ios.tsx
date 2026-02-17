
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useColorScheme, ActivityIndicator, RefreshControl, Dimensions, Image, ImageSourcePropType } from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/styles/commonStyles';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';

interface Board {
  id: string;
  user_id: string;
  title: string;
  cover_url?: string;
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
          board_posts (
            id,
            posts (
              thumbnail_url
            )
          )
        `)
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error fetching boards:', error);
        setBoards([]);
      } else {
        const boardsWithCounts = (data || []).map(board => {
          const items = board.board_posts || [];
          const itemCount = items.length;
          const firstThumbnail = items[0]?.posts?.thumbnail_url || null;
          
          return {
            id: board.id,
            user_id: board.user_id,
            title: board.title,
            cover_url: board.cover_url,
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
    
    global.tripsRefreshCallback = () => {
      console.log('TRIPS_REFRESH event received - refreshing boards');
      fetchBoards();
    };
    
    return () => {
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
      <View style={[styles.header, { backgroundColor: bgColor, borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }]}>
        <Text style={[styles.headerTitle, { color: textColor }]}>My Trips</Text>
        <TouchableOpacity
          style={[styles.createButton, { backgroundColor: primaryColor }]}
          onPress={handleCreateBoard}
          activeOpacity={0.8}
        >
          <IconSymbol 
            ios_icon_name="plus"
            android_material_icon_name="add" 
            size={24} 
            color="#FFFFFF"
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
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
            <View style={[styles.emptyIconCircle, { backgroundColor: isDark ? 'rgba(255, 105, 180, 0.1)' : 'rgba(255, 105, 180, 0.1)' }]}>
              <IconSymbol 
                ios_icon_name="map.fill"
                android_material_icon_name="explore" 
                size={48} 
                color={primaryColor}
              />
            </View>
            <Text style={[styles.emptyTitle, { color: textColor }]}>No trips yet</Text>
            <Text style={[styles.emptyText, { color: textSecondaryColor }]}>
              Create your first trip to organize your favorite content
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
              const coverImage = board.cover_url || board.first_thumbnail;
              
              return (
                <TouchableOpacity
                  key={board.id}
                  style={[styles.boardCard, { width: cardWidth }]}
                  onPress={() => handleBoardPress(board.id)}
                  activeOpacity={0.9}
                >
                  <View style={styles.cardImageContainer}>
                    {coverImage ? (
                      <Image
                        source={resolveImageSource(coverImage)}
                        style={styles.boardImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <LinearGradient
                        colors={['#FF69B4', '#FF8C94', '#FFA07A']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.boardImagePlaceholder}
                      >
                        <IconSymbol 
                          ios_icon_name="mappin.circle.fill"
                          android_material_icon_name="location-on" 
                          size={40} 
                          color="rgba(255, 255, 255, 0.8)"
                        />
                      </LinearGradient>
                    )}
                    <LinearGradient
                      colors={['transparent', 'rgba(0, 0, 0, 0.7)']}
                      style={styles.boardOverlay}
                    >
                      <View style={styles.boardInfo}>
                        <Text style={styles.boardTitle} numberOfLines={2}>
                          {board.title}
                        </Text>
                        <Text style={styles.boardCount}>
                          {itemCountText}
                        </Text>
                      </View>
                    </LinearGradient>
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
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: -0.5,
  },
  createButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
  scrollContent: {
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  emptyButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 16,
  },
  boardCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardImageContainer: {
    position: 'relative',
  },
  boardImage: {
    width: '100%',
    height: cardWidth * 1.3,
  },
  boardImagePlaceholder: {
    width: '100%',
    height: cardWidth * 1.3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  boardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 40,
  },
  boardInfo: {
    padding: 12,
  },
  boardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  boardCount: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
