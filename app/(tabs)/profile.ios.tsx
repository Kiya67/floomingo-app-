
import { IconSymbol } from "@/components/IconSymbol";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@react-navigation/native";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useColorScheme } from "react-native";
import React from "react";
import { colors } from "@/styles/commonStyles";

export default function ProfileScreen() {
  const theme = useTheme();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const bgColor = isDark ? colors.backgroundDark : colors.background;
  const textColor = isDark ? colors.textDark : colors.text;
  const textSecondaryColor = isDark ? colors.textSecondaryDark : colors.textSecondary;
  const cardColor = isDark ? colors.cardDark : colors.card;
  const primaryColor = isDark ? colors.primaryDark : colors.primary;

  const postsCount = '24';
  const followersCount = '1.2K';
  const followingCount = '456';

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

        {/* Profile Info */}
        <View style={styles.profileSection}>
          <View style={[styles.avatarLarge, { backgroundColor: primaryColor }]}>
            <Text style={styles.avatarLargeText}>JD</Text>
          </View>
          
          <Text style={[styles.name, { color: textColor }]}>John Doe</Text>
          <Text style={[styles.bio, { color: textSecondaryColor }]}>
            Travel enthusiast 🌍 | Adventure seeker ✈️
          </Text>
          <Text style={[styles.bio, { color: textSecondaryColor }]}>
            Exploring the world one destination at a time
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
            <TouchableOpacity style={[styles.editButton, { backgroundColor: primaryColor }]}>
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
  profileSection: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  avatarLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarLargeText: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: 'bold',
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  bio: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
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
