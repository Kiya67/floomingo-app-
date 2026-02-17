
import React from 'react';
import { Tabs } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { useColorScheme } from 'react-native';
import { BlurView } from 'expo-blur';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const tabBarActiveTintColor = isDark ? colors.primaryDark : colors.primary;
  const tabBarInactiveTintColor = isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.4)';
  const tabBarBackgroundColor = isDark ? 'rgba(28, 28, 30, 0.9)' : 'rgba(255, 255, 255, 0.9)';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor,
        tabBarInactiveTintColor,
        tabBarStyle: {
          backgroundColor: tabBarBackgroundColor,
          borderTopWidth: 0,
          height: 70,
          paddingBottom: 12,
          paddingTop: 12,
          position: 'absolute',
          bottom: 8,
          left: 16,
          right: 16,
          borderRadius: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isDark ? 0.3 : 0.15,
          shadowRadius: 8,
          elevation: 8,
        },
        tabBarBackground: () => (
          <BlurView
            intensity={80}
            style={{
              flex: 1,
              borderRadius: 20,
              backgroundColor: tabBarBackgroundColor,
              overflow: 'hidden',
            }}
          />
        ),
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="(home)"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <IconSymbol 
              android_material_icon_name="home" 
              size={size} 
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: 'Add',
          tabBarIcon: ({ color, size }) => (
            <IconSymbol 
              android_material_icon_name="add-circle" 
              size={size} 
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: 'Trips',
          tabBarIcon: ({ color, size }) => (
            <IconSymbol 
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
              android_material_icon_name="person" 
              size={size} 
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
