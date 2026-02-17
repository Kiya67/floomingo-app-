
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal as RNModal, useColorScheme } from 'react-native';
import { colors } from '@/styles/commonStyles';

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  confirmColor?: string;
  type?: 'success' | 'error' | 'info';
  secondaryAction?: {
    label: string;
    onPress: () => void;
  };
  children?: React.ReactNode;
}

export function Modal({
  visible,
  onClose,
  title,
  message,
  confirmText = 'OK',
  cancelText = 'Cancel',
  onConfirm,
  confirmColor,
  type = 'info',
  secondaryAction,
  children,
}: ModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const bgColor = isDark ? colors.backgroundDark : colors.background;
  const textColor = isDark ? colors.textDark : colors.text;
  const textSecondaryColor = isDark ? colors.textSecondaryDark : colors.textSecondary;
  const cardColor = isDark ? colors.cardDark : colors.card;
  const primaryColor = isDark ? colors.primaryDark : colors.primary;

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    } else {
      onClose();
    }
  };

  const getConfirmColor = () => {
    if (confirmColor) return confirmColor;
    if (type === 'error') return '#FF3B30';
    if (type === 'success') return '#34C759';
    return primaryColor;
  };

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.content, { backgroundColor: cardColor }]}>
          <Text style={[styles.title, { color: textColor }]}>{title}</Text>
          
          {message && (
            <Text style={[styles.message, { color: textSecondaryColor }]}>
              {message}
            </Text>
          )}
          
          {children}
          
          <View style={styles.buttons}>
            {onConfirm && (
              <TouchableOpacity
                style={[styles.button, { backgroundColor: isDark ? '#444' : '#E0E0E0' }]}
                onPress={onClose}
                activeOpacity={0.8}
              >
                <Text style={[styles.buttonText, { color: textColor }]}>{cancelText}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.button,
                { backgroundColor: getConfirmColor() },
                !onConfirm && !secondaryAction && { flex: 1 }
              ]}
              onPress={handleConfirm}
              activeOpacity={0.8}
            >
              <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>{confirmText}</Text>
            </TouchableOpacity>
            {secondaryAction && (
              <TouchableOpacity
                style={[styles.button, { backgroundColor: primaryColor }]}
                onPress={() => {
                  secondaryAction.onPress();
                  onClose();
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>{secondaryAction.label}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 12,
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    marginBottom: 20,
    lineHeight: 22,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default Modal;
