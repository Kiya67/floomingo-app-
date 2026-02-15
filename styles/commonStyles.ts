
import { StyleSheet } from 'react-native';

export const colors = {
  // Pink-themed color palette
  background: '#FFFFFF',
  backgroundDark: '#000000', // Pure black for dark mode
  
  text: '#1A1A1A',
  textDark: '#F5F5F5',
  
  textSecondary: '#6B7280',
  textSecondaryDark: '#9CA3AF',
  
  primary: '#FFB6C1', // Light pink
  primaryDark: '#FF69B4',
  
  secondary: '#FF7F50', // Coral orange
  secondaryDark: '#FF8C69',
  
  accent: '#FFA07A', // Light salmon
  accentDark: '#FFB399',
  
  card: '#FFF5F7',
  cardDark: '#1A1A1A', // Dark card background for black theme
  
  highlight: '#FFE4E1', // Misty rose highlight
  highlightDark: '#2A2A2A',
  
  border: '#FFD6E0',
  borderDark: '#333333',
  
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
};

export const commonStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 16,
  },
  body: {
    fontSize: 14,
  },
});
