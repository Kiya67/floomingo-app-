
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { supabase } from '@/lib/supabase';
import Constants from 'expo-constants';

interface Prediction {
  place_id: string;
  main_text: string;
  secondary_text?: string;
  description: string;
  location_type: string;
}

type SearchMode = 'any' | 'city' | 'place' | 'country' | 'region' | 'address' | 'airport';

const SEARCH_MODE_OPTIONS: { value: SearchMode; label: string }[] = [
  { value: 'any', label: 'All (recommended)' },
  { value: 'city', label: 'Cities' },
  { value: 'place', label: 'Places (businesses/landmarks)' },
  { value: 'country', label: 'Countries' },
  { value: 'region', label: 'Regions/States' },
  { value: 'address', label: 'Addresses' },
  { value: 'airport', label: 'Airports' },
];

export default function SearchLocationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const bgColor = isDark ? colors.backgroundDark : colors.background;
  const textColor = isDark ? colors.textDark : colors.text;
  const textSecondaryColor = isDark ? colors.textSecondaryDark : colors.textSecondary;
  const cardColor = isDark ? colors.cardDark : colors.card;
  const primaryColor = isDark ? colors.primaryDark : colors.primary;

  const [searchText, setSearchText] = useState('');
  const [mode, setMode] = useState<SearchMode>('any');
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchLocations = useCallback(async (input: string, searchMode: SearchMode) => {
    if (!input.trim()) {
      setPredictions([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    console.log('Searching locations with input:', input, 'mode:', searchMode);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl;
      const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey;

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase configuration missing');
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey,
      };

      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const body = {
        input: input.trim(),
        mode: searchMode,
      };

      console.log('API request to:', `${supabaseUrl}/functions/v1/places_autocomplete`);
      console.log('API request body:', body);

      const response = await fetch(
        `${supabaseUrl}/functions/v1/places_autocomplete`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        }
      );

      console.log('API response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error response:', errorText);
        throw new Error(`API returned ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('API response data:', data);

      if (data.error) {
        console.error('API returned error:', data.error);
        setError(data.error);
        setPredictions([]);
      } else if (data.predictions && Array.isArray(data.predictions)) {
        console.log('Found', data.predictions.length, 'predictions');
        setPredictions(data.predictions);
        if (data.predictions.length === 0) {
          setError('No locations found. Try a different search term.');
        }
      } else {
        console.warn('Unexpected API response format:', data);
        setPredictions([]);
        setError('Unexpected response format from location service');
      }
    } catch (error: any) {
      console.error('Error searching locations:', error);
      setError(error.message || 'Failed to search locations. Please try again.');
      setPredictions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchText.trim()) {
        searchLocations(searchText, mode);
      } else {
        setPredictions([]);
        setLoading(false);
        setError(null);
      }
    }, 300);

    return () => {
      clearTimeout(timeout);
    };
  }, [searchText, mode, searchLocations]);

  const handleSelectLocation = (prediction: Prediction) => {
    console.log('User selected location:', prediction);
    
    const placeName = prediction.main_text || prediction.description;
    const placeId = prediction.place_id;
    const locationType = prediction.location_type;
    const returnTo = (params.returnTo as string) || 'add';

    console.log('Navigating back with params:', {
      placeId,
      placeName,
      locationType,
      returnTo,
    });

    if (returnTo === 'home-filter') {
      router.push({
        pathname: '/(tabs)/(home)',
        params: {
          filterPlaceId: placeId,
          filterPlaceName: placeName,
          filterLocationType: locationType,
        },
      });
    } else {
      console.log('Navigating back to Add screen with location params');
      router.navigate({
        pathname: '/(tabs)/add',
        params: {
          selectedPlaceId: placeId,
          selectedPlaceName: placeName,
          selectedLocationType: locationType,
        },
      });
    }
  };

  const handleModeChange = (newMode: SearchMode) => {
    console.log('User changed mode to:', newMode);
    setMode(newMode);
    setShowDropdown(false);
  };

  const selectedModeLabel = SEARCH_MODE_OPTIONS.find(opt => opt.value === mode)?.label || 'All (recommended)';
  const searchPlaceholder = 'Search location...';
  const noResultsText = error || 'No results found';
  const startTypingText = 'Start typing to search for a location';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]} edges={['top']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Search Location',
          headerBackTitle: 'Back',
        }}
      />

      <View style={styles.content}>
        <View style={styles.dropdownSection}>
          <Text style={[styles.dropdownLabel, { color: textColor }]}>Search type</Text>
          <TouchableOpacity
            style={[styles.dropdownButton, { backgroundColor: cardColor, borderColor: isDark ? '#333' : '#E5E7EB' }]}
            onPress={() => setShowDropdown(!showDropdown)}
          >
            <Text style={[styles.dropdownButtonText, { color: textColor }]}>
              {selectedModeLabel}
            </Text>
            <IconSymbol
              android_material_icon_name={showDropdown ? "arrow-upward" : "arrow-downward"}
              size={20}
              color={textSecondaryColor}
            />
          </TouchableOpacity>

          {showDropdown && (
            <View style={[styles.dropdownMenu, { backgroundColor: cardColor, borderColor: isDark ? '#333' : '#E5E7EB' }]}>
              <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
                {SEARCH_MODE_OPTIONS.map((option, index) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.dropdownItem,
                      mode === option.value && { backgroundColor: isDark ? '#333' : '#F3F4F6' },
                      index < SEARCH_MODE_OPTIONS.length - 1 && { borderBottomWidth: 1, borderBottomColor: isDark ? '#333' : '#E5E7EB' },
                    ]}
                    onPress={() => handleModeChange(option.value)}
                  >
                    <Text style={[
                      styles.dropdownItemText,
                      { color: mode === option.value ? primaryColor : textColor }
                    ]}>
                      {option.label}
                    </Text>
                    {mode === option.value && (
                      <IconSymbol
                        android_material_icon_name="check"
                        size={20}
                        color={primaryColor}
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        <View style={[styles.searchContainer, { backgroundColor: cardColor, borderColor: isDark ? '#333' : '#E5E7EB' }]}>
          <IconSymbol
            android_material_icon_name="search"
            size={20}
            color={textSecondaryColor}
          />
          <TextInput
            style={[styles.searchInput, { color: textColor }]}
            placeholder={searchPlaceholder}
            placeholderTextColor={textSecondaryColor}
            value={searchText}
            onChangeText={setSearchText}
            autoFocus
            autoCapitalize="words"
            autoCorrect={false}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText('')}>
              <IconSymbol
                android_material_icon_name="close"
                size={20}
                color={textSecondaryColor}
              />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView style={styles.resultsList} showsVerticalScrollIndicator={false}>
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={primaryColor} />
              <Text style={[styles.loadingText, { color: textSecondaryColor }]}>
                Searching locations...
              </Text>
            </View>
          )}

          {!loading && searchText.trim() === '' && (
            <View style={styles.emptyContainer}>
              <IconSymbol
                android_material_icon_name="location-on"
                size={48}
                color={textSecondaryColor}
              />
              <Text style={[styles.emptyText, { color: textSecondaryColor }]}>
                {startTypingText}
              </Text>
            </View>
          )}

          {!loading && searchText.trim() !== '' && predictions.length === 0 && (
            <View style={styles.emptyContainer}>
              <IconSymbol
                android_material_icon_name={error ? "error" : "search"}
                size={48}
                color={error ? '#EF4444' : textSecondaryColor}
              />
              <Text style={[styles.emptyText, { color: error ? '#EF4444' : textSecondaryColor }]}>
                {noResultsText}
              </Text>
            </View>
          )}

          {!loading &&
            predictions.map((prediction, index) => {
              const mainText = prediction.main_text || prediction.description;
              const secondaryText = prediction.secondary_text || prediction.description;
              
              return (
                <TouchableOpacity
                  key={`${prediction.place_id}-${index}`}
                  style={[styles.resultItem, { backgroundColor: cardColor }]}
                  onPress={() => handleSelectLocation(prediction)}
                >
                  <IconSymbol
                    android_material_icon_name="location-on"
                    size={24}
                    color={primaryColor}
                  />
                  <View style={styles.resultTextContainer}>
                    <Text style={[styles.resultMainText, { color: textColor }]}>
                      {mainText}
                    </Text>
                    {secondaryText && secondaryText !== mainText && (
                      <Text style={[styles.resultSecondaryText, { color: textSecondaryColor }]}>
                        {secondaryText}
                      </Text>
                    )}
                  </View>
                  <IconSymbol
                    android_material_icon_name="arrow-forward"
                    size={20}
                    color={textSecondaryColor}
                  />
                </TouchableOpacity>
              );
            })}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  dropdownSection: {
    marginBottom: 16,
  },
  dropdownLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  dropdownButtonText: {
    fontSize: 16,
    flex: 1,
  },
  dropdownMenu: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    maxHeight: 250,
    overflow: 'hidden',
  },
  dropdownScroll: {
    maxHeight: 250,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dropdownItemText: {
    fontSize: 15,
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 4,
  },
  resultsList: {
    flex: 1,
    marginTop: 16,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  resultTextContainer: {
    flex: 1,
    gap: 4,
  },
  resultMainText: {
    fontSize: 16,
    fontWeight: '600',
  },
  resultSecondaryText: {
    fontSize: 14,
  },
});
