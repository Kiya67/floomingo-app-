
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
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';

interface Prediction {
  place_id: string;
  main_text: string;
  description: string;
  location_type: 'city' | 'place';
}

type SearchMode = 'city' | 'place';

export default function SearchLocationScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const bgColor = isDark ? colors.backgroundDark : colors.background;
  const textColor = isDark ? colors.textDark : colors.text;
  const textSecondaryColor = isDark ? colors.textSecondaryDark : colors.textSecondary;
  const cardColor = isDark ? colors.cardDark : colors.card;
  const primaryColor = isDark ? colors.primaryDark : colors.primary;

  const [searchText, setSearchText] = useState('');
  const [mode, setMode] = useState<SearchMode>('city');
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [debounceTimeout, setDebounceTimeout] = useState<NodeJS.Timeout | null>(null);

  const searchLocations = useCallback(async (input: string, searchMode: SearchMode) => {
    if (!input.trim()) {
      setPredictions([]);
      return;
    }

    setLoading(true);
    console.log('Searching locations with input:', input, 'mode:', searchMode);

    try {
      const autocompleteResponse = await fetch(
        'https://ilobeaszwnfbwebemmji.supabase.co/functions/v1/places_autocomplete',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            input: input,
            mode: searchMode,
            country: 'us',
          }),
        }
      );

      const autocompleteData = await autocompleteResponse.json();
      console.log('Autocomplete response:', autocompleteData);

      if (autocompleteData.predictions && autocompleteData.predictions.length > 0) {
        setPredictions(autocompleteData.predictions);
      } else {
        console.log('No autocomplete results, trying fallback search');
        
        const fallbackResponse = await fetch(
          'https://ilobeaszwnfbwebemmji.supabase.co/functions/v1/places-search',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              input: input,
              country: 'us',
            }),
          }
        );

        const fallbackData = await fallbackResponse.json();
        console.log('Fallback search response:', fallbackData);

        if (fallbackData.results && fallbackData.results.length > 0) {
          setPredictions(fallbackData.results);
        } else {
          setPredictions([]);
        }
      }
    } catch (error) {
      console.error('Error searching locations:', error);
      setPredictions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }

    if (searchText.trim()) {
      const timeout = setTimeout(() => {
        searchLocations(searchText, mode);
      }, 300);
      setDebounceTimeout(timeout);
    } else {
      setPredictions([]);
      setLoading(false);
    }

    return () => {
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
    };
  }, [searchText, mode]);

  const handleSelectLocation = (prediction: Prediction) => {
    console.log('User selected location:', prediction);
    
    router.back();
    
    if (router.canGoBack()) {
      router.setParams({
        selectedPlaceId: prediction.place_id,
        selectedPlaceName: prediction.main_text || prediction.description,
        selectedLocationType: prediction.location_type,
      });
    }
  };

  const handleModeChange = (newMode: SearchMode) => {
    console.log('User changed mode to:', newMode);
    setMode(newMode);
  };

  const searchPlaceholder = 'Search city or place...';
  const citiesLabel = 'Cities';
  const placesLabel = 'Places';
  const noResultsText = 'No results found';
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
        <View style={[styles.searchContainer, { backgroundColor: cardColor }]}>
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

        <View style={styles.segmentedControl}>
          <TouchableOpacity
            style={[
              styles.segmentButton,
              mode === 'city' && { backgroundColor: primaryColor },
              mode !== 'city' && { backgroundColor: cardColor },
            ]}
            onPress={() => handleModeChange('city')}
          >
            <Text
              style={[
                styles.segmentText,
                mode === 'city' ? { color: '#FFFFFF' } : { color: textColor },
              ]}
            >
              {citiesLabel}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.segmentButton,
              mode === 'place' && { backgroundColor: primaryColor },
              mode !== 'place' && { backgroundColor: cardColor },
            ]}
            onPress={() => handleModeChange('place')}
          >
            <Text
              style={[
                styles.segmentText,
                mode === 'place' ? { color: '#FFFFFF' } : { color: textColor },
              ]}
            >
              {placesLabel}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.resultsList} showsVerticalScrollIndicator={false}>
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={primaryColor} />
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
                android_material_icon_name="search"
                size={48}
                color={textSecondaryColor}
              />
              <Text style={[styles.emptyText, { color: textSecondaryColor }]}>
                {noResultsText}
              </Text>
            </View>
          )}

          {!loading &&
            predictions.map((prediction, index) => {
              const mainText = prediction.main_text || prediction.description;
              const secondaryText = prediction.description;
              
              return (
                <TouchableOpacity
                  key={index}
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 4,
  },
  segmentedControl: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 8,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentText: {
    fontSize: 15,
    fontWeight: '600',
  },
  resultsList: {
    flex: 1,
    marginTop: 16,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
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
