/**
 * Tests for TopicPagerView component
 *
 * TopicPagerView implements a 5-page fixed window with stable positional keys.
 * - Keys: "page-0", "page-1", "page-2", "page-3", "page-4" (NEVER change)
 * - Middle page (index 2) always shows current topic
 * - Re-centers to index 2 when user reaches edges (index 0 or 4)
 * - Props update when window shifts
 *
 * Tests:
 * - Renders 5 pages with stable positional keys
 * - Current topic is centered at index 2 (CENTER_INDEX)
 * - Re-centers when reaching edge position (0 or 4)
 * - Calls onPageChange after 75ms delay on swipe
 * - Imperative handle setPage method works
 * - Handles empty/loading topics array gracefully
 *
 * @see components/topics/TopicPagerView.tsx
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react-native';
import React, { useRef } from 'react';
import type { TopicPagerViewRef } from '@/components/topics/TopicPagerView';
import { TopicPagerView } from '@/components/topics/TopicPagerView';
import { ThemeProvider } from '@/contexts/ThemeContext';
import type { TopicListItem } from '@/types/topics';

// Store mock setPage for testing
let mockSetPage: jest.Mock;
let mockSetPageWithoutAnimation: jest.Mock;
let mockOnPageSelected: ((event: { nativeEvent: { position: number } }) => void) | undefined;

// Mock react-native-pager-view
jest.mock('react-native-pager-view', () => {
  const React = require('react');
  const { View } = require('react-native');

  const MockPagerView = React.forwardRef(({ children, testID, onPageSelected }: any, ref: any) => {
    // Store ref methods for testing
    mockSetPage = jest.fn();
    mockSetPageWithoutAnimation = jest.fn();

    // Store onPageSelected callback for testing
    mockOnPageSelected = onPageSelected;

    React.useImperativeHandle(ref, () => ({
      setPage: mockSetPage,
      setPageWithoutAnimation: mockSetPageWithoutAnimation,
    }));

    return (
      <View testID={testID || 'pager-view'}>
        {React.Children.map(children, (child: any, index: number) => (
          <View key={`page-${index}`} testID={`pager-page-${index}`}>
            {child}
          </View>
        ))}
      </View>
    );
  });

  MockPagerView.displayName = 'PagerView';

  return {
    __esModule: true,
    default: MockPagerView,
  };
});

// Mock TopicPage component
jest.mock('@/components/topics/TopicPage', () => ({
  TopicPage: ({ topicId, category }: any) => {
    const { Text } = require('react-native');
    return (
      <Text testID={`topic-page-${topicId}`}>
        Topic {topicId} ({category})
      </Text>
    );
  },
}));

// Mock API hooks
jest.mock('@/src/api/generated', () => ({
  useTopicById: jest.fn(() => ({ data: null, isLoading: false, error: null })),
  useTopicReferences: jest.fn(() => ({ data: null, isLoading: false, error: null })),
}));

// Mock AuthContext
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    isAuthenticated: false,
    user: null,
    isLoading: false,
  })),
}));

/**
 * Mock topic data for testing
 */
const mockSortedTopics: TopicListItem[] = [
  { topic_id: 'topic-001', name: 'Creation', sort_order: 1, category: 'EVENT' },
  { topic_id: 'topic-002', name: 'The Fall', sort_order: 2, category: 'EVENT' },
  { topic_id: 'topic-003', name: 'The Flood', sort_order: 3, category: 'EVENT' },
  { topic_id: 'topic-004', name: 'Tower of Babel', sort_order: 4, category: 'EVENT' },
  { topic_id: 'topic-005', name: 'Call of Abraham', sort_order: 5, category: 'EVENT' },
  { topic_id: 'topic-006', name: 'Isaac', sort_order: 6, category: 'EVENT' },
  { topic_id: 'topic-007', name: 'Jacob', sort_order: 7, category: 'EVENT' },
  { topic_id: 'topic-008', name: 'Joseph', sort_order: 8, category: 'EVENT' },
];

describe('TopicPagerView', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const renderPagerView = (
    initialTopicId: string = 'topic-003',
    sortedTopics: TopicListItem[] = mockSortedTopics,
    onPageChange?: (topicId: string, category: string) => void
  ) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TopicPagerView
            initialTopicId={initialTopicId}
            category="EVENT"
            sortedTopics={sortedTopics}
            activeTab="summary"
            activeView="bible"
            onPageChange={onPageChange || jest.fn()}
          />
        </ThemeProvider>
      </QueryClientProvider>
    );
  };

  it('should render 5 pages with stable positional keys', () => {
    renderPagerView();

    // Should have 5 pager pages
    for (let i = 0; i < 5; i++) {
      expect(screen.getByTestId(`pager-page-${i}`)).toBeTruthy();
    }
  });

  it('should render current topic centered at index 2 (CENTER_INDEX)', () => {
    // Topic 003 (The Flood) at center
    renderPagerView('topic-003');

    // Window: [001, 002, 003, 004, 005]
    // Positions: [0, 1, 2 (center), 3, 4]
    expect(screen.getByTestId('topic-page-topic-001')).toBeTruthy(); // position 0
    expect(screen.getByTestId('topic-page-topic-002')).toBeTruthy(); // position 1
    expect(screen.getByTestId('topic-page-topic-003')).toBeTruthy(); // position 2 (center)
    expect(screen.getByTestId('topic-page-topic-004')).toBeTruthy(); // position 3
    expect(screen.getByTestId('topic-page-topic-005')).toBeTruthy(); // position 4
  });

  it('should re-center when reaching edge position (0 or 4)', () => {
    const onPageChange = jest.fn();
    renderPagerView('topic-003', mockSortedTopics, onPageChange);

    // Simulate swipe to position 4 (edge)
    act(() => {
      mockOnPageSelected?.({ nativeEvent: { position: 4 } });
    });

    // After reaching edge, requestAnimationFrame should call setPageWithoutAnimation
    // to re-center to index 2
    act(() => {
      jest.runAllTimers();
    });

    expect(mockSetPageWithoutAnimation).toHaveBeenCalledWith(2);
  });

  it('should call onPageChange after 75ms delay on swipe', () => {
    const onPageChange = jest.fn();
    renderPagerView('topic-003', mockSortedTopics, onPageChange);

    // Simulate swipe to position 3 (next topic)
    act(() => {
      mockOnPageSelected?.({ nativeEvent: { position: 3 } });
    });

    // onPageChange should not be called immediately
    expect(onPageChange).not.toHaveBeenCalled();

    // After 75ms, onPageChange should be called
    act(() => {
      jest.advanceTimersByTime(75);
    });

    expect(onPageChange).toHaveBeenCalledWith('topic-004', 'EVENT');
  });

  it('should expose imperative handle with setPage method', () => {
    const TestComponent = () => {
      const pagerRef = useRef<TopicPagerViewRef>(null);

      React.useEffect(() => {
        // Simulate button click after render
        if (pagerRef.current) {
          pagerRef.current.setPage(3);
        }
      }, []);

      return (
        <QueryClientProvider client={queryClient}>
          <TopicPagerView
            ref={pagerRef}
            initialTopicId="topic-003"
            category="EVENT"
            sortedTopics={mockSortedTopics}
            activeTab="summary"
            activeView="bible"
            onPageChange={jest.fn()}
          />
        </QueryClientProvider>
      );
    };

    render(<TestComponent />);

    // Verify setPage was called with correct index
    expect(mockSetPage).toHaveBeenCalledWith(3);
  });

  it('should handle empty topics array gracefully', () => {
    const result = renderPagerView('topic-003', []);

    // Should render without crashing
    expect(result.root).toBeTruthy();
    // Should still show the pager view
    expect(screen.getByTestId('topic-pager-view')).toBeTruthy();
  });

  it('should handle topic at start of list (first topic)', () => {
    // Topic 001 (Creation) at center - first topic
    renderPagerView('topic-001');

    // Window should clamp to valid topics
    // At start: [001, 001, 001, 002, 003] (001 repeated for positions before start)
    const creationElements = screen.getAllByTestId('topic-page-topic-001');
    expect(creationElements.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle topic at end of list (last topic)', () => {
    // Topic 008 (Joseph) at center - last topic
    renderPagerView('topic-008');

    // Window should clamp to valid topics
    const josephElements = screen.getAllByTestId('topic-page-topic-008');
    expect(josephElements.length).toBeGreaterThanOrEqual(1);
  });

  describe('Ref Functionality', () => {
    it('should allow setPage calls with boundary values', () => {
      const TestComponent = () => {
        const pagerRef = useRef<TopicPagerViewRef>(null);

        React.useEffect(() => {
          if (pagerRef.current) {
            // Test boundary values
            pagerRef.current.setPage(0); // First page
            pagerRef.current.setPage(4); // Last page (WINDOW_SIZE - 1)
            pagerRef.current.setPage(2); // Center index
          }
        }, []);

        return (
          <QueryClientProvider client={queryClient}>
            <TopicPagerView
              ref={pagerRef}
              initialTopicId="topic-003"
              category="EVENT"
              sortedTopics={mockSortedTopics}
              activeTab="summary"
              activeView="bible"
              onPageChange={jest.fn()}
            />
          </QueryClientProvider>
        );
      };

      render(<TestComponent />);

      // Verify all boundary values were called
      expect(mockSetPage).toHaveBeenCalledWith(0);
      expect(mockSetPage).toHaveBeenCalledWith(4);
      expect(mockSetPage).toHaveBeenCalledWith(2);
    });

    it('should support multiple setPage calls', () => {
      const TestComponent = () => {
        const pagerRef = useRef<TopicPagerViewRef>(null);

        React.useEffect(() => {
          if (pagerRef.current) {
            pagerRef.current.setPage(1);
            pagerRef.current.setPage(3);
            pagerRef.current.setPage(2);
          }
        }, []);

        return (
          <QueryClientProvider client={queryClient}>
            <TopicPagerView
              ref={pagerRef}
              initialTopicId="topic-003"
              category="EVENT"
              sortedTopics={mockSortedTopics}
              activeTab="summary"
              activeView="bible"
              onPageChange={jest.fn()}
            />
          </QueryClientProvider>
        );
      };

      render(<TestComponent />);

      // Verify multiple calls
      expect(mockSetPage).toHaveBeenCalledTimes(3);
    });
  });
});
