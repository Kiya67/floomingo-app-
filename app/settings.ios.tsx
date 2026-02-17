
import React, { useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
  Alert,
  Modal,
} from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { supabase } from '@/lib/supabase';

export default function SettingsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const bgColor = isDark ? colors.backgroundDark : colors.background;
  const textColor = isDark ? colors.textDark : colors.text;
  const textSecondaryColor = isDark ? colors.textSecondaryDark : colors.textSecondary;
  const cardColor = isDark ? colors.cardDark : colors.card;
  const primaryColor = isDark ? colors.primaryDark : colors.primary;

  const handleLogout = async () => {
    console.log('User confirmed logout');
    setShowLogoutModal(false);
    
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Error signing out:', error);
        Alert.alert('Error', 'Failed to sign out. Please try again.');
      } else {
        console.log('User signed out successfully');
        router.replace('/auth');
      }
    } catch (error) {
      console.error('Error in handleLogout:', error);
      Alert.alert('Error', 'An unexpected error occurred.');
    }
  };

  const confirmLogout = () => {
    console.log('User tapped Logout button');
    setShowLogoutModal(true);
  };

  const settingsSections = [
    {
      title: 'Account',
      items: [
        { label: 'Security', iosIcon: 'shield.fill', androidIcon: 'security', onPress: () => console.log('Security tapped') },
      ],
    },
    {
      title: 'Content',
      items: [
        { label: 'Blocked Users', iosIcon: 'hand.raised.fill', androidIcon: 'block', onPress: () => console.log('Blocked Users tapped') },
      ],
    },
    {
      title: 'Support',
      items: [
        { label: 'Help Center', iosIcon: 'questionmark.circle.fill', androidIcon: 'help', onPress: () => console.log('Help Center tapped') },
        { label: 'About', iosIcon: 'info.circle.fill', androidIcon: 'info', onPress: () => console.log('About tapped') },
      ],
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]} edges={['top']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Settings',
          headerBackTitle: 'Back',
          headerStyle: { backgroundColor: bgColor },
          headerTintColor: textColor,
        }}
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        {settingsSections.map((section, sectionIndex) => (
          <View key={sectionIndex} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: textSecondaryColor }]}>
              {section.title}
            </Text>
            <View style={[styles.sectionCard, { backgroundColor: cardColor }]}>
              {section.items.map((item, itemIndex) => (
                <React.Fragment key={itemIndex}>
                  <TouchableOpacity
                    style={styles.settingItem}
                    onPress={item.onPress}
                  >
                    <View style={styles.settingItemLeft}>
                      <IconSymbol
                        ios_icon_name={item.iosIcon}
                        android_material_icon_name={item.androidIcon}
                        size={24}
                        color={textColor}
                      />
                      <Text style={[styles.settingItemLabel, { color: textColor }]}>
                        {item.label}
                      </Text>
                    </View>
                    <IconSymbol
                      ios_icon_name="chevron.right"
                      android_material_icon_name="chevron-right"
                      size={24}
                      color={textSecondaryColor}
                    />
                  </TouchableOpacity>
                  {itemIndex < section.items.length - 1 && (
                    <View style={[styles.divider, { backgroundColor: bgColor }]} />
                  )}
                </React.Fragment>
              ))}
            </View>
          </View>
        ))}

        {/* Logout Button */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.logoutButton, { backgroundColor: cardColor }]}
            onPress={confirmLogout}
          >
            <IconSymbol
              ios_icon_name="rectangle.portrait.and.arrow.right"
              android_material_icon_name="logout"
              size={24}
              color="#EF4444"
            />
            <Text style={styles.logoutButtonText}>Log Out</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: textSecondaryColor }]}>
            Version 1.0.0
          </Text>
        </View>
      </ScrollView>

      {/* Logout Confirmation Modal */}
      <Modal
        visible={showLogoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: cardColor }]}>
            <Text style={[styles.modalTitle, { color: textColor }]}>Log Out</Text>
            <Text style={[styles.modalMessage, { color: textSecondaryColor }]}>
              Are you sure you want to log out?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel, { backgroundColor: bgColor }]}
                onPress={() => setShowLogoutModal(false)}
              >
                <Text style={[styles.modalButtonText, { color: textColor }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleLogout}
              >
                <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>Log Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionCard: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  settingItemLabel: {
    fontSize: 16,
  },
  divider: {
    height: 1,
    marginLeft: 56,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
    borderRadius: 12,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  footerText: {
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  modalMessage: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalButtonConfirm: {
    backgroundColor: '#EF4444',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
