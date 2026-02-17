
import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, useColorScheme, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { supabase } from '@/lib/supabase';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CreateBoardScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const bgColor = isDark ? colors.backgroundDark : colors.background;
  const textColor = isDark ? colors.textDark : colors.text;
  const textSecondaryColor = isDark ? colors.textSecondaryDark : colors.textSecondary;
  const primaryColor = isDark ? colors.primaryDark : colors.primary;

  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);

  const handleBack = () => {
    console.log('User tapped back button');
    router.back();
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a trip name');
      return;
    }

    console.log('Creating new board:', title);
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in to create a trip');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('boards')
        .insert({
          user_id: user.id,
          title: title.trim(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating board:', error);
        Alert.alert('Error', 'Could not create trip');
      } else {
        console.log('Board created successfully:', data.id);
        router.back();
      }
    } catch (error) {
      console.error('Error in handleCreate:', error);
      Alert.alert('Error', 'Could not create trip');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={[styles.header, { backgroundColor: bgColor }]}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={handleBack}
          activeOpacity={0.7}
        >
          <IconSymbol 
            android_material_icon_name="close" 
            size={24} 
            color={textColor}
          />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textColor }]}>New Trip</Text>
        <View style={styles.headerButton} />
      </View>

      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.form}>
          <Text style={[styles.label, { color: textColor }]}>Trip Name</Text>
          <TextInput
            style={[styles.input, { color: textColor, borderColor: isDark ? '#444' : '#DDD', backgroundColor: isDark ? '#222' : '#F5F5F5' }]}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g., Summer 2024, Tokyo Adventure"
            placeholderTextColor={textSecondaryColor}
            autoFocus
            maxLength={100}
          />
          <Text style={[styles.hint, { color: textSecondaryColor }]}>
            Give your trip a memorable name
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.createButton, { backgroundColor: primaryColor, opacity: loading || !title.trim() ? 0.5 : 1 }]}
          onPress={handleCreate}
          disabled={loading || !title.trim()}
          activeOpacity={0.8}
        >
          <Text style={styles.createButtonText}>
            {loading ? 'Creating...' : 'Create Trip'}
          </Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  headerButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  form: {
    flex: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 8,
  },
  hint: {
    fontSize: 14,
  },
  createButton: {
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
