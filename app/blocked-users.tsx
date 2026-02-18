
import React, { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  useColorScheme,
  ActivityIndicator,
  Image,
  ImageSourcePropType,
  Modal,
} from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { supabase } from '@/lib/supabase';
import { authenticatedGet, authenticatedDelete } from '@/utils/api';

interface BlockedUser {
  blockerId: string;
  blockedId: string;
  createdAt: string;
  profile?: {
    display_name: string;
    username: string | null;
    avatar_url: string | null;
  };
}

function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: '' };
  if (typeof source === 'string') return { uri: source };
  return source as ImageSourcePropType;
}

export default function BlockedUsersScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblocking, setUnblocking] = useState<string | null>(null);
  const [showUnblockModal, setShowUnblockModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<BlockedUser | null>(null);

  const bgColor = isDark ? colors.backgroundDark : colors.background;
  const textColor = isDark ? colors.textDark : colors.text;
  const textSecondaryColor = isDark ? colors.textSecondaryDark : colors.textSecondary;
  const cardColor = isDark ? colors.cardDark : colors.card;

  useEffect(() => {
    fetchBlockedUsers();
  }, []);

  const fetchBlockedUsers = async () => {
    console.log('Fetching blocked users');
    setLoading(true);

    try {
      const blocks = await authenticatedGet<BlockedUser[]>('/api/blocks');
      console.log('Blocked users fetched:', blocks.length);

      const usersWithProfiles = await Promise.all(
        blocks.map(async (block) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name, username, avatar_url')
            .eq('id', block.blockedId)
            .single();

          return {
            ...block,
            profile: profile || undefined,
          };
        })
      );

      setBlockedUsers(usersWithProfiles);
    } catch (error) {
      console.error('Error fetching blocked users:', error);
    } finally {
      setLoading(false);
    }
  };

  const confirmUnblock = (user: BlockedUser) => {
    console.log('User tapped unblock for:', user.blockedId);
    setSelectedUser(user);
    setShowUnblockModal(true);
  };

  const handleUnblock = async () => {
    if (!selectedUser) return;

    console.log('User confirmed unblock for:', selectedUser.blockedId);
    setUnblocking(selectedUser.blockedId);
    setShowUnblockModal(false);

    try {
      await authenticatedDelete(`/api/blocks/${selectedUser.blockedId}`, {});
      console.log('User unblocked successfully');

      setBlockedUsers((prev) => prev.filter((u) => u.blockedId !== selectedUser.blockedId));
    } catch (error) {
      console.error('Error unblocking user:', error);
    } finally {
      setUnblocking(null);
      setSelectedUser(null);
    }
  };

  const getInitials = (name: string): string => {
    const nameParts = name.split(' ');
    const initials = nameParts.length > 1 ? nameParts[0][0] + nameParts[1][0] : nameParts[0][0];
    return initials.toUpperCase();
  };

  const renderBlockedUser = ({ item }: { item: BlockedUser }) => {
    const displayName = item.profile?.display_name || 'Unknown User';
    const username = item.profile?.username;
    const avatarUrl = item.profile?.avatar_url;
    const isUnblocking = unblocking === item.blockedId;

    return (
      <View style={[styles.userCard, { backgroundColor: cardColor }]}>
        <View style={styles.userInfo}>
          {avatarUrl ? (
            <Image
              source={resolveImageSource(avatarUrl)}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarText}>{getInitials(displayName)}</Text>
            </View>
          )}
          <View style={styles.userDetails}>
            <Text style={[styles.displayName, { color: textColor }]}>{displayName}</Text>
            {username && (
              <Text style={[styles.username, { color: textSecondaryColor }]}>@{username}</Text>
            )}
          </View>
        </View>
        <TouchableOpacity
          style={[styles.unblockButton, { backgroundColor: bgColor }]}
          onPress={() => confirmUnblock(item)}
          disabled={isUnblocking}
        >
          {isUnblocking ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={[styles.unblockButtonText, { color: colors.primary }]}>Unblock</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]} edges={['top']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Blocked Users',
          headerBackTitle: 'Back',
          headerStyle: { backgroundColor: bgColor },
          headerTintColor: textColor,
        }}
      />

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : blockedUsers.length === 0 ? (
        <View style={styles.centerContainer}>
          <IconSymbol
            android_material_icon_name="block"
            size={64}
            color={textSecondaryColor}
            style={styles.emptyIcon}
          />
          <Text style={[styles.emptyTitle, { color: textColor }]}>No Blocked Users</Text>
          <Text style={[styles.emptyMessage, { color: textSecondaryColor }]}>
            You haven't blocked anyone yet.
          </Text>
        </View>
      ) : (
        <FlatList
          data={blockedUsers}
          renderItem={renderBlockedUser}
          keyExtractor={(item) => item.blockedId}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Unblock Confirmation Modal */}
      <Modal
        visible={showUnblockModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUnblockModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: cardColor }]}>
            <Text style={[styles.modalTitle, { color: textColor }]}>Unblock User</Text>
            <Text style={[styles.modalMessage, { color: textSecondaryColor }]}>
              Are you sure you want to unblock {selectedUser?.profile?.display_name || 'this user'}?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel, { backgroundColor: bgColor }]}
                onPress={() => setShowUnblockModal(false)}
              >
                <Text style={[styles.modalButtonText, { color: textColor }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleUnblock}
              >
                <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>Unblock</Text>
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 16,
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  userDetails: {
    marginLeft: 12,
    flex: 1,
  },
  displayName: {
    fontSize: 16,
    fontWeight: '600',
  },
  username: {
    fontSize: 14,
    marginTop: 2,
  },
  unblockButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  unblockButtonText: {
    fontSize: 14,
    fontWeight: '600',
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
    backgroundColor: colors.primary,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
