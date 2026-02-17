
import { useEffect, useCallback } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const router = useRouter();

  const handleAuthCallback = useCallback(async () => {
    try {
      console.log('Auth callback - checking session...');
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        console.log('Auth callback - session found, redirecting to home');
        router.replace('/(tabs)/(home)');
      } else {
        console.log('Auth callback - no session, redirecting to auth');
        router.replace('/auth');
      }
    } catch (error) {
      console.error('Auth callback error:', error);
      router.replace('/auth');
    }
  }, [router]);

  useEffect(() => {
    handleAuthCallback();
  }, [handleAuthCallback]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#FF6B9D" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
});
