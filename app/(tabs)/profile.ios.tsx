
import React, { useEffect, useState } from "react";
import { IconSymbol } from "@/components/IconSymbol";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@react-navigation/native";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useColorScheme, ActivityIndicator, Image } from "react-native";
import { colors } from "@/styles/commonStyles";
import { supabase } from "@/lib/supabase";
import { useRouter } from "expo-router";

interface Profile {
  id: string;
  email: string;
  display_name: string;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
}

function resolveImageSource(source: string | number | any) {
  if (!source) return { uri: '' };
  if (typeof source === 'string') return { uri: source };
  return source;
}

export default function ProfileScreen() {
  const router = useRouter();
  const theme = useTheme();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  
  const bgColor = isDark ? colors.backgroundDark : colors.background;
  const textColor = isDark ? colors.textDark : colors.text;
  const textSecondaryColor = isDark ? colors.textSecondaryDark : colors.textSecondary;
  const cardColor = isDark ? colors.cardDark : colors.card;
  const primaryColor = isDark ? colors.primaryDark : colors.primary;

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    console.log('Fetching user profile');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.log('No user found');
        setLoading(false);
        return;
      }

      console.log('User ID:', user.id);

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
      } else {
        console.log('Profile fetched successfully:', data);
        setProfile(data);
      }
    } catch (error) {
      console.error('Error in fetchProfile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditProfile = () => {
    console.log('User tapped Edit Profile button');
    router.push('/edit-profile');
  };

  const getInitials = (name: string) => {
    const nameParts = name.split(' ');
    const firstInitial = nameParts[0]?.charAt(0) || '';
    const lastInitial = nameParts[1]?.charAt(0) || '';
    const initials = firstInitial + lastInitial;
    return initials.toUpperCase();
  };

  const displayName = profile?.display_name || 'User';
  const displayUsername = profile?.username || '';
  const displayBio = profile?.bio || 'No bio yet';
  const initials = getInitials(displayName);

  const postsCount = '0';
  const followersCount = '0';
  const followingCount = '0';

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={primaryColor} />
          <Text style={[styles.loadingText, { color: textColor }]}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: textColor }]}>Profile</Text>
          <IconSymbol 
            ios_icon_name="gearshape.fill"
            android_material_icon_name="settings" 
            size={24} 
            color={textColor}
          />
        </View>

        {/* Cover Photo */}
        <View style={styles.coverContainer}>
          {profile?.cover_url ? (
            <Image source={resolveImageSource(profile.cover_url)} style={styles.coverImage} />
          ) : (
            <View style={[styles.coverPlaceholder, { backgroundColor: cardColor }]} />
          )}
        </View>

        {/* Profile Info */}
        <View style={styles.profileSection}>
          {profile?.avatar_url ? (
            <Image source={resolveImageSource(profile.avatar_url)} style={styles.avatarLarge} />
          ) : (
            <View style={[styles.avatarLarge, { backgroundColor: primaryColor }]}>
              <Text style={styles.avatarLargeText}>{initials}</Text>
            </View>
          )}
          
          <Text style={[styles.name, { color: textColor }]}>{displayName}</Text>
          {displayUsername ? (
            <Text style={[styles.username, { color: textSecondaryColor }]}>@{displayUsername}</Text>
          ) : null}
          <Text style={[styles.bio, { color: textSecondaryColor }]}>
            {displayBio}
          </Text>

          {/* Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: textColor }]}>{postsCount}</Text>
              <Text style={[styles.statLabel, { color: textSecondaryColor }]}>Posts</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: textColor }]}>{followersCount}</Text>
              <Text style={[styles.statLabel, { color: textSecondaryColor }]}>Followers</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: textColor }]}>{followingCount}</Text>
              <Text style={[styles.statLabel, { color: textSecondaryColor }]}>Following</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={[styles.editButton, { backgroundColor: primaryColor }]}
              onPress={handleEditProfile}
            >
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.shareButton, { backgroundColor: cardColor }]}>
              <IconSymbol 
                ios_icon_name="square.and.arrow.up"
                android_material_icon_name="share" 
                size={20} 
                color={textColor}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Highlights Section */}
        <View style={styles.highlightsSection}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>Travel Highlights</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.highlightsScroll}>
            {['Europe', 'Asia', 'Americas', 'Africa'].map((continent, index) => (
              <View key={index} style={styles.highlightItem}>
                <View style={[styles.highlightCircle, { backgroundColor: cardColor }]}>
                  <IconSymbol 
                    ios_icon_name="plus"
                    android_material_icon_name="add" 
                    size={32} 
                    color={textSecondaryColor}
                  />
                </View>
                <Text style={[styles.highlightLabel, { color: textColor }]}>{continent}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Posts Grid Placeholder */}
        <View style={styles.postsSection}>
          <View style={styles.tabBar}>
            <TouchableOpacity style={styles.tab}>
              <IconSymbol 
                ios_icon_name="square.grid.2x2"
                android_material_icon_name="grid-on" 
                size={24} 
                color={primaryColor}
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.tab}>
              <IconSymbol 
                ios_icon_name="bookmark"
                android_material_icon_name="bookmark-border" 
                size={24} 
                color={textSecondaryColor}
              />
            </TouchableOpacity>
          </View>
          
          <View style={styles.postsGrid}>
            <Text style={[styles.emptyText, { color: textSecondaryColor }]}>
              Your travel posts will appear here
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  coverContainer: {
    height: 150,
    width: '100%',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
  },
  profileSection: {
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: -50,
  },
  avatarLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  avatarLargeText: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: 'bold',
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  username: {
    fontSize: 16,
    marginBottom: 8,
  },
  bio: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    marginTop: 24,
    marginBottom: 24,
    width: '100%',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
  },
  actionButtons: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  editButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  shareButton: {
    width: 48,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  highlightsSection: {
    marginTop: 32,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  highlightsScroll: {
    marginBottom: 24,
  },
  highlightItem: {
    alignItems: 'center',
    marginRight: 16,
  },
  highlightCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  highlightLabel: {
    fontSize: 12,
  },
  postsSection: {
    marginTop: 16,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  postsGrid: {
    padding: 16,
    minHeight: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
