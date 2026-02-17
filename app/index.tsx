
import { Redirect } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';

export default function Index() {
  const { session, loading } = useSupabaseAuth();

  console.log('Index - session:', !!session, 'loading:', loading);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B9D" />
      </View>
    );
  }

  if (session) {
    console.log('Index - User authenticated, redirecting to home tabs');
    return <Redirect href="/(tabs)/(home)" />;
  }

  console.log('Index - No session, redirecting to auth');
  return <Redirect href="/auth" />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
});
