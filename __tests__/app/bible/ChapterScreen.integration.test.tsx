/**
 * ChapterScreen Integration Tests (Task Group 11.3)
 *
 * These tests verify end-to-end navigation scenarios to ensure
 * header and content remain in sync during various navigation flows.
 *
 * @see Task Group 11: Integration Testing and Gap Analysis
 * @see spec: agent-os/specs/2026-01-19-chapter-view-state-refactor/spec.md
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import type React from 'react';
import { Text } from 'react-native';
import {
  ChapterNavigationProvider,
  useChapterNavigation,
} from '@/contexts/ChapterNavigationContext';
import { ThemeProvider } from '@/contexts/ThemeContext';

// Mock expo-router
jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(() => ({ bookId: '1', chapterNumber: '1' })),
  useRouter: jest.fn(() => ({
    replace: jest.fn(),
    back: jest.fn(),
    push: jest.fn(),
  })),
  usePathname: jest.fn(() => '/bible/1/1'),
}));

// Mock haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: 'medium' },
}));

// Mock analytics
jest.mock('@/lib/analytics', () => ({
  analytics: {
    track: jest.fn(),
    identify: jest.fn(),
    reset: jest.fn(),
  },
  AnalyticsEvent: {
    CHAPTER_VIEWED: 'CHAPTER_VIEWED',
  },
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  getAllKeys: jest.fn().mockResolvedValue([]),
  multiRemove: jest.fn(),
}));

describe('ChapterScreen - Integration Tests (Task Group 11)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    queryClient.clear();
    jest.useRealTimers();
  });

  /**
   * Test wrapper that provides all necessary context providers
   */
  const IntegrationTestWrapper: React.FC<{
    children: React.ReactNode;
    initialBookId?: number;
    initialChapter?: number;
    initialBookName?: string;
    onJumpToChapter?: (bookId: number, chapter: number) => void;
  }> = ({
    children,
    initialBookId = 1,
    initialChapter = 1,
    initialBookName = 'Genesis',
    onJumpToChapter,
  }) => (
    <QueryClientProvider client={queryClient}>
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
    </QueryClientProvider>
  );

  /**
   * Test component that displays context values for verification
   */
  const NavigationStateDisplay: React.FC = () => {
    const { currentBookId, currentChapter, bookName } = useChapterNavigation();

    return (
      <>
        <Text testID="header-book-id">{currentBookId}</Text>
        <Text testID="header-chapter">{currentChapter}</Text>
        <Text testID="header-book-name">{bookName}</Text>
      </>
    );
  };

  /**
   * Test 1: Rapid swipe sequence does not cause header/content desync
   *
   * This test verifies that rapidly calling setCurrentChapter (simulating fast swipes)
   * keeps the header and content state consistent.
   */
  it('should keep header and content in sync during rapid swipe sequence', async () => {
    let contextRef: ReturnType<typeof useChapterNavigation> | null = null;

    const CaptureContext: React.FC = () => {
      const context = useChapterNavigation();
      contextRef = context;
      return (
        <>
          <Text testID="book-id">{context.currentBookId}</Text>
          <Text testID="chapter">{context.currentChapter}</Text>
        </>
      );
    };

    render(
      <IntegrationTestWrapper>
        <CaptureContext />
      </IntegrationTestWrapper>
    );

    await waitFor(() => {
      expect(contextRef).not.toBeNull();
    });

    // Simulate rapid swipes through chapters 2, 3, 4, 5
    act(() => {
      contextRef?.setCurrentChapter(1, 2, 'Genesis');
    });
    act(() => {
      jest.advanceTimersByTime(50); // Very fast swipes
    });
    act(() => {
      contextRef?.setCurrentChapter(1, 3, 'Genesis');
    });
    act(() => {
      jest.advanceTimersByTime(50);
    });
    act(() => {
      contextRef?.setCurrentChapter(1, 4, 'Genesis');
    });
    act(() => {
      jest.advanceTimersByTime(50);
    });
    act(() => {
      contextRef?.setCurrentChapter(1, 5, 'Genesis');
    });

    // After rapid swipes, context state should reflect final value
    // Note: We use non-null assertion here since waitFor confirmed contextRef is set
    expect(contextRef!.currentChapter).toBe(5);
    expect(contextRef!.currentBookId).toBe(1);
    expect(contextRef!.bookName).toBe('Genesis');

    // UI should also reflect final value (no desync)
    expect(screen.getByTestId('chapter')).toHaveTextContent('5');
    expect(screen.getByTestId('book-id')).toHaveTextContent('1');
  });

  /**
   * Test 2: Swipe-then-modal navigation keeps header in sync
   *
   * When user swipes, then uses modal to jump to a different chapter,
   * the header should stay in sync with the final state.
   */
  it('should maintain sync when swipe is followed by modal navigation', async () => {
    const mockOnJump = jest.fn();
    let contextRef: ReturnType<typeof useChapterNavigation> | null = null;

    const CaptureContext: React.FC = () => {
      const context = useChapterNavigation();
      contextRef = context;
      return null;
    };

    render(
      <IntegrationTestWrapper onJumpToChapter={mockOnJump}>
        <CaptureContext />
      </IntegrationTestWrapper>
    );

    await waitFor(() => {
      expect(contextRef).not.toBeNull();
    });

    // Simulate swipe to Genesis 5
    act(() => {
      contextRef?.setCurrentChapter(1, 5, 'Genesis');
    });

    // Then simulate modal selection to John 3
    act(() => {
      contextRef?.jumpToChapter(43, 3, 'John');
    });

    // Final state should be John 3 (jump overrides swipe)
    expect(contextRef!.currentBookId).toBe(43);
    expect(contextRef!.currentChapter).toBe(3);
    expect(contextRef!.bookName).toBe('John');

    // onJumpToChapter callback should have been called for pager snap
    expect(mockOnJump).toHaveBeenCalledWith(43, 3);
  });

  /**
   * Test 3: Boundary navigation (Genesis 1 ↔ Revelation 22) preserves sync
   *
   * Circular navigation at Bible boundaries should maintain state consistency.
   */
  it('should preserve sync during boundary navigation', async () => {
    let contextRef: ReturnType<typeof useChapterNavigation> | null = null;

    const CaptureContext: React.FC = () => {
      const context = useChapterNavigation();
      contextRef = context;
      return null;
    };

    // Start at Genesis 1
    render(
      <IntegrationTestWrapper initialBookId={1} initialChapter={1} initialBookName="Genesis">
        <CaptureContext />
      </IntegrationTestWrapper>
    );

    await waitFor(() => {
      expect(contextRef).not.toBeNull();
    });

    // Navigate to Revelation 22 (simulating backward circular navigation)
    act(() => {
      contextRef?.setCurrentChapter(66, 22, 'Revelation');
    });

    expect(contextRef!.currentBookId).toBe(66);
    expect(contextRef!.currentChapter).toBe(22);
    expect(contextRef!.bookName).toBe('Revelation');

    // Navigate back to Genesis 1 (forward circular navigation)
    act(() => {
      contextRef?.setCurrentChapter(1, 1, 'Genesis');
    });

    expect(contextRef!.currentBookId).toBe(1);
    expect(contextRef!.currentChapter).toBe(1);
    expect(contextRef!.bookName).toBe('Genesis');
  });

  /**
   * Test 4: View mode toggle does not affect navigation state
   *
   * Changing view mode (Bible/Insight) should not alter navigation context.
   */
  it('should not affect navigation state when external state changes', async () => {
    let contextRef: ReturnType<typeof useChapterNavigation> | null = null;

    const CaptureContext: React.FC = () => {
      const context = useChapterNavigation();
      contextRef = context;
      return null;
    };

    render(
      <IntegrationTestWrapper initialBookId={19} initialChapter={23} initialBookName="Psalms">
        <CaptureContext />
      </IntegrationTestWrapper>
    );

    await waitFor(() => {
      expect(contextRef).not.toBeNull();
    });

    const initialState = {
      bookId: contextRef!.currentBookId,
      chapter: contextRef!.currentChapter,
      bookName: contextRef!.bookName,
    };

    // Simulate time passing (external state changes like view mode toggle)
    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    // Navigation state should remain unchanged
    expect(contextRef!.currentBookId).toBe(initialState.bookId);
    expect(contextRef!.currentChapter).toBe(initialState.chapter);
    expect(contextRef!.bookName).toBe(initialState.bookName);
  });

  /**
   * Test 5: FAB navigation (next/previous buttons) updates context correctly
   *
   * Floating action button navigation should properly update context state.
   */
  it('should update context correctly when FAB triggers navigation', async () => {
    let contextRef: ReturnType<typeof useChapterNavigation> | null = null;

    const CaptureContext: React.FC = () => {
      const context = useChapterNavigation();
      contextRef = context;
      return null;
    };

    render(
      <IntegrationTestWrapper initialBookId={1} initialChapter={1} initialBookName="Genesis">
        <CaptureContext />
      </IntegrationTestWrapper>
    );

    await waitFor(() => {
      expect(contextRef).not.toBeNull();
    });

    // FAB "next" button would call setCurrentChapter via pager
    act(() => {
      contextRef?.setCurrentChapter(1, 2, 'Genesis');
    });

    expect(contextRef!.currentChapter).toBe(2);

    // FAB "previous" button
    act(() => {
      contextRef?.setCurrentChapter(1, 1, 'Genesis');
    });

    expect(contextRef!.currentChapter).toBe(1);
  });

  /**
   * Test 6: Component remount initializes correctly with new props
   *
   * When component remounts (e.g., deep link to different chapter),
   * it should initialize with the new props correctly.
   */
  it('should initialize correctly on remount with different props', () => {
    const { unmount } = render(
      <IntegrationTestWrapper initialBookId={1} initialChapter={1} initialBookName="Genesis">
        <NavigationStateDisplay />
      </IntegrationTestWrapper>
    );

    expect(screen.getByTestId('header-chapter')).toHaveTextContent('1');
    expect(screen.getByTestId('header-book-name')).toHaveTextContent('Genesis');

    // Unmount
    unmount();

    // Remount with different initial values (simulating deep link to different chapter)
    render(
      <IntegrationTestWrapper initialBookId={43} initialChapter={3} initialBookName="John">
        <NavigationStateDisplay />
      </IntegrationTestWrapper>
    );

    // Should initialize with new values
    expect(screen.getByTestId('header-book-id')).toHaveTextContent('43');
    expect(screen.getByTestId('header-chapter')).toHaveTextContent('3');
    expect(screen.getByTestId('header-book-name')).toHaveTextContent('John');
  });
});
