
import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { useRouter } from 'expo-router';

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (placeId: string | null, placeName: string | null, keywords: string | null) => void;
  onClear: () => void;
  initialPlaceId: string | null;
  initialPlaceName: string | null;
  initialKeywords: string | null;
}

export function FilterModal({
  visible,
  onClose,
  onApply,
  onClear,
  initialPlaceId,
  initialPlaceName,
  initialKeywords,
}: FilterModalProps) {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const bgColor = isDark ? colors.backgroundDark : colors.background;
  const textColor = isDark ? colors.textDark : colors.text;
  const textSecondaryColor = isDark ? colors.textSecondaryDark : colors.textSecondary;
  const cardColor = isDark ? colors.cardDark : colors.card;
  const primaryColor = isDark ? colors.primaryDark : colors.primary;
  const borderColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(initialPlaceId);
  const [selectedPlaceName, setSelectedPlaceName] = useState<string | null>(initialPlaceName);
  const [keywordsInput, setKeywordsInput] = useState<string>(initialKeywords || '');

  useEffect(() => {
    if (visible) {
      setSelectedPlaceId(initialPlaceId);
      setSelectedPlaceName(initialPlaceName);
      setKeywordsInput(initialKeywords || '');
    }
  }, [visible, initialPlaceId, initialPlaceName, initialKeywords]);

  const handleLocationPress = () => {
    console.log('User tapped location field, navigating to search-location');
    onClose();
    router.push({
      pathname: '/search-location',
      params: { 
        returnTo: 'home-filter',
        currentPlaceId: selectedPlaceId || '',
        currentPlaceName: selectedPlaceName || '',
      },
    });
  };

  const handleApply = () => {
    console.log('User tapped Apply Filters button');
    const keywords = keywordsInput.trim() || null;
    onApply(selectedPlaceId, selectedPlaceName, keywords);
  };

  const handleClear = () => {
    console.log('User tapped Clear Filters button');
    setSelectedPlaceId(null);
    setSelectedPlaceName(null);
    setKeywordsInput('');
    onClear();
  };

  const locationDisplayText = selectedPlaceName || 'Select location';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={[styles.modalContent, { backgroundColor: cardColor }]}>
          <View style={[styles.modalHeader, { borderBottomColor: borderColor }]}>
            <Text style={[styles.modalTitle, { color: textColor }]}>Filter Videos</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <IconSymbol
                ios_icon_name="xmark"
                android_material_icon_name="close"
                size={24}
                color={textColor}
              />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            <View style={styles.filterSection}>
              <Text style={[styles.filterLabel, { color: textColor }]}>Location</Text>
              <TouchableOpacity
                style={[styles.locationInput, { backgroundColor: bgColor, borderColor }]}
                onPress={handleLocationPress}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.locationText,
                    { color: selectedPlaceName ? textColor : textSecondaryColor },
                  ]}
                  numberOfLines={1}
                >
                  {locationDisplayText}
                </Text>
                <IconSymbol
                  ios_icon_name="chevron.right"
                  android_material_icon_name="chevron-right"
                  size={20}
                  color={textSecondaryColor}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.filterSection}>
              <Text style={[styles.filterLabel, { color: textColor }]}>Keywords</Text>
              <TextInput
                style={[
                  styles.keywordsInput,
                  { backgroundColor: bgColor, borderColor, color: textColor },
                ]}
                placeholder="Enter keywords (space or comma separated)"
                placeholderTextColor={textSecondaryColor}
                value={keywordsInput}
                onChangeText={setKeywordsInput}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
              <Text style={[styles.helperText, { color: textSecondaryColor }]}>
                Search across captions and locations
              </Text>
            </View>
          </ScrollView>

          <View style={[styles.modalFooter, { borderTopColor: borderColor }]}>
            <TouchableOpacity
              style={[styles.clearButton, { borderColor }]}
              onPress={handleClear}
              activeOpacity={0.7}
            >
              <Text style={[styles.clearButtonText, { color: textColor }]}>Clear Filters</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.applyButton, { backgroundColor: primaryColor }]}
              onPress={handleApply}
              activeOpacity={0.7}
            >
              <Text style={styles.applyButtonText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  filterSection: {
    marginBottom: 24,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  locationInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  locationText: {
    fontSize: 16,
    flex: 1,
  },
  keywordsInput: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 80,
  },
  helperText: {
    fontSize: 13,
    marginTop: 6,
  },
  modalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  clearButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  applyButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
