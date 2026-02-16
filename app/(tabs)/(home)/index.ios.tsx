
import React, { useEffect, useState } from "react";
import { StyleSheet, View, Text, ScrollView, useColorScheme, ActivityIndicator, Dimensions, RefreshControl } from "react-native";
import { IconSymbol } from "@/components/IconSymbol";
import { colors } from "@/styles/commonStyles";
import { supabase } from "@/lib/supabase";
import { VideoGridItem } from "@/components/VideoGridItem";

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

const { width } = Dimensions.get('window');
const gridItemSize = (width - 48) / 3;

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const bgColor = isDark ? colors.backgroundDark : colors.background;
  const textColor = isDark ? colors.textDark : colors.text;
  const textSecondaryColor = isDark ? colors.textSecondaryDark : colors.textSecondary;
  const cardColor = isDark ? colors.cardDark : colors.card;
  const primaryColor = isDark ? colors.primaryDark : colors.primary;

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    console.log('Fetching posts from database');
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles!posts_user_id_fkey (
            display_name,
            avatar_url
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching posts:', error);
      } else {
        console.log('Posts fetched successfully:', data?.length || 0);
        
        // Convert video paths to public URLs
        const postsWithUrls = (data || []).map(post => {
          let videoUrl = post.video_url;
          
          // If video_url is just a path (not a full URL), convert it to a public URL
          if (videoUrl && !videoUrl.startsWith('http')) {
            const { data: urlData } = supabase.storage
              .from('videos')
              .getPublicUrl(videoUrl);
            videoUrl = urlData.publicUrl;
            console.log('Converted video path to public URL:', videoUrl);
          }
          
          return {
            ...post,
            video_url: videoUrl
          };
        });
        
        setPosts(postsWithUrls);
      }
    } catch (error) {
      console.error('Error in fetchPosts:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    console.log('User pulled to refresh posts');
    setRefreshing(true);
    await fetchPosts();
    setRefreshing(false);
  };

  const emptyText = 'No videos yet. Be the first to post!';

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: bgColor }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={primaryColor} />
          <Text style={[styles.loadingText, { color: textColor }]}>Loading videos...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <ScrollView 
        style={styles.feed} 
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
        {posts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <IconSymbol 
              ios_icon_name="video.fill"
              android_material_icon_name="videocam" 
              size={64} 
              color={textSecondaryColor}
            />
            <Text style={[styles.emptyText, { color: textSecondaryColor }]}>
              {emptyText}
            </Text>
          </View>
        ) : (
          <View style={styles.gridContainer}>
            {posts.map((post) => (
              <VideoGridItem
                key={post.id}
                postId={post.id}
                videoUrl={post.video_url}
                size={gridItemSize}
                cardColor={cardColor}
              />
            ))}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  feed: {
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
    textAlign: 'center',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    paddingTop: 60,
    gap: 6,
  },
});
