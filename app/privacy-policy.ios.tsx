
import React from 'react';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  useColorScheme,
} from 'react-native';
import { colors } from '@/styles/commonStyles';

export default function PrivacyPolicyScreen() {
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
          title: 'Privacy Policy',
          headerBackTitle: 'Back',
          headerStyle: { backgroundColor: bgColor },
          headerTintColor: textColor,
        }}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: textColor }]}>Privacy Policy</Text>
        <Text style={[styles.lastUpdated, { color: textSecondaryColor }]}>
          Last Updated: January 2025
        </Text>

        <Text style={[styles.sectionTitle, { color: textColor }]}>1. Information We Collect</Text>
        <Text style={[styles.paragraph, { color: textColor }]}>
          We collect information you provide directly to us, including your name, email address, profile information, and content you post on our platform.
        </Text>

        <Text style={[styles.sectionTitle, { color: textColor }]}>2. How We Use Your Information</Text>
        <Text style={[styles.paragraph, { color: textColor }]}>
          We use the information we collect to provide, maintain, and improve our services, to communicate with you, and to personalize your experience.
        </Text>

        <Text style={[styles.sectionTitle, { color: textColor }]}>3. Information Sharing</Text>
        <Text style={[styles.paragraph, { color: textColor }]}>
          We do not sell your personal information. We may share your information with service providers who help us operate our platform, or when required by law.
        </Text>

        <Text style={[styles.sectionTitle, { color: textColor }]}>4. Data Security</Text>
        <Text style={[styles.paragraph, { color: textColor }]}>
          We implement appropriate security measures to protect your personal information from unauthorized access, alteration, or destruction.
        </Text>

        <Text style={[styles.sectionTitle, { color: textColor }]}>5. Your Rights</Text>
        <Text style={[styles.paragraph, { color: textColor }]}>
          You have the right to access, update, or delete your personal information at any time through your account settings.
        </Text>

        <Text style={[styles.sectionTitle, { color: textColor }]}>6. Contact Us</Text>
        <Text style={[styles.paragraph, { color: textColor }]}>
          If you have any questions about this Privacy Policy, please contact us through the app or via email.
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
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 8,
  },
  lastUpdated: {
    fontSize: 14,
    marginBottom: 24,
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
  bottomPadding: {
    height: 40,
  },
});
