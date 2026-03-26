
import React from 'react';
import { Tabs, useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { useColorScheme, StyleSheet, TouchableOpacity, View } from 'react-native';

const PINK = '#FF3B7A';

function UploadTabButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityLabel="Upload"
      style={uploadBtnStyles.wrapper}
    >
      <View style={uploadBtnStyles.circle}>
        <IconSymbol ios_icon_name="plus" android_material_icon_name="add" size={24} color="#FFFFFF" />
      </View>
    </TouchableOpacity>
  );
}

const uploadBtnStyles = StyleSheet.create({
  wrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: PINK,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: PINK,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
});

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();

  const tabBarActiveTintColor = PINK;
  const tabBarInactiveTintColor = isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.4)';
  const tabBarBackgroundColor = isDark ? 'rgba(28, 28, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor,
        tabBarInactiveTintColor,
        tabBarStyle: {
          backgroundColor: tabBarBackgroundColor,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="(moments)"
        options={{
          title: 'Moments',
          tabBarIcon: ({ color, size }) => (
            <IconSymbol
              ios_icon_name="play.circle"
              android_material_icon_name="play-circle-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="(experiences)"
        options={{
          title: 'Experiences',
          tabBarIcon: ({ color, size }) => (
            <IconSymbol
              ios_icon_name="film"
              android_material_icon_name="movie"
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: '',
          tabBarButton: () => (
            <UploadTabButton
              onPress={() => {
                console.log('User tapped upload tab button (iOS)');
                router.push('/upload-type' as any);
              }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: 'Map',
          tabBarIcon: ({ color, size }) => (
            <IconSymbol
              ios_icon_name="map.fill"
              android_material_icon_name="explore"
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <IconSymbol
              ios_icon_name="person.fill"
              android_material_icon_name="person"
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen name="notifications" options={{ href: null }} />
    </Tabs>
  );
}
