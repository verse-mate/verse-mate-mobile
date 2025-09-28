import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useThemeColor } from '@/hooks/use-theme-color';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

export interface TestamentToggleProps {
  selectedTestament: 'old' | 'new';
  onTestamentChange: (testament: 'old' | 'new') => void;
  bookCounts?: { old: number; new: number };
  loading?: boolean;
}

export function TestamentToggle({
  selectedTestament,
  onTestamentChange,
  bookCounts,
  loading = false,
}: TestamentToggleProps) {
  const backgroundColor = useThemeColor({}, 'background');
  const borderColor = useThemeColor({}, 'icon');

  if (loading) {
    return (
      <ThemedView style={styles.container} testID="testament-toggle" pointerEvents="none">
        <ThemedView style={styles.loadingContainer} testID="testament-loading">
          <ThemedText>Loading...</ThemedText>
        </ThemedView>
      </ThemedView>
    );
  }

  const handleOldTestamentPress = () => {
    if (selectedTestament !== 'old') {
      onTestamentChange('old');
    }
  };

  const handleNewTestamentPress = () => {
    if (selectedTestament !== 'new') {
      onTestamentChange('new');
    }
  };

  return (
    <ThemedView style={styles.container} testID="testament-toggle">
      <View style={[styles.toggleContainer, { borderColor }]}>
        <TouchableOpacity
          style={[styles.toggleButton, selectedTestament === 'old' && styles.selectedButton]}
          onPress={handleOldTestamentPress}
          testID="testament-old"
          accessibilityLabel="Select Old Testament"
          accessibilityRole="button"
          accessibilityState={{ selected: selectedTestament === 'old' }}
        >
          <ThemedText
            style={[styles.toggleText, selectedTestament === 'old' && styles.selectedText]}
          >
            Old Testament
          </ThemedText>
          {bookCounts && (
            <ThemedText
              style={[styles.countText, selectedTestament === 'old' && styles.selectedCountText]}
            >
              {bookCounts.old} books
            </ThemedText>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toggleButton, selectedTestament === 'new' && styles.selectedButton]}
          onPress={handleNewTestamentPress}
          testID="testament-new"
          accessibilityLabel="Select New Testament"
          accessibilityRole="button"
          accessibilityState={{ selected: selectedTestament === 'new' }}
        >
          <ThemedText
            style={[styles.toggleText, selectedTestament === 'new' && styles.selectedText]}
          >
            New Testament
          </ThemedText>
          {bookCounts && (
            <ThemedText
              style={[styles.countText, selectedTestament === 'new' && styles.selectedCountText]}
            >
              {bookCounts.new} books
            </ThemedText>
          )}
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  toggleContainer: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedButton: {
    backgroundColor: '#b09a6d',
  },
  toggleText: {
    fontSize: 16,
    fontWeight: '600',
  },
  selectedText: {
    color: '#fff',
  },
  countText: {
    fontSize: 12,
    marginTop: 2,
    opacity: 0.7,
  },
  selectedCountText: {
    color: '#fff',
    opacity: 0.9,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 20,
  },
});
