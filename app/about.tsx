
import React from 'react';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  useColorScheme,
  Image,
} from 'react-native';
import { colors } from '@/styles/commonStyles';

export default function AboutScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const bgColor = isDark ? colors.backgroundDark : colors.background;
  const textColor = isDark ? colors.textDark : colors.text;
  const textSecondaryColor = isDark ? colors.textSecondaryDark : colors.textSecondary;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]} edges={['top']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'About',
          headerBackTitle: 'Back',
          headerStyle: { backgroundColor: bgColor },
          headerTintColor: textColor,
        }}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.logoContainer}>
          <View style={[styles.logoPlaceholder, { backgroundColor: colors.primary }]}>
            <Text style={styles.logoText}>App</Text>
          </View>
        </View>

        <Text style={[styles.appName, { color: textColor }]}>Travel Social</Text>
        <Text style={[styles.version, { color: textSecondaryColor }]}>Version 1.0.0</Text>

        <Text style={[styles.sectionTitle, { color: textColor }]}>About This App</Text>
        <Text style={[styles.paragraph, { color: textColor }]}>
          Welcome to our travel social media platform! Share your travel experiences, discover new destinations, and connect with fellow travelers from around the world.
        </Text>

        <Text style={[styles.sectionTitle, { color: textColor }]}>Features</Text>
        <Text style={[styles.bulletPoint, { color: textColor }]}>• Share travel videos and photos</Text>
        <Text style={[styles.bulletPoint, { color: textColor }]}>• Discover new destinations</Text>
        <Text style={[styles.bulletPoint, { color: textColor }]}>• Create travel boards and collections</Text>
        <Text style={[styles.bulletPoint, { color: textColor }]}>• Follow other travelers</Text>
        <Text style={[styles.bulletPoint, { color: textColor }]}>• Save places to visit</Text>

        <Text style={[styles.sectionTitle, { color: textColor }]}>Contact</Text>
        <Text style={[styles.paragraph, { color: textColor }]}>
          Have questions or feedback? We'd love to hear from you! Reach out to us through the app or via email.
        </Text>

        <Text style={[styles.copyright, { color: textSecondaryColor }]}>
          © 2025 Travel Social. All rights reserved.
        </Text>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 20,
  },
  logoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: 'bold',
  },
  appName: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  version: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 12,
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
  },
  bulletPoint: {
    fontSize: 16,
    lineHeight: 28,
    marginLeft: 8,
  },
  copyright: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 32,
    marginBottom: 16,
  },
  bottomPadding: {
    height: 40,
  },
});
