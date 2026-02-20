
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Animated, useColorScheme, Dimensions } from 'react-native';
import { colors } from '@/styles/commonStyles';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface OnboardingTooltipProps {
  visible: boolean;
  onDismiss: () => void;
  targetPosition?: { x: number; y: number };
}

const STORAGE_KEY = 'home_filter_tip_seen';

export function OnboardingTooltip({ visible, onDismiss, targetPosition }: OnboardingTooltipProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  const bgColor = isDark ? colors.backgroundDark : colors.background;
  const textColor = isDark ? colors.textDark : colors.text;
  const primaryColor = isDark ? colors.primaryDark : colors.primary;

  useEffect(() => {
    if (visible) {
      console.log('OnboardingTooltip - Showing tooltip');
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.8);
    }
  }, [visible]);

  const handleDismiss = async () => {
    console.log('OnboardingTooltip - User tapped OK, dismissing tooltip');
    try {
      await AsyncStorage.setItem(STORAGE_KEY, 'true');
      console.log('OnboardingTooltip - Stored flag to prevent future displays');
    } catch (error) {
      console.error('OnboardingTooltip - Error storing flag:', error);
    }
    onDismiss();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleDismiss}
    >
      <TouchableOpacity 
        style={styles.overlay} 
        activeOpacity={1}
        onPress={handleDismiss}
      >
        <Animated.View 
          style={[
            styles.tooltipContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View style={[styles.tooltip, { backgroundColor: bgColor }]}>
            <View style={[styles.arrow, { backgroundColor: bgColor }]} />
            
            <Text style={[styles.tooltipText, { color: textColor }]}>
              Use the Filter button to choose what content you want to see.
            </Text>
            
            <TouchableOpacity
              style={[styles.okButton, { backgroundColor: primaryColor }]}
              onPress={handleDismiss}
              activeOpacity={0.8}
            >
              <Text style={styles.okButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

export async function shouldShowOnboardingTooltip(): Promise<boolean> {
  try {
    const tipSeen = await AsyncStorage.getItem(STORAGE_KEY);
    const didCompleteSignup = await AsyncStorage.getItem('didCompleteSignup');
    
    console.log('OnboardingTooltip - Check flags:', { tipSeen, didCompleteSignup });
    
    // Show if user just signed up AND hasn't seen the tip yet
    return didCompleteSignup === 'true' && tipSeen !== 'true';
  } catch (error) {
    console.error('OnboardingTooltip - Error checking flags:', error);
    return false;
  }
}

export async function markSignupComplete(): Promise<void> {
  try {
    await AsyncStorage.setItem('didCompleteSignup', 'true');
    console.log('OnboardingTooltip - Marked signup as complete');
  } catch (error) {
    console.error('OnboardingTooltip - Error marking signup complete:', error);
  }
}

export async function clearOnboardingFlags(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
    await AsyncStorage.removeItem('didCompleteSignup');
    console.log('OnboardingTooltip - Cleared all onboarding flags');
  } catch (error) {
    console.error('OnboardingTooltip - Error clearing flags:', error);
  }
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 100,
    paddingRight: 20,
  },
  tooltipContainer: {
    maxWidth: 280,
  },
  tooltip: {
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  arrow: {
    position: 'absolute',
    top: -8,
    right: 30,
    width: 16,
    height: 16,
    transform: [{ rotate: '45deg' }],
  },
  tooltipText: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 16,
  },
  okButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  okButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
