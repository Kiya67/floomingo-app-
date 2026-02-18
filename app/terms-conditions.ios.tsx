
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

export default function TermsConditionsScreen() {
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
          title: 'Terms & Conditions',
          headerBackTitle: 'Back',
          headerStyle: { backgroundColor: bgColor },
          headerTintColor: textColor,
        }}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: textColor }]}>Terms & Conditions</Text>
        <Text style={[styles.lastUpdated, { color: textSecondaryColor }]}>
          Last Updated: January 2025
        </Text>

        <Text style={[styles.sectionTitle, { color: textColor }]}>1. Acceptance of Terms</Text>
        <Text style={[styles.paragraph, { color: textColor }]}>
          By accessing and using this application, you accept and agree to be bound by the terms and provision of this agreement.
        </Text>

        <Text style={[styles.sectionTitle, { color: textColor }]}>2. User Accounts</Text>
        <Text style={[styles.paragraph, { color: textColor }]}>
          You are responsible for maintaining the confidentiality of your account and password. You agree to accept responsibility for all activities that occur under your account.
        </Text>

        <Text style={[styles.sectionTitle, { color: textColor }]}>3. Content Guidelines</Text>
        <Text style={[styles.paragraph, { color: textColor }]}>
          You agree not to post content that is illegal, offensive, or violates the rights of others. We reserve the right to remove any content that violates these terms.
        </Text>

        <Text style={[styles.sectionTitle, { color: textColor }]}>4. Intellectual Property</Text>
        <Text style={[styles.paragraph, { color: textColor }]}>
          You retain ownership of content you post. By posting content, you grant us a license to use, display, and distribute your content on our platform.
        </Text>

        <Text style={[styles.sectionTitle, { color: textColor }]}>5. Termination</Text>
        <Text style={[styles.paragraph, { color: textColor }]}>
          We reserve the right to terminate or suspend your account at any time for violations of these terms or for any other reason.
        </Text>

        <Text style={[styles.sectionTitle, { color: textColor }]}>6. Limitation of Liability</Text>
        <Text style={[styles.paragraph, { color: textColor }]}>
          We are not liable for any damages arising from your use of this application. The service is provided as is without warranties of any kind.
        </Text>

        <Text style={[styles.sectionTitle, { color: textColor }]}>7. Changes to Terms</Text>
        <Text style={[styles.paragraph, { color: textColor }]}>
          We reserve the right to modify these terms at any time. Continued use of the application after changes constitutes acceptance of the new terms.
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
