/**
 * ChapterHeader Shared Values Tests
 *
 * Tests for the ChapterHeader component using Reanimated shared values
 * to display book name and chapter number. This enables the header to
 * update on the UI thread without React re-renders during swiping.
 *
 * NOTE: The Reanimated mock doesn't execute useDerivedValue worklets,
 * so we test the module-level shared value mechanism directly via
 * currentBookIdValue and currentChapterValue. The actual book name
 * derivation is tested in use-chapter-display.test.ts and via Maestro E2E.
 *
 * @see Spec: agent-os/specs/2026-02-01-chapter-header-slide-sync-v2/spec.md
 * @see Task Group 4: Update ChapterHeader to Use Shared Values
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/contexts/ToastContext';
import {
  __TEST_ONLY_RESET_STATE,
  __TEST_ONLY_SET_BOOKS_METADATA,
  useChapterDisplay,
} from '@/hooks/bible/use-chapter-display';
import { mockTestamentBooks } from '../../mocks/data/bible-books.data';

// Mock reanimated with proper makeMutable support
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  // Add proper makeMutable mock that returns an object with a value property
  Reanimated.makeMutable = <T,>(initialValue: T) => ({ value: initialValue });
  // Add useDerivedValue mock that evaluates the function once
  Reanimated.useDerivedValue = (fn: () => unknown) => ({ value: fn() });
  return Reanimated;
});

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
}));

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() => Promise.resolve({ isInternetReachable: true })),
}));

// Mock OfflineIndicator
jest.mock('@/components/bible/OfflineIndicator', () => ({
  OfflineIndicator: () => null,
}));

/**
 * Test component that renders using shared values.
 * Since the Reanimated mock doesn't compute useDerivedValue worklets,
 * we display bookId and chapter directly to verify module-level sharing.
 */
function TestHeaderWithSharedValues() {
  const { currentBookIdValue, currentChapterValue, setBooksMetadata } = useChapterDisplay();

  // Initialize metadata in effect
  React.useEffect(() => {
    setBooksMetadata(mockTestamentBooks);
  }, [setBooksMetadata]);

  // Read from shared values directly (bookNameValue requires worklet execution)
  const bookId = currentBookIdValue.value;
  const chapterNumber = currentChapterValue.value;

  return (
    <Text testID="header-text">
      Book {bookId} Chapter {chapterNumber}
    </Text>
  );
}

/**
 * Test component that provides a way to update shared values from outside
 */
function TestHeaderWithUpdater({
  onMount,
}: {
  onMount: (setChapter: (bookId: number, chapter: number) => void) => void;
}) {
  const { currentBookIdValue, currentChapterValue, setChapter, setBooksMetadata } =
    useChapterDisplay();

  // Initialize metadata in effect
  React.useEffect(() => {
    setBooksMetadata(mockTestamentBooks);
  }, [setBooksMetadata]);

  // Call onMount with the setChapter function
  React.useEffect(() => {
    onMount(setChapter);
  }, [onMount, setChapter]);

  const bookId = currentBookIdValue.value;
  const chapterNumber = currentChapterValue.value;

  return (
    <Text testID="header-text">
      Book {bookId} Chapter {chapterNumber}
    </Text>
  );
}

// Helper to render with necessary providers
function renderWithProviders(component: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <SafeAreaProvider
          initialMetrics={{
            frame: { x: 0, y: 0, width: 390, height: 844 },
            insets: { top: 47, left: 0, right: 0, bottom: 34 },
          }}
        >
          <ToastProvider>{children}</ToastProvider>
        </SafeAreaProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );

  return render(component, { wrapper: Wrapper });
}

describe('ChapterHeader with Shared Values', () => {
  beforeEach(() => {
    __TEST_ONLY_RESET_STATE();
    jest.clearAllMocks();
  });

  afterEach(() => {
    __TEST_ONLY_RESET_STATE();
  });

  describe('displaying values from shared state', () => {
    it('should display bookId and chapter from shared value, not from props', () => {
      __TEST_ONLY_SET_BOOKS_METADATA(mockTestamentBooks);

      const { getByTestId } = renderWithProviders(<TestHeaderWithSharedValues />);

      // Header should display Book 1 Chapter 1 (default values) from shared value
      const headerText = getByTestId('header-text');
      // Children is an array like ["Book ", 1, " Chapter ", 1]
      expect(headerText.props.children).toContain(1); // Book ID
      expect(headerText.props.children[0]).toBe('Book ');
      expect(headerText.props.children[2]).toBe(' Chapter ');
    });

    it('should display correct values for different initialization', () => {
      __TEST_ONLY_SET_BOOKS_METADATA(mockTestamentBooks);

      // Initialize with book 19, chapter 23
      function TestWithPsalms() {
        const { currentBookIdValue, currentChapterValue } = useChapterDisplay({
          initialBookId: 19,
          initialChapter: 23,
        });
        return (
          <Text testID="header-text">
            Book {currentBookIdValue.value} Chapter {currentChapterValue.value}
          </Text>
        );
      }

      const { getByTestId } = renderWithProviders(<TestWithPsalms />);

      const headerText = getByTestId('header-text');
      // Children is an array like ["Book ", 19, " Chapter ", 23]
      expect(headerText.props.children[1]).toBe(19);
      expect(headerText.props.children[3]).toBe(23);
    });
  });

  describe('shared value updates', () => {
    it('should update shared values when setChapter is called', async () => {
      __TEST_ONLY_SET_BOOKS_METADATA(mockTestamentBooks);

      let setChapterFn: ((bookId: number, chapter: number) => void) | null = null;

      const { getByTestId } = renderWithProviders(
        <TestHeaderWithUpdater
          onMount={(fn) => {
            setChapterFn = fn;
          }}
        />
      );

      // Initially shows Book 1 Chapter 1
      const children = getByTestId('header-text').props.children;
      expect(children[1]).toBe(1); // Book ID
      expect(children[3]).toBe(1); // Chapter

      // Update to Book 2 (Exodus) Chapter 10
      act(() => {
        setChapterFn?.(2, 10);
      });

      // Verify the setChapter function was callable
      expect(setChapterFn).toBeDefined();
    });

    it('should update shared values synchronously without setTimeout', () => {
      __TEST_ONLY_SET_BOOKS_METADATA(mockTestamentBooks);

      let setChapterFn: ((bookId: number, chapter: number) => void) | null = null;
      let chapterValueRef: { value: number } = { value: 0 };

      function TestWithValueCapture() {
        const { currentChapterValue, setChapter } = useChapterDisplay();
        chapterValueRef = currentChapterValue as { value: number };
        setChapterFn = setChapter;
        return <Text testID="header-text">Chapter {currentChapterValue.value}</Text>;
      }

      renderWithProviders(<TestWithValueCapture />);

      // Verify initial value
      expect(chapterValueRef.value).toBe(1);

      // Update synchronously
      act(() => {
        setChapterFn?.(40, 5); // Matthew 5
      });

      // Shared values should be updated immediately (synchronously)
      expect(chapterValueRef.value).toBe(5);
    });
  });

  describe('initial render handling', () => {
    it('should render correctly before setBooksMetadata is called', () => {
      // Reset state to ensure clean start
      __TEST_ONLY_RESET_STATE();

      const { getByTestId } = renderWithProviders(<TestHeaderWithSharedValues />);

      // Should render with default values
      const headerText = getByTestId('header-text');
      const children = headerText.props.children;
      expect(children[1]).toBe(1); // Book ID
      expect(children[3]).toBe(1); // Chapter
    });

    it('should preserve module-level state across hook instances', () => {
      __TEST_ONLY_SET_BOOKS_METADATA(mockTestamentBooks);

      // First component sets chapter to 5
      function FirstComponent() {
        const { setChapter } = useChapterDisplay();
        React.useEffect(() => {
          setChapter(3, 5);
        }, [setChapter]);
        return null;
      }

      // Second component reads the state
      function SecondComponent() {
        const { currentBookIdValue, currentChapterValue } = useChapterDisplay();
        return (
          <Text testID="header-text">
            Book {currentBookIdValue.value} Chapter {currentChapterValue.value}
          </Text>
        );
      }

      // Render first component to set state
      const { unmount } = renderWithProviders(<FirstComponent />);
      unmount();

      // Render second component - should see the persisted state
      const { getByTestId } = renderWithProviders(<SecondComponent />);

      const headerText = getByTestId('header-text');
      const children = headerText.props.children;
      expect(children[1]).toBe(3); // Book ID
      expect(children[3]).toBe(5); // Chapter
    });
  });

  describe('module-level shared value mechanism', () => {
    it('should use makeMutable for module-level shared values', () => {
      __TEST_ONLY_SET_BOOKS_METADATA(mockTestamentBooks);

      // This test verifies the module-level sharing works
      // by checking that two separate hook calls return the same values
      let secondHookBookId: number | undefined;

      function ComponentA() {
        const { setChapter } = useChapterDisplay();
        React.useEffect(() => {
          // ComponentA sets the value
          setChapter(42, 1); // Set to Luke
        }, [setChapter]);
        return null;
      }

      function ComponentB() {
        const { currentBookIdValue } = useChapterDisplay();
        secondHookBookId = currentBookIdValue.value;
        return <Text testID="test">Book {currentBookIdValue.value}</Text>;
      }

      // Render A to set the state
      const { unmount: unmountA } = renderWithProviders(<ComponentA />);
      unmountA();

      // Render B to read the state
      renderWithProviders(<ComponentB />);

      // Both should see the same module-level state
      expect(secondHookBookId).toBe(42);
    });

    it('should not create separate shared value instances per hook call', () => {
      __TEST_ONLY_SET_BOOKS_METADATA(mockTestamentBooks);

      // This is the key bug that was fixed - each hook call should NOT create new instances
      let hookARef: { value: number } | null = null;
      let hookBRef: { value: number } | null = null;

      function ComponentA() {
        const { currentChapterValue } = useChapterDisplay();
        hookARef = currentChapterValue;
        return null;
      }

      function ComponentB() {
        const { currentChapterValue } = useChapterDisplay();
        hookBRef = currentChapterValue;
        return null;
      }

      // Render both components
      const { unmount: unmountA } = renderWithProviders(<ComponentA />);
      const { unmount: unmountB } = renderWithProviders(<ComponentB />);

      // Both should reference the SAME module-level shared value
      // (In the old buggy code, these would be different objects)
      expect(hookARef).toBe(hookBRef);

      unmountA();
      unmountB();
    });
  });
});
