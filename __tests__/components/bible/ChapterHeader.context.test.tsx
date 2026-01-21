/**
 * ChapterHeader Context Integration Tests
 *
 * Tests for the ChapterHeader component's integration with ChapterNavigationContext.
 * The header reads bookName and currentChapter from context for instant updates.
 *
 * @see Task Group 4.1 - Write 3-4 focused tests for ChapterHeader context usage
 */

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type React from 'react';
import { Pressable, Text, View } from 'react-native';

// Import ChapterHeader after mocks are set up
import { ChapterHeader } from '@/app/bible/[bookId]/[chapterNumber]';
// Import the context
import {
  ChapterNavigationProvider,
  useChapterNavigation,
} from '@/contexts/ChapterNavigationContext';

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
 * Helper wrapper that provides ChapterNavigationContext with given initial values
 */
interface TestWrapperProps {
  children: React.ReactNode;
  initialBookId?: number;
  initialChapter?: number;
  initialBookName?: string;
  onJumpToChapter?: (bookId: number, chapter: number) => void;
}

function TestWrapper({
  children,
  initialBookId = 1,
  initialChapter = 1,
  initialBookName = 'Genesis',
  onJumpToChapter = jest.fn(),
}: TestWrapperProps) {
  return (
    <ChapterNavigationProvider
      initialBookId={initialBookId}
      initialChapter={initialChapter}
      initialBookName={initialBookName}
      onJumpToChapter={onJumpToChapter}
    >
      {children}
    </ChapterNavigationProvider>
  );
}

/**
 * Component that allows triggering context updates in tests
 */
interface ContextUpdaterProps {
  children: React.ReactNode;
}

function ContextUpdater({ children }: ContextUpdaterProps) {
  const { setCurrentChapter } = useChapterNavigation();

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

describe('ChapterHeader Context Integration', () => {
  describe('renders values from context', () => {
    it('should render bookName from context', () => {
      render(
        <TestWrapper initialBookId={19} initialChapter={23} initialBookName="Psalms">
          <ChapterHeader
            activeView="bible"
            onNavigationPress={jest.fn()}
            onViewChange={jest.fn()}
            onMenuPress={jest.fn()}
          />
        </TestWrapper>
      );

      // The header should display "Psalms 23" from context
      expect(screen.getByText('Psalms 23')).toBeTruthy();
    });

    it('should render chapterNumber from context', () => {
      render(
        <TestWrapper initialBookId={43} initialChapter={3} initialBookName="John">
          <ChapterHeader
            activeView="explanations"
            onNavigationPress={jest.fn()}
            onViewChange={jest.fn()}
            onMenuPress={jest.fn()}
          />
        </TestWrapper>
      );

      // The header should display "John 3" from context
      expect(screen.getByText('John 3')).toBeTruthy();
    });
  });

  describe('updates immediately when context changes', () => {
    it('should update header immediately when setCurrentChapter is called', async () => {
      render(
        <TestWrapper initialBookId={1} initialChapter={1} initialBookName="Genesis">
          <ContextUpdater>
            <ChapterHeader
              activeView="bible"
              onNavigationPress={jest.fn()}
              onViewChange={jest.fn()}
              onMenuPress={jest.fn()}
            />
          </ContextUpdater>
        </TestWrapper>
      );

      // Initial state
      expect(screen.getByText('Genesis 1')).toBeTruthy();

      // Update context to Exodus 5
      await act(async () => {
        fireEvent.press(screen.getByTestId('update-to-exodus'));
      });

      // Header should immediately reflect the new values
      expect(screen.getByText('Exodus 5')).toBeTruthy();
      expect(screen.queryByText('Genesis 1')).toBeNull();
    });

    it('should handle multiple sequential context updates', async () => {
      render(
        <TestWrapper initialBookId={1} initialChapter={1} initialBookName="Genesis">
          <ContextUpdater>
            <ChapterHeader
              activeView="bible"
              onNavigationPress={jest.fn()}
              onViewChange={jest.fn()}
              onMenuPress={jest.fn()}
            />
          </ContextUpdater>
        </TestWrapper>
      );

      // Initial state
      expect(screen.getByText('Genesis 1')).toBeTruthy();

      // First update to Exodus 5
      await act(async () => {
        fireEvent.press(screen.getByTestId('update-to-exodus'));
      });
      expect(screen.getByText('Exodus 5')).toBeTruthy();

      // Second update to Revelation 22
      await act(async () => {
        fireEvent.press(screen.getByTestId('update-to-revelation'));
      });
      expect(screen.getByText('Revelation 22')).toBeTruthy();
      expect(screen.queryByText('Exodus 5')).toBeNull();
    });
  });
});
