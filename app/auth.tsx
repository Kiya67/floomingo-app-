
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { Modal } from "@/components/ui/Modal";

type Mode = "signin" | "signup";

const APP_VERSION = "1.0.2";

export default function AuthScreen() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const checkUser = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      console.log('AuthScreen - checkUser - session:', !!session);
      if (session) {
        console.log('User already authenticated, redirecting to home...');
        router.replace("/(tabs)/(home)");
      }
    } catch (error) {
      console.error('Error checking user:', error);
    }
  }, [router]);

  // Check if user is already authenticated
  useEffect(() => {
    checkUser();
  }, [checkUser]);

  const showError = (message: string) => {
    console.log('Showing error modal:', message);
    setErrorMessage(message || "An error occurred");
    setErrorModalVisible(true);
  };

  const handleSignIn = async () => {
    if (!email || !password) {
      showError("Please enter email and password");
      return;
    }

    setLoading(true);
    console.log('Signing in with Supabase...');
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        console.error('Sign in error:', error);
        showError(error.message);
        return;
      }

      console.log('Sign in successful, user:', data.user?.email);
      
      // Wait a moment for session to be established
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Navigate to home
      router.replace("/(tabs)/(home)");
    } catch (error: any) {
      console.error('Sign in exception:', error);
      showError(error.message || "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!email || !password) {
      showError("Please enter email and password");
      return;
    }

    if (password.length < 6) {
      showError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    console.log('Signing up with Supabase...');
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            display_name: name || email.split('@')[0],
          },
        },
      });

      if (error) {
        console.error('Sign up error:', error);
        showError(error.message);
        return;
      }

      console.log('Sign up successful, user:', data.user?.email);

      // Create profile in profiles table
      if (data.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            email: data.user.email,
            display_name: name || email.split('@')[0],
          });

        if (profileError) {
          console.error('Profile creation error:', profileError);
        }
      }

      // Wait a moment for session to be established
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Navigate to home
      router.replace("/(tabs)/(home)");
    } catch (error: any) {
      console.error('Sign up exception:', error);
      showError(error.message || "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={['#FF6B9D', '#FFA06B']}
      style={styles.container}
    >
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            <Text style={styles.title}>
              {mode === "signin" ? "Sign In" : "Sign Up"}
            </Text>

            <Text style={styles.versionText}>v{APP_VERSION}</Text>

            {mode === "signup" && (
              <TextInput
                style={styles.input}
                placeholder="Name (optional)"
                placeholderTextColor="rgba(255, 255, 255, 0.7)"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            )}

            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="rgba(255, 255, 255, 0.7)"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="rgba(255, 255, 255, 0.7)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={mode === "signin" ? handleSignIn : handleSignUp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FF6B9D" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {mode === "signin" ? "Sign In" : "Sign Up"}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchModeButton}
              onPress={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              <Text style={styles.switchModeText}>
                {mode === "signin"
                  ? "Don't have an account? Sign Up"
                  : "Already have an account? Sign In"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={errorModalVisible}
        onClose={() => setErrorModalVisible(false)}
        title="Error"
        message={errorMessage}
        onConfirm={() => setErrorModalVisible(false)}
        confirmText="OK"
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
    color: "#fff",
  },
  versionText: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.6)",
    textAlign: "center",
    marginBottom: 24,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
    fontSize: 16,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    color: "#fff",
  },
  primaryButton: {
    height: 50,
    backgroundColor: "#fff",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  primaryButtonText: {
    color: "#FF6B9D",
    fontSize: 16,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  switchModeButton: {
    marginTop: 16,
    alignItems: "center",
  },
  switchModeText: {
    color: "#fff",
    fontSize: 14,
  },
});
