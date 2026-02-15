
import React from "react";
import { StyleSheet, View, Text, ScrollView, Image, TouchableOpacity, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { IconSymbol } from "@/components/IconSymbol";
import { colors } from "@/styles/commonStyles";

// Helper to resolve image sources
function resolveImageSource(source: string | number | any): any {
  if (!source) return { uri: '' };
  if (typeof source === 'string') return { uri: source };
  return source;
}

// Sample travel posts data
const travelPosts = [
  {
    id: '1',
    author: 'Sarah Chen',
    location: 'Santorini, Greece',
    image: 'https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?w=800',
    caption: 'Watching the sunset over the Aegean Sea. Pure magic! ✨',
    likes: 234,
    comments: 18,
  },
  {
    id: '2',
    author: 'Marco Silva',
    location: 'Kyoto, Japan',
    image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800',
    caption: 'Lost in the beauty of Fushimi Inari shrine 🎋',
    likes: 456,
    comments: 32,
  },
  {
    id: '3',
    author: 'Emma Wilson',
    location: 'Banff, Canada',
    image: 'https://images.unsplash.com/photo-1503614472-8c93d56e92ce?w=800',
    caption: 'Mountain mornings hit different 🏔️',
    likes: 189,
    comments: 12,
  },
];

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const bgColor = isDark ? colors.backgroundDark : colors.background;
  const textColor = isDark ? colors.textDark : colors.text;
  const textSecondaryColor = isDark ? colors.textSecondaryDark : colors.textSecondary;
  const cardColor = isDark ? colors.cardDark : colors.card;
  const primaryColor = isDark ? colors.primaryDark : colors.primary;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: textColor }]}>Wanderlust</Text>
        <IconSymbol 
          ios_icon_name="bell.fill"
          android_material_icon_name="notifications" 
          size={24} 
          color={textColor}
        />
      </View>

      {/* Feed */}
      <ScrollView style={styles.feed} showsVerticalScrollIndicator={false}>
        {travelPosts.map((post) => {
          const likesText = `${post.likes}`;
          const commentsText = `${post.comments}`;
          
          return (
            <View key={post.id} style={[styles.postCard, { backgroundColor: cardColor }]}>
              {/* Post Header */}
              <View style={styles.postHeader}>
                <View style={styles.postAuthorInfo}>
                  <View style={[styles.avatar, { backgroundColor: primaryColor }]}>
                    <Text style={styles.avatarText}>{post.author[0]}</Text>
                  </View>
                  <View>
                    <Text style={[styles.authorName, { color: textColor }]}>{post.author}</Text>
                    <View style={styles.locationRow}>
                      <IconSymbol 
                        ios_icon_name="location.fill"
                        android_material_icon_name="location-on" 
                        size={14} 
                        color={textSecondaryColor}
                      />
                      <Text style={[styles.location, { color: textSecondaryColor }]}>{post.location}</Text>
                    </View>
                  </View>
                </View>
                <IconSymbol 
                  ios_icon_name="ellipsis"
                  android_material_icon_name="more-vert" 
                  size={24} 
                  color={textSecondaryColor}
                />
              </View>

              {/* Post Image */}
              <Image 
                source={resolveImageSource(post.image)} 
                style={styles.postImage}
                resizeMode="cover"
              />

              {/* Post Actions */}
              <View style={styles.postActions}>
                <View style={styles.actionButtons}>
                  <TouchableOpacity style={styles.actionButton}>
                    <IconSymbol 
                      ios_icon_name="heart"
                      android_material_icon_name="favorite-border" 
                      size={24} 
                      color={textColor}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton}>
                    <IconSymbol 
                      ios_icon_name="bubble.right"
                      android_material_icon_name="chat-bubble-outline" 
                      size={24} 
                      color={textColor}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton}>
                    <IconSymbol 
                      ios_icon_name="paperplane"
                      android_material_icon_name="send" 
                      size={24} 
                      color={textColor}
                    />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity>
                  <IconSymbol 
                    ios_icon_name="bookmark"
                    android_material_icon_name="bookmark-border" 
                    size={24} 
                    color={textColor}
                  />
                </TouchableOpacity>
              </View>

              {/* Post Stats */}
              <View style={styles.postStats}>
                <Text style={[styles.likes, { color: textColor }]}>{likesText}</Text>
                <Text style={[styles.likesLabel, { color: textColor }]}> likes</Text>
              </View>

              {/* Post Caption */}
              <View style={styles.captionContainer}>
                <Text style={[styles.captionAuthor, { color: textColor }]}>{post.author}</Text>
                <Text style={[styles.caption, { color: textColor }]}> {post.caption}</Text>
              </View>

              {/* Comments Link */}
              <TouchableOpacity>
                <Text style={[styles.viewComments, { color: textSecondaryColor }]}>
                  View all {commentsText} comments
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
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
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  feed: {
    flex: 1,
  },
  postCard: {
    marginBottom: 24,
    borderRadius: 12,
    overflow: 'hidden',
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  postAuthorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  authorName: {
    fontSize: 15,
    fontWeight: '600',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  location: {
    fontSize: 13,
    marginLeft: 2,
  },
  postImage: {
    width: '100%',
    height: 400,
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  actionButtons: {
    flexDirection: 'row',
  },
  actionButton: {
    marginRight: 16,
  },
  postStats: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  likes: {
    fontSize: 14,
    fontWeight: '600',
  },
  likesLabel: {
    fontSize: 14,
  },
  captionContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 8,
    flexWrap: 'wrap',
  },
  captionAuthor: {
    fontSize: 14,
    fontWeight: '600',
  },
  caption: {
    fontSize: 14,
  },
  viewComments: {
    fontSize: 14,
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 12,
  },
});
