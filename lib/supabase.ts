
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey;

console.log('[Supabase] Initializing client');
console.log('[Supabase] URL:', supabaseUrl || '⚠️ MISSING');
console.log('[Supabase] Anon key present:', !!supabaseAnonKey);
console.log('[Supabase] Anon key prefix:', supabaseAnonKey ? String(supabaseAnonKey).slice(0, 20) + '...' : 'MISSING');

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase URL or Anon Key in app.json');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Important for React Native
  },
});
