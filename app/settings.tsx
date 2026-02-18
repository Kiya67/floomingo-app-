
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
  Modal,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { supabase } from '@/lib/supabase';
import { deleteAccount } from '@/utils/api';

export default function SettingsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const bgColor = isDark ? colors.backgroundDark : colors.background;
  const textColor = isDark ? colors.textDark : colors.text;
  const textSecondaryColor = isDark ? colors.textSecondaryDark : colors.textSecondary;
  const cardColor = isDark ? colors.cardDark : colors.card;

  const handleLogout = async () => {
    console.log('User confirmed logout');
    setShowLogoutModal(false);
    
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Error signing out:', error);
      } else {
        console.log('User signed out successfully');
        router.replace('/auth');
      }
    } catch (error) {
      console.error('Error in handleLogout:', error);
    }
  };

  const confirmLogout = () => {
    console.log('User tapped Logout button');
    setShowLogoutModal(true);
  };

  const confirmDeleteAccount = () => {
    console.log('User tapped Delete Account button');
    setShowDeleteModal(true);
  };

  const handleDeleteAccount = async () => {
    console.log('User confirmed account deletion');
    setDeleting(true);

    try {
      await deleteAccount();
      console.log('Account deleted successfully');
      
      await supabase.auth.signOut();
      router.replace('/auth');
    } catch (error: any) {
      console.error('Error deleting account:', error);
      setDeleting(false);
      setShowDeleteModal(false);
      
      setTimeout(() => {
        setShowDeleteModal(true);
      }, 100);
    }
  };

  const handleBlockedUsers = () => {
    console.log('User tapped Blocked Users');
    router.push('/blocked-users');
  };

  const handlePrivacyPolicy = () => {
    console.log('User tapped Privacy Policy');
    router.push('/privacy-policy');
  };

  const handleTermsConditions = () => {
    console.log('User tapped Terms & Conditions');
    router.push('/terms-conditions');
  };

  const handleAbout = () => {
    console.log('User tapped About');
    router.push('/about');
  };

  const settingsSections = [
    {
      title: 'Content',
      items: [
        { label: 'Blocked Users', icon: 'block', onPress: handleBlockedUsers },
      ],
    },
    {
      title: 'Legal',
      items: [
        { label: 'Privacy Policy', icon: 'privacy-tip', onPress: handlePrivacyPolicy },
        { label: 'Terms & Conditions', icon: 'description', onPress: handleTermsConditions },
      ],
    },
    {
      title: 'Support',
      items: [
        { label: 'About', icon: 'info', onPress: handleAbout },
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
                        android_material_icon_name={item.icon}
                        size={24}
                        color={textColor}
                      />
                      <Text style={[styles.settingItemLabel, { color: textColor }]}>
                        {item.label}
                      </Text>
                    </View>
                    <IconSymbol
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

        {/* Delete Account Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: textSecondaryColor }]}>
            DANGER ZONE
          </Text>
          <View style={[styles.sectionCard, { backgroundColor: cardColor }]}>
            <TouchableOpacity
              style={styles.settingItem}
              onPress={confirmDeleteAccount}
            >
              <View style={styles.settingItemLeft}>
                <IconSymbol
                  android_material_icon_name="delete"
                  size={24}
                  color="#EF4444"
                />
                <Text style={[styles.settingItemLabel, { color: '#EF4444' }]}>
                  Delete Account
                </Text>
              </View>
              <IconSymbol
                android_material_icon_name="chevron-right"
                size={24}
                color="#EF4444"
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Logout Button */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.logoutButton, { backgroundColor: cardColor }]}
            onPress={confirmLogout}
          >
            <IconSymbol
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

      {/* Delete Account Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => !deleting && setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: cardColor }]}>
            <IconSymbol
              android_material_icon_name="warning"
              size={48}
              color="#EF4444"
              style={styles.warningIcon}
            />
            <Text style={[styles.modalTitle, { color: textColor }]}>Delete Account</Text>
            <Text style={[styles.modalMessage, { color: textSecondaryColor }]}>
              This is permanent and cannot be undone. All your posts, boards, and data will be permanently deleted.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel, { backgroundColor: bgColor }]}
                onPress={() => setShowDeleteModal(false)}
                disabled={deleting}
              >
                <Text style={[styles.modalButtonText, { color: textColor }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonDelete]}
                onPress={handleDeleteAccount}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>Delete</Text>
                )}
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
    alignItems: 'center',
  },
  warningIcon: {
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 24,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  modalButtonCancel: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalButtonConfirm: {
    backgroundColor: '#EF4444',
  },
  modalButtonDelete: {
    backgroundColor: '#EF4444',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
