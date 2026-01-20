/**
 * ChapterHeader Context Integration Tests
 *
 * Tests for ChapterHeader reading navigation state from ChapterNavigationContext.
 * ChapterHeader is an inline function defined in app/bible/[bookId]/[chapterNumber].tsx.
 *
 * These tests verify:
 * - Header renders book name from context
 * - Header renders chapter number from context
 * - Header re-renders when context updates
 *
 * @see Task Group 3: Refactor ChapterHeader to Read from Context
 * @see spec: agent-os/specs/2026-01-19-chapter-view-state-refactor/spec.md
 */

import { act, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  ChapterNavigationProvider,
  useChapterNavigation,
} from '@/contexts/ChapterNavigationContext';
import { ThemeProvider } from '@/contexts/ThemeContext';

// Mock dependencies used by ChapterHeader
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() => Promise.resolve({ isInternetReachable: true })),
}));

// Mock the OfflineIndicator component that's used in ChapterHeader
jest.mock('@/components/bible/OfflineIndicator', () => ({
  OfflineIndicator: () => null,
}));

/**
 * Simplified ChapterHeader component for testing context integration.
 *
 * This mirrors the structure of the inline ChapterHeader in [chapterNumber].tsx
 * but focuses on the context integration aspect. The full component has additional
 * UI (toggle buttons, menu icon, animations) that aren't relevant for context tests.
 *
 * Props match the real ChapterHeader interface but are unused since we're testing
 * context integration, not UI interactions.
 */
function TestableChapterHeader({
  activeView: _activeView,
  onNavigationPress: _onNavigationPress,
  onViewChange: _onViewChange,
  onMenuPress: _onMenuPress,
}: {
  activeView: 'bible' | 'explanations';
  onNavigationPress: () => void;
  onViewChange: (view: 'bible' | 'explanations') => void;
  onMenuPress: () => void;
}) {
  // Read navigation state from context (the key integration being tested)
  const { currentBookId, currentChapter, bookName } = useChapterNavigation();

  return (
    <View testID="chapter-header">
      <Text testID="header-title">
        {bookName} {currentChapter}
      </Text>
      <Text testID="book-id">{currentBookId}</Text>
    </View>
  );
}

/**
 * Test wrapper that provides all required contexts
 */
function TestWrapper({
  children,
  initialBookId = 1,
  initialChapter = 1,
  initialBookName = 'Genesis',
  onJumpToChapter,
}: {
  children: React.ReactNode;
  initialBookId?: number;
  initialChapter?: number;
  initialBookName?: string;
  onJumpToChapter?: (bookId: number, chapter: number) => void;
}) {
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <ThemeProvider>
        <ChapterNavigationProvider
          initialBookId={initialBookId}
          initialChapter={initialChapter}
          initialBookName={initialBookName}
          onJumpToChapter={onJumpToChapter}
        >
          {children}
        </ChapterNavigationProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

describe('ChapterHeader Context Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Test 3.1.1: Header renders book name from context
   */
  it('should render book name from context', () => {
    render(
      <TestWrapper initialBookId={43} initialChapter={3} initialBookName="John">
        <TestableChapterHeader
          activeView="bible"
          onNavigationPress={jest.fn()}
          onViewChange={jest.fn()}
          onMenuPress={jest.fn()}
        />
      </TestWrapper>
    );

    // Verify header displays the book name from context
    expect(screen.getByTestId('header-title')).toHaveTextContent('John 3');
  });

  /**
   * Test 3.1.2: Header renders chapter number from context
   */
  it('should render chapter number from context', () => {
    render(
      <TestWrapper initialBookId={1} initialChapter={50} initialBookName="Genesis">
        <TestableChapterHeader
          activeView="bible"
          onNavigationPress={jest.fn()}
          onViewChange={jest.fn()}
          onMenuPress={jest.fn()}
        />
      </TestWrapper>
    );

    // Verify header displays the chapter number from context
    expect(screen.getByTestId('header-title')).toHaveTextContent('Genesis 50');
    expect(screen.getByTestId('book-id')).toHaveTextContent('1');
  });

  /**
   * Test 3.1.3: Header re-renders when context updates via setCurrentChapter
   *
   * This is the key test - when the context state changes (e.g., from PagerView swipe),
   * the header should automatically re-render with the new values.
   */
  it('should re-render when context updates via setCurrentChapter', () => {
    // Component that exposes context updater for testing
    function ContextUpdater({
      onReady,
    }: {
      onReady: (setter: (bookId: number, chapter: number, bookName: string) => void) => void;
    }) {
      const { setCurrentChapter } = useChapterNavigation();
      React.useEffect(() => {
        onReady(setCurrentChapter);
      }, [onReady, setCurrentChapter]);
      return null;
    }

    let contextUpdater: (bookId: number, chapter: number, bookName: string) => void = () => {};

    render(
      <TestWrapper initialBookId={1} initialChapter={1} initialBookName="Genesis">
        <TestableChapterHeader
          activeView="bible"
          onNavigationPress={jest.fn()}
          onViewChange={jest.fn()}
          onMenuPress={jest.fn()}
        />
        <ContextUpdater
          onReady={(setter) => {
            contextUpdater = setter;
          }}
        />
      </TestWrapper>
    );

    // Initial state
    expect(screen.getByTestId('header-title')).toHaveTextContent('Genesis 1');

    // Simulate a context update (as would happen from PagerView swipe)
    act(() => {
      contextUpdater(2, 5, 'Exodus');
    });

    // Header should now show the updated values
    expect(screen.getByTestId('header-title')).toHaveTextContent('Exodus 5');
    expect(screen.getByTestId('book-id')).toHaveTextContent('2');
  });

  /**
   * Test 3.1.4: Header re-renders when context updates via jumpToChapter
   *
   * This tests the modal/deep-link navigation path where jumpToChapter is called.
   */
  it('should re-render when context updates via jumpToChapter', () => {
    const onJumpToChapter = jest.fn();

    // Component that exposes context jumper for testing
    function ContextJumper({
      onReady,
    }: {
      onReady: (jumper: (bookId: number, chapter: number, bookName: string) => void) => void;
    }) {
      const { jumpToChapter } = useChapterNavigation();
      React.useEffect(() => {
        onReady(jumpToChapter);
      }, [onReady, jumpToChapter]);
      return null;
    }

    let contextJumper: (bookId: number, chapter: number, bookName: string) => void = () => {};

    render(
      <TestWrapper
        initialBookId={1}
        initialChapter={1}
        initialBookName="Genesis"
        onJumpToChapter={onJumpToChapter}
      >
        <TestableChapterHeader
          activeView="bible"
          onNavigationPress={jest.fn()}
          onViewChange={jest.fn()}
          onMenuPress={jest.fn()}
        />
        <ContextJumper
          onReady={(jumper) => {
            contextJumper = jumper;
          }}
        />
      </TestWrapper>
    );

    // Initial state
    expect(screen.getByTestId('header-title')).toHaveTextContent('Genesis 1');

    // Simulate jumpToChapter (as would happen from modal selection)
    act(() => {
      contextJumper(66, 22, 'Revelation');
    });

    // Header should show the updated values
    expect(screen.getByTestId('header-title')).toHaveTextContent('Revelation 22');
    expect(screen.getByTestId('book-id')).toHaveTextContent('66');

    // Callback should have been called
    expect(onJumpToChapter).toHaveBeenCalledWith(66, 22);
  });
});
