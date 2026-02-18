
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  useColorScheme,
  Platform,
  Alert,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { supabase } from '@/lib/supabase';
import * as ImagePicker from 'expo-image-picker';

interface Profile {
  id: string;
  email: string;
  display_name: string;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
}

export default function EditProfileScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  const bgColor = isDark ? colors.backgroundDark : colors.background;
  const textColor = isDark ? colors.textDark : colors.text;
  const textSecondaryColor = isDark ? colors.textSecondaryDark : colors.textSecondary;
  const cardColor = isDark ? colors.cardDark : colors.card;
  const primaryColor = isDark ? colors.primaryDark : colors.primary;

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    console.log('Fetching profile for edit');
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        console.log('No user found');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
      } else if (data) {
        console.log('Profile fetched:', data);
        setProfile(data);
        setDisplayName(data.display_name || '');
        setUsername(data.username || '');
        setBio(data.bio || '');
        setAvatarUrl(data.avatar_url);
        setCoverUrl(data.cover_url);
      }
    } catch (error) {
      console.error('Error in fetchProfile:', error);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async (type: 'avatar' | 'cover') => {
    console.log('User tapped pick image:', type);

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Please allow access to your photo library');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: type === 'avatar' ? [1, 1] : [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      console.log('Image selected:', result.assets[0].uri);
      await uploadImage(result.assets[0].uri, type);
    }
  };

  const uploadImage = async (uri: string, type: 'avatar' | 'cover') => {
    console.log('Uploading image:', type, uri);

    if (type === 'avatar') {
      setUploadingAvatar(true);
    } else {
      setUploadingCover(true);
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }

      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const bucket = type === 'avatar' ? 'avatars' : 'covers';

      const response = await fetch(uri);
      const blob = await response.blob();

      const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = reject;
        reader.readAsArrayBuffer(blob);
      });

      console.log('Uploading to Supabase storage:', bucket, fileName);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, arrayBuffer, {
          contentType: `image/${fileExt}`,
          upsert: true,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        Alert.alert('Upload Error', uploadError.message);
        return;
      }

      console.log('Upload successful:', uploadData);

      const { data: publicUrlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

      const publicUrl = publicUrlData.publicUrl;
      console.log('Public URL:', publicUrl);

      if (type === 'avatar') {
        setAvatarUrl(publicUrl);
      } else {
        setCoverUrl(publicUrl);
      }

      Alert.alert('Success', `${type === 'avatar' ? 'Profile' : 'Cover'} photo uploaded successfully`);
    } catch (error: any) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', error.message || 'Failed to upload image');
    } finally {
      if (type === 'avatar') {
        setUploadingAvatar(false);
      } else {
        setUploadingCover(false);
      }
    }
  };

  const handleSave = async () => {
    console.log('User tapped save profile');

    if (!displayName.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }

    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'User not authenticated');
        setSaving(false);
        return;
      }

      // CRITICAL: Check username availability before saving (exclude current user)
      if (username && username.trim()) {
        console.log('Checking username availability:', username);
        const { data: existingUsers, error: checkError } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', username.trim())
          .neq('id', user.id) // Exclude current user
          .limit(1);

        if (checkError) {
          console.error('Error checking username:', checkError);
          Alert.alert('Error', 'Failed to check username availability');
          setSaving(false);
          return;
        }

        if (existingUsers && existingUsers.length > 0) {
          console.log('Username already taken:', username);
          Alert.alert('Username Taken', 'This username is already taken. Please choose another username.');
          setSaving(false);
          return;
        }
      }

      console.log('Updating profile:', {
        display_name: displayName,
        username: username || null,
        bio: bio || null,
        avatar_url: avatarUrl,
        cover_url: coverUrl,
      });

      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName,
          username: username || null,
          bio: bio || null,
          avatar_url: avatarUrl,
          cover_url: coverUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) {
        console.error('Update error:', error);
        
        // Check for unique constraint violation (username already taken)
        if (error.code === '23505' || error.message.includes('duplicate key') || error.message.includes('unique constraint')) {
          Alert.alert('Username Taken', 'This username is already taken. Please choose another username.');
        } else {
          Alert.alert('Error', error.message);
        }
      } else {
        console.log('Profile updated successfully');
        Alert.alert('Success', 'Profile updated successfully');
        router.back();
      }
    } catch (error: any) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', error.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return 'U';
    const nameParts = name.split(' ');
    const firstInitial = nameParts[0]?.charAt(0) || '';
    const lastInitial = nameParts[1]?.charAt(0) || '';
    const initials = firstInitial + lastInitial;
    return initials.toUpperCase();
  };

  const initials = getInitials(displayName || 'U');

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]} edges={['top']}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Edit Profile',
            headerBackTitle: 'Back',
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={primaryColor} />
          <Text style={[styles.loadingText, { color: textColor }]}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]} edges={['top']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Edit Profile',
          headerBackTitle: 'Back',
        }}
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Cover Photo */}
        <View style={styles.coverContainer}>
          {coverUrl ? (
            <Image source={{ uri: coverUrl }} style={styles.coverImage} />
          ) : (
            <View style={[styles.coverPlaceholder, { backgroundColor: cardColor }]}>
              <IconSymbol
                android_material_icon_name="image"
                size={48}
                color={textSecondaryColor}
              />
            </View>
          )}
          <TouchableOpacity
            style={[styles.changeCoverButton, { backgroundColor: primaryColor }]}
            onPress={() => pickImage('cover')}
            disabled={uploadingCover}
          >
            {uploadingCover ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <IconSymbol
                  android_material_icon_name="camera"
                  size={20}
                  color="#FFFFFF"
                />
                <Text style={styles.changeCoverText}>Change Cover</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarContainer}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: primaryColor }]}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.changeAvatarButton, { backgroundColor: primaryColor }]}
              onPress={() => pickImage('avatar')}
              disabled={uploadingAvatar}
            >
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <IconSymbol
                  android_material_icon_name="camera"
                  size={20}
                  color="#FFFFFF"
                />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: textColor }]}>Name *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: cardColor, color: textColor }]}
              placeholder="Enter your name"
              placeholderTextColor={textSecondaryColor}
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: textColor }]}>Username</Text>
            <TextInput
              style={[styles.input, { backgroundColor: cardColor, color: textColor }]}
              placeholder="Enter your username"
              placeholderTextColor={textSecondaryColor}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: textColor }]}>Bio</Text>
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: cardColor, color: textColor }]}
              placeholder="Tell us about yourself..."
              placeholderTextColor={textSecondaryColor}
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: primaryColor }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
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
  coverContainer: {
    height: 200,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  changeCoverButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  changeCoverText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  avatarSection: {
    alignItems: 'center',
    marginTop: -50,
    marginBottom: 24,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: 'bold',
  },
  changeAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  form: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
  },
  textArea: {
    height: 100,
  },
  saveButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
