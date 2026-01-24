/**
 * ChapterHeader Store Integration Tests
 *
 * Tests for the ChapterHeader component's integration with the chapter navigation store.
 * The header reads bookName and chapter from the external store for instant updates
 * without triggering parent re-renders.
 *
 * @see stores/chapter-navigation-store.ts
 * @see hooks/bible/use-chapter-navigation-store.ts
 */

import { act, render, screen } from '@testing-library/react-native';
import type React from 'react';
import { Pressable, Text, View } from 'react-native';

// Import ChapterHeader after mocks are set up
import { ChapterHeader } from '@/app/bible/[bookId]/[chapterNumber]';
// Import the store functions
import { initializeState, resetStore, setCurrentChapter } from '@/stores/chapter-navigation-store';

// Mock expo-haptics before imports
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
}));

// Mock safe area context
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock Reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  // Silence warnings about worklets
  Reanimated.default.call = () => {};
  return {
    ...Reanimated,
    useSharedValue: jest.fn((initialValue) => ({ value: initialValue })),
    useAnimatedStyle: jest.fn(() => ({})),
    withTiming: jest.fn((value) => value),
  };
});

// Mock OfflineIndicator component (used by ChapterHeader)
jest.mock('@/components/bible/OfflineIndicator', () => ({
  OfflineIndicator: () => null,
}));

// Mock Ionicons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

/**
 * Component that allows triggering store updates in tests
 */
interface StoreUpdaterProps {
  children: React.ReactNode;
}

function StoreUpdater({ children }: StoreUpdaterProps) {
  return (
    <View>
      {children}
      <Pressable testID="update-to-exodus" onPress={() => setCurrentChapter(2, 5, 'Exodus')}>
        <Text>Update to Exodus 5</Text>
      </Pressable>
      <Pressable
        testID="update-to-revelation"
        onPress={() => setCurrentChapter(66, 22, 'Revelation')}
      >
        <Text>Update to Revelation 22</Text>
      </Pressable>
    </View>
  );
}

describe('ChapterHeader Store Integration', () => {
  // Reset store before each test
  beforeEach(() => {
    resetStore();
  });

  describe('renders values from store', () => {
    it('should render bookName from store', () => {
      // Initialize store with test values
      initializeState(19, 23, 'Psalms');

      render(
        <ChapterHeader
          activeView="bible"
          onNavigationPress={jest.fn()}
          onViewChange={jest.fn()}
          onMenuPress={jest.fn()}
        />
      );

      // The header should display "Psalms 23" from store
      expect(screen.getByText('Psalms 23')).toBeTruthy();
    });

    it('should render chapterNumber from store', () => {
      // Initialize store with test values
      initializeState(43, 3, 'John');

      render(
        <ChapterHeader
          activeView="explanations"
          onNavigationPress={jest.fn()}
          onViewChange={jest.fn()}
          onMenuPress={jest.fn()}
        />
      );

      // The header should display "John 3" from store
      expect(screen.getByText('John 3')).toBeTruthy();
    });
  });

  describe('updates immediately when store changes', () => {
    it('should update header immediately when setCurrentChapter is called', async () => {
      // Initialize store with Genesis 1
      initializeState(1, 1, 'Genesis');

      render(
        <StoreUpdater>
          <ChapterHeader
            activeView="bible"
            onNavigationPress={jest.fn()}
            onViewChange={jest.fn()}
            onMenuPress={jest.fn()}
          />
        </StoreUpdater>
      );

      // Initial state
      expect(screen.getByText('Genesis 1')).toBeTruthy();

      // Update store to Exodus 5
      await act(async () => {
        setCurrentChapter(2, 5, 'Exodus');
      });

      // Header should immediately reflect the new values
      expect(screen.getByText('Exodus 5')).toBeTruthy();
      expect(screen.queryByText('Genesis 1')).toBeNull();
    });

    it('should handle multiple sequential store updates', async () => {
      // Initialize store with Genesis 1
      initializeState(1, 1, 'Genesis');

      render(
        <StoreUpdater>
          <ChapterHeader
            activeView="bible"
            onNavigationPress={jest.fn()}
            onViewChange={jest.fn()}
            onMenuPress={jest.fn()}
          />
        </StoreUpdater>
      );

      // Initial state
      expect(screen.getByText('Genesis 1')).toBeTruthy();

      // First update to Exodus 5
      await act(async () => {
        setCurrentChapter(2, 5, 'Exodus');
      });
      expect(screen.getByText('Exodus 5')).toBeTruthy();

      // Second update to Revelation 22
      await act(async () => {
        setCurrentChapter(66, 22, 'Revelation');
      });
      expect(screen.getByText('Revelation 22')).toBeTruthy();
      expect(screen.queryByText('Exodus 5')).toBeNull();
    });
  });
});
