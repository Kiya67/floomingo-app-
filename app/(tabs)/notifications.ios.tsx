
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, useColorScheme, ActivityIndicator, Image, ImageSourcePropType, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect, Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';

interface Notification {
  id: string;
  user_id: string;
  actor_id: string;
  type: 'like' | 'comment' | 'follow';
  post_id: string | null;
  is_read: boolean;
  created_at: string;
  profiles: {
    username: string;
    avatar_url: string | null;
  };
}

function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: '' };
  if (typeof source === 'string') return { uri: source };
  return source as ImageSourcePropType;
}

function getRelativeTime(timestamp: string): string {
  const now = new Date();
  const past = new Date(timestamp);
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return 'Just now';
  }
  if (diffMins < 60) {
    return `${diffMins}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }
  return past.toLocaleDateString();
}

export default function NotificationsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const bgColor = isDark ? colors.backgroundDark : colors.background;
  const textColor = isDark ? colors.textDark : colors.text;
  const textSecondaryColor = isDark ? colors.textSecondaryDark : colors.textSecondary;
  const cardColor = isDark ? colors.cardDark : colors.card;
  const primaryColor = isDark ? colors.primaryDark : colors.primary;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    console.log('Fetching notifications');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('No authenticated user');
        setNotifications([]);
        setLoading(false);
        return;
      }

      setCurrentUserId(user.id);

      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          profiles!notifications_actor_id_fkey (
            username,
            avatar_url
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching notifications:', error);
        setNotifications([]);
      } else {
        console.log('Notifications fetched:', data?.length || 0);
        setNotifications(data || []);
      }
    } catch (error) {
      console.error('Error in fetchNotifications:', error);
      setNotifications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const markNotificationsAsRead = useCallback(async () => {
    if (!currentUserId) return;

    console.log('Marking visible notifications as read');
    try {
      const unreadIds = notifications
        .filter(n => !n.is_read)
        .map(n => n.id);

      if (unreadIds.length === 0) return;

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .in('id', unreadIds)
        .eq('user_id', currentUserId);

      if (error) {
        console.error('Error marking notifications as read:', error);
      } else {
        console.log('Marked notifications as read:', unreadIds.length);
        setNotifications(prev =>
          prev.map(n => unreadIds.includes(n.id) ? { ...n, is_read: true } : n)
        );
      }
    } catch (error) {
      console.error('Error in markNotificationsAsRead:', error);
    }
  }, [notifications, currentUserId]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useFocusEffect(
    useCallback(() => {
      console.log('Notifications screen focused - marking as read');
      const timer = setTimeout(() => {
        markNotificationsAsRead();
      }, 1000);

      return () => clearTimeout(timer);
    }, [markNotificationsAsRead])
  );

  const onRefresh = useCallback(() => {
    console.log('User pulled to refresh notifications');
    setRefreshing(true);
    fetchNotifications();
  }, [fetchNotifications]);

  const handleNotificationPress = useCallback((notification: Notification) => {
    console.log('User tapped notification:', notification.type);

    if (notification.type === 'like' || notification.type === 'comment') {
      if (notification.post_id) {
        console.log('Navigating to video:', notification.post_id);
        router.push(`/video/${notification.post_id}`);
      }
    } else if (notification.type === 'follow') {
      console.log('Navigating to user profile:', notification.actor_id);
      router.push(`/user/${notification.actor_id}`);
    }
  }, [router]);

  const handleBack = () => {
    console.log('User tapped back button on notifications');
    router.back();
  };

  const getNotificationMessage = (notification: Notification): string => {
    const username = notification.profiles?.username || 'Someone';
    
    switch (notification.type) {
      case 'like':
        return `${username} liked your video`;
      case 'comment':
        return `${username} commented on your video`;
      case 'follow':
        return `${username} followed you`;
      default:
        return `${username} interacted with you`;
    }
  };

  const getNotificationIcon = (type: string): string => {
    switch (type) {
      case 'like':
        return 'heart.fill';
      case 'comment':
        return 'bubble.left.fill';
      case 'follow':
        return 'person.badge.plus.fill';
      default:
        return 'bell.fill';
    }
  };

  const getInitials = (username: string): string => {
    if (!username) return '?';
    return username.substring(0, 2).toUpperCase();
  };

  const renderNotificationItem = ({ item }: { item: Notification }) => {
    const message = getNotificationMessage(item);
    const relativeTime = getRelativeTime(item.created_at);
    const avatarUrl = item.profiles?.avatar_url || '';
    const initials = getInitials(item.profiles?.username || '');
    const iconName = getNotificationIcon(item.type);

    return (
      <TouchableOpacity
        style={[
          styles.notificationItem,
          { backgroundColor: cardColor },
          !item.is_read && { backgroundColor: isDark ? '#2A2A2A' : '#F0F8FF' }
        ]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.notificationContent}>
          <View style={styles.avatarContainer}>
            {avatarUrl ? (
              <Image 
                source={resolveImageSource(avatarUrl)} 
                style={styles.avatar}
              />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: primaryColor }]}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            )}
            <View style={[styles.iconBadge, { backgroundColor: primaryColor }]}>
              <IconSymbol 
                ios_icon_name={iconName}
                android_material_icon_name="favorite" 
                size={12} 
                color="#FFFFFF"
              />
            </View>
          </View>

          <View style={styles.notificationTextContainer}>
            <Text style={[styles.notificationMessage, { color: textColor }]} numberOfLines={2}>
              {message}
            </Text>
            <Text style={[styles.notificationTime, { color: textSecondaryColor }]}>
              {relativeTime}
            </Text>
          </View>

          {!item.is_read && (
            <View style={[styles.unreadDot, { backgroundColor: primaryColor }]} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: bgColor }]}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Notifications',
            headerBackTitle: 'Back',
            headerStyle: { backgroundColor: bgColor },
            headerTintColor: textColor,
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Notifications',
          headerBackTitle: 'Back',
          headerStyle: { backgroundColor: bgColor },
          headerTintColor: textColor,
        }}
      />

      {notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <IconSymbol 
            ios_icon_name="bell.slash"
            android_material_icon_name="notifications-none" 
            size={64} 
            color={textSecondaryColor}
          />
          <Text style={[styles.emptyText, { color: textSecondaryColor }]}>
            No notifications yet
          </Text>
          <Text style={[styles.emptySubtext, { color: textSecondaryColor }]}>
            When someone likes, comments, or follows you, you&apos;ll see it here
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotificationItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={primaryColor}
              colors={[primaryColor]}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  listContent: {
    paddingVertical: 8,
    paddingBottom: 100,
  },
  notificationItem: {
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
    padding: 16,
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#333',
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  iconBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  notificationTextContainer: {
    flex: 1,
  },
  notificationMessage: {
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 13,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: 8,
  },
});
