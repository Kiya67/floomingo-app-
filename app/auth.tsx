
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  useColorScheme,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AuthScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');

  const handleAuth = async () => {
    console.log('User tapped auth button', { isSignUp, email });
    
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (isSignUp && !fullName) {
      Alert.alert('Error', 'Please enter your full name');
      return;
    }

    setLoading(true);

    try {
      if (isSignUp) {
        console.log('Attempting sign up with email:', email);
        
        // Sign up the user
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (authError) {
          console.error('Sign up error:', authError);
          Alert.alert('Sign Up Error', authError.message);
          setLoading(false);
          return;
        }

        console.log('Sign up successful, creating profile');

        // Create profile in profiles table
        if (authData.user) {
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: authData.user.id,
              email: email,
              full_name: fullName,
              username: username || null,
              bio: bio || null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });

          if (profileError) {
            console.error('Profile creation error:', profileError);
            Alert.alert('Profile Error', profileError.message);
          } else {
            console.log('Profile created successfully');
            Alert.alert('Success', 'Account created! Please check your email to verify your account.');
            // Clear form and switch to sign in
            setEmail('');
            setPassword('');
            setFullName('');
            setUsername('');
            setBio('');
            setIsSignUp(false);
          }
        }
      } else {
        console.log('Attempting sign in with email:', email);
        
        // Sign in the user
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          console.error('Sign in error:', error);
          Alert.alert('Sign In Error', error.message);
        } else {
          console.log('Sign in successful');
          Alert.alert('Success', 'You are now signed in!');
        }
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      Alert.alert('Error', error.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    console.log('Toggling auth mode from', isSignUp ? 'sign up' : 'sign in');
    setIsSignUp(!isSignUp);
  };

  const modeText = isSignUp ? 'Sign Up' : 'Sign In';
  const switchText = isSignUp ? 'Already have an account?' : "Don't have an account?";
  const switchActionText = isSignUp ? 'Sign In' : 'Sign Up';

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient
        colors={isDark ? ['#000000', '#1a0a0a', '#2d0d0d'] : ['#FFB6C1', '#FFA07A', '#FF8C69', '#FF7F50']}
        style={styles.gradient}
      >
        <SafeAreaView style={styles.safeArea}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
          >
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.content}>
                <View style={styles.header}>
                  <Text style={[styles.title, isDark && styles.titleDark]}>
                    {modeText}
                  </Text>
                  <Text style={[styles.subtitle, isDark && styles.subtitleDark]}>
                    {isSignUp ? 'Create your travel account' : 'Welcome back, traveler'}
                  </Text>
                </View>

                <View style={styles.form}>
                  {isSignUp && (
                    <View style={styles.inputContainer}>
                      <Text style={[styles.label, isDark && styles.labelDark]}>
                        Full Name
                      </Text>
                      <TextInput
                        style={[styles.input, isDark && styles.inputDark]}
                        placeholder="John Doe"
                        placeholderTextColor={isDark ? '#999' : '#666'}
                        value={fullName}
                        onChangeText={setFullName}
                        autoCapitalize="words"
                      />
                    </View>
                  )}

                  {isSignUp && (
                    <View style={styles.inputContainer}>
                      <Text style={[styles.label, isDark && styles.labelDark]}>
                        Username (optional)
                      </Text>
                      <TextInput
                        style={[styles.input, isDark && styles.inputDark]}
                        placeholder="johndoe"
                        placeholderTextColor={isDark ? '#999' : '#666'}
                        value={username}
                        onChangeText={setUsername}
                        autoCapitalize="none"
                      />
                    </View>
                  )}

                  <View style={styles.inputContainer}>
                    <Text style={[styles.label, isDark && styles.labelDark]}>
                      Email
                    </Text>
                    <TextInput
                      style={[styles.input, isDark && styles.inputDark]}
                      placeholder="you@example.com"
                      placeholderTextColor={isDark ? '#999' : '#666'}
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      autoComplete="email"
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={[styles.label, isDark && styles.labelDark]}>
                      Password
                    </Text>
                    <TextInput
                      style={[styles.input, isDark && styles.inputDark]}
                      placeholder="••••••••"
                      placeholderTextColor={isDark ? '#999' : '#666'}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                      autoCapitalize="none"
                      autoComplete="password"
                    />
                  </View>

                  {isSignUp && (
                    <View style={styles.inputContainer}>
                      <Text style={[styles.label, isDark && styles.labelDark]}>
                        Bio (optional)
                      </Text>
                      <TextInput
                        style={[styles.input, styles.textArea, isDark && styles.inputDark]}
                        placeholder="Tell us about yourself..."
                        placeholderTextColor={isDark ? '#999' : '#666'}
                        value={bio}
                        onChangeText={setBio}
                        multiline
                        numberOfLines={3}
                      />
                    </View>
                  )}

                  <TouchableOpacity
                    style={[styles.button, loading && styles.buttonDisabled]}
                    onPress={handleAuth}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.buttonText}>{modeText}</Text>
                    )}
                  </TouchableOpacity>

                  <View style={styles.switchContainer}>
                    <Text style={[styles.switchText, isDark && styles.switchTextDark]}>
                      {switchText}
                    </Text>
                    <TouchableOpacity onPress={toggleMode}>
                      <Text style={[styles.switchAction, isDark && styles.switchActionDark]}>
                        {switchActionText}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </LinearGradient>
    </>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  header: {
    marginBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  titleDark: {
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.9,
    textAlign: 'center',
  },
  subtitleDark: {
    color: '#FFFFFF',
    opacity: 0.8,
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  labelDark: {
    color: '#FFFFFF',
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1A1A1A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  inputDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: '#FFFFFF',
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    gap: 8,
  },
  switchText: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  switchTextDark: {
    color: '#FFFFFF',
    opacity: 0.8,
  },
  switchAction: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textDecorationLine: 'underline',
  },
  switchActionDark: {
    color: '#FFFFFF',
  },
});
