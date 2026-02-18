
import React, { useEffect, useState, useCallback } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  useColorScheme,
  ActivityIndicator,
  RefreshControl,
  Image,
  ImageSourcePropType,
} from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { apiGet } from '@/utils/api';

interface FollowingUser {
  id: string;
  username: string | null;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
}

function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) {
    return { uri: '' };
  }
  if (typeof source === 'string') {
    return { uri: source };
  }
  return source as ImageSourcePropType;
}

export default function FollowingListScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const bgColor = isDark ? colors.backgroundDark : colors.background;
  const textColor = isDark ? colors.textDark : colors.text;
  const textSecondaryColor = isDark ? colors.textSecondaryDark : colors.textSecondary;
  const cardColor = isDark ? colors.cardDark : colors.card;
  const primaryColor = isDark ? colors.primaryDark : colors.primary;

  const [following, setFollowing] = useState<FollowingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFollowing = useCallback(async () => {
    console.log('Fetching following for user:', id);
    try {
      const data = await apiGet<FollowingUser[]>(`/api/following/${id}`);
      console.log('Following fetched:', data.length);
      setFollowing(data);
    } catch (error) {
      console.error('Error fetching following:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    fetchFollowing();
  }, [fetchFollowing]);

  const onRefresh = () => {
    console.log('User pulled to refresh following');
    setRefreshing(true);
    fetchFollowing();
  };

  const handleUserPress = (userId: string) => {
    console.log('User tapped on following user:', userId);
    router.push(`/user/${userId}`);
  };

  const getInitials = (name: string) => {
    if (!name) {
      return '?';
    }
    const nameParts = name.split(' ');
    const firstInitial = nameParts[0]?.[0] || '';
    const lastInitial = nameParts[1]?.[0] || '';
    const initials = firstInitial + lastInitial;
    return initials.toUpperCase();
  };

  const renderFollowingItem = ({ item }: { item: FollowingUser }) => {
    const displayName = item.display_name;
    const username = item.username;
    const avatarUrl = item.avatar_url;
    const initials = getInitials(displayName);

    return (
      <TouchableOpacity
        style={[styles.userItem, { backgroundColor: cardColor }]}
        onPress={() => handleUserPress(item.id)}
      >
        <View style={styles.userInfo}>
          {avatarUrl ? (
            <Image source={resolveImageSource(avatarUrl)} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: primaryColor }]}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
          )}
          <View style={styles.userText}>
            <Text style={[styles.displayName, { color: textColor }]}>{displayName}</Text>
            {username ? (
              <Text style={[styles.username, { color: textSecondaryColor }]}>@{username}</Text>
            ) : null}
          </View>
        </View>
        <IconSymbol
          ios_icon_name="chevron.right"
          android_material_icon_name="chevron-right"
          size={24}
          color={textSecondaryColor}
        />
      </TouchableOpacity>
    );
  };

  const emptyText = 'Not following anyone yet';

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: bgColor }]}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Following',
            headerBackTitle: 'Back',
            headerStyle: { backgroundColor: bgColor },
            headerTintColor: textColor,
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={primaryColor} />
          <Text style={[styles.loadingText, { color: textColor }]}>Loading following...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Following',
          headerBackTitle: 'Back',
          headerStyle: { backgroundColor: bgColor },
          headerTintColor: textColor,
        }}
      />
      <FlatList
        data={following}
        renderItem={renderFollowingItem}
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
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <IconSymbol
              ios_icon_name="person.fill"
              android_material_icon_name="person"
              size={64}
              color={textSecondaryColor}
            />
            <Text style={[styles.emptyText, { color: textSecondaryColor }]}>{emptyText}</Text>
          </View>
        }
      />
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
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  listContent: {
    padding: 16,
  },
  userItem: {
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
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  userText: {
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
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
});
