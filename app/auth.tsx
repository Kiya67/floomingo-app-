
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "expo-router";

type Mode = "signin" | "signup";

export default function AuthScreen() {
  const router = useRouter();
  const { user, signInWithEmail, signUpWithEmail, signInWithGoogle, signInWithApple, signInWithGitHub, loading: authLoading } =
    useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  // Redirect to home if user is already authenticated
  useEffect(() => {
    if (user && !authLoading) {
      console.log('User authenticated, redirecting to home...');
      router.replace("/(tabs)/(home)");
    }
  }, [user, authLoading]);

  if (authLoading) {
    return (
      <LinearGradient
        colors={['#FF6B9D', '#FFA06B']}
        style={styles.loadingContainer}
      >
        <ActivityIndicator size="large" color="#fff" />
      </LinearGradient>
    );
  }

  const handleEmailAuth = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter email and password");
      return;
    }

    setLoading(true);
    try {
      if (mode === "signin") {
        console.log('Signing in with email...');
        await signInWithEmail(email, password);
        console.log('Sign in successful');
        // Don't manually redirect - useEffect will handle it when user state updates
      } else {
        console.log('Signing up with email...');
        await signUpWithEmail(email, password, name);
        console.log('Sign up successful');
        Alert.alert(
          "Success",
          "Account created successfully!"
        );
        // Don't manually redirect - useEffect will handle it when user state updates
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      Alert.alert("Error", error.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSocialAuth = async (provider: "google" | "apple" | "github") => {
    setLoading(true);
    try {
      console.log(`Signing in with ${provider}...`);
      if (provider === "google") {
        await signInWithGoogle();
      } else if (provider === "apple") {
        await signInWithApple();
      } else if (provider === "github") {
        await signInWithGitHub();
      }
      console.log(`${provider} sign in successful`);
      // Don't manually redirect - useEffect will handle it when user state updates
    } catch (error: any) {
      console.error(`${provider} auth error:`, error);
      Alert.alert("Error", error.message || "Authentication failed");
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
              onPress={handleEmailAuth}
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

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={styles.socialButton}
              onPress={() => handleSocialAuth("google")}
              disabled={loading}
            >
              <Text style={styles.socialButtonText}>Continue with Google</Text>
            </TouchableOpacity>

            {Platform.OS === "ios" && (
              <TouchableOpacity
                style={[styles.socialButton, styles.appleButton]}
                onPress={() => handleSocialAuth("apple")}
                disabled={loading}
              >
                <Text style={[styles.socialButtonText, styles.appleButtonText]}>
                  Continue with Apple
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
    marginBottom: 32,
    textAlign: "center",
    color: "#fff",
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
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
  dividerText: {
    marginHorizontal: 12,
    color: "#fff",
    fontSize: 14,
  },
  socialButton: {
    height: 50,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  socialButtonText: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "500",
  },
  appleButton: {
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  appleButtonText: {
    color: "#fff",
  },
});
