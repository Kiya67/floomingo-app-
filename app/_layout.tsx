
import React, { useEffect, useState } from "react";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { SystemBars } from "react-native-edge-to-edge";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  DarkTheme,
  DefaultTheme,
  Theme,
  ThemeProvider,
} from "@react-navigation/native";
import { WidgetProvider } from "@/contexts/WidgetContext";
import { SupabaseAuthProvider } from "@/contexts/SupabaseAuthContext";
import * as SplashScreen from "expo-splash-screen";
import { useColorScheme, Alert } from "react-native";
import { useNetworkState } from "expo-network";
import { supabase } from "@/lib/supabase";
import { ensureProfileRow } from "@/utils/supabaseHelpers";

SplashScreen.preventAutoHideAsync();

const BlackDarkTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#000000',
    card: '#1A1A1A',
    border: '#333333',
  },
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });
  const { isConnected } = useNetworkState();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      console.log('RootLayout - Initial session check:', !!session);
      
      // CRITICAL: Ensure profile row exists on app launch
      if (session) {
        try {
          await ensureProfileRow();
          console.log('RootLayout - Profile row ensured on app launch');
        } catch (error) {
          console.error('RootLayout - Error ensuring profile row:', error);
        }
      }
      
      setIsReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log('RootLayout - Auth state changed:', _event, !!session);
      
      // CRITICAL: Ensure profile row exists after login
      if (_event === 'SIGNED_IN' && session) {
        try {
          await ensureProfileRow();
          console.log('RootLayout - Profile row ensured after login');
        } catch (error) {
          console.error('RootLayout - Error ensuring profile row after login:', error);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (loaded && isReady) {
      SplashScreen.hideAsync();
    }
  }, [loaded, isReady]);

  useEffect(() => {
    if (isConnected === false) {
      Alert.alert(
        "No Internet Connection",
        "Please check your internet connection and try again."
      );
    }
  }, [isConnected]);

  if (!loaded || !isReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === "dark" ? BlackDarkTheme : DefaultTheme}>
        <SupabaseAuthProvider>
          <WidgetProvider>
            <SystemBars style={colorScheme === "dark" ? "light" : "dark"} />
            <Stack>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="auth" options={{ headerShown: false }} />
              <Stack.Screen name="auth-popup" options={{ headerShown: false }} />
              <Stack.Screen name="auth-callback" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="+not-found" />
            </Stack>
            <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
          </WidgetProvider>
        </SupabaseAuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
