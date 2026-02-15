
import { StyleSheet } from 'react-native';

export const colors = {
  // Travel-themed color palette - warm and inviting
  background: '#FFFFFF',
  backgroundDark: '#0F1419',
  
  text: '#1A1A1A',
  textDark: '#F5F5F5',
  
  textSecondary: '#6B7280',
  textSecondaryDark: '#9CA3AF',
  
  primary: '#FF6B35', // Vibrant sunset orange
  primaryDark: '#FF8C5A',
  
  secondary: '#00B4D8', // Ocean blue
  secondaryDark: '#48CAE4',
  
  accent: '#FFD23F', // Golden yellow
  accentDark: '#FFE066',
  
  card: '#F9FAFB',
  cardDark: '#1F2937',
  
  highlight: '#FEF3C7', // Soft yellow highlight
  highlightDark: '#374151',
  
  border: '#E5E7EB',
  borderDark: '#374151',
  
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
