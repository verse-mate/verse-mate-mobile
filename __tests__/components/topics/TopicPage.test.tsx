/**
 * Tests for TopicPage Component
 *
 * TopicPage is a wrapper component for rendering topic content within TopicPagerView.
 * It receives topicId as a prop (not derived from key) to support the sliding window pattern.
 *
 * Tests:
 * - Renders topic content with correct topicId prop
 * - Calls onScroll callback with velocity and isAtBottom
 * - Calls onTap callback for quick touches
 * - Handles both view modes (bible references and explanations)
 *
 * @see components/topics/TopicPage.tsx
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TopicPage } from '@/components/topics/TopicPage';
import { ThemeProvider } from '@/contexts/ThemeContext';

import { useTopicById, useTopicReferences } from '@/src/api/generated';

// Mock the API hooks
jest.mock('@/src/api/generated', () => ({
  useTopicById: jest.fn(),
  useTopicReferences: jest.fn(),
}));

// Mock AuthContext
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    isAuthenticated: false,
    user: null,
    isLoading: false,
  })),
}));

const mockUseTopicById = useTopicById as jest.MockedFunction<typeof useTopicById>;
const mockUseTopicReferences = useTopicReferences as jest.MockedFunction<typeof useTopicReferences>;

// Mock topic data
const mockTopicData = {
  topic: {
    topic_id: 'topic-uuid-001',
    name: 'Creation',
    description: 'God creates the world',
    category: 'EVENT',
  },
  explanation: {
    summary: 'A summary of creation',
    byline: 'A byline explanation of creation',
    detailed: 'A detailed explanation of creation',
  },
};

// Mock references data
const mockReferencesData = {
  content: '## Genesis\n**1**In the beginning God created...',
};

// Helper to render with providers
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
          {children}
        </SafeAreaProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );

  return render(component, { wrapper: Wrapper });
}

describe('TopicPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    mockUseTopicById.mockReturnValue({
      data: mockTopicData,
      isLoading: false,
      error: null,
      isError: false,
      isSuccess: true,
    } as any);

    mockUseTopicReferences.mockReturnValue({
      data: mockReferencesData,
      isLoading: false,
      error: null,
      isError: false,
      isSuccess: true,
    } as any);
  });

  it('renders topic content with correct topicId prop', async () => {
    const { getByTestId } = renderWithProviders(
      <TopicPage topicId="topic-uuid-001" category="EVENT" activeTab="summary" activeView="bible" />
    );

    // Should render the container
    await waitFor(() => {
      expect(getByTestId('topic-page-topic-uuid-001')).toBeTruthy();
    });

    // Should call useTopicById with correct topicId
    expect(mockUseTopicById).toHaveBeenCalledWith('topic-uuid-001', expect.any(String));
  });

  it('calls onScroll callback with velocity and isAtBottom', async () => {
    const onScroll = jest.fn();

    const { getByTestId } = renderWithProviders(
      <TopicPage
        topicId="topic-uuid-001"
        category="EVENT"
        activeTab="summary"
        activeView="bible"
        onScroll={onScroll}
      />
    );

    await waitFor(() => {
      expect(getByTestId('topic-page-scroll-topic-uuid-001')).toBeTruthy();
    });

    const scrollView = getByTestId('topic-page-scroll-topic-uuid-001');

    // Simulate scroll event
    fireEvent.scroll(scrollView, {
      nativeEvent: {
        contentOffset: { y: 100 },
        contentSize: { height: 1000 },
        layoutMeasurement: { height: 500 },
      },
    });

    // onScroll should be called with velocity and isAtBottom
    expect(onScroll).toHaveBeenCalled();
    const [velocity, isAtBottom] = onScroll.mock.calls[0];
    expect(typeof velocity).toBe('number');
    expect(typeof isAtBottom).toBe('boolean');
  });

  it('calls onTap callback for quick touches (< 200ms, < 10px movement)', async () => {
    const onTap = jest.fn();

    const { getByTestId } = renderWithProviders(
      <TopicPage
        topicId="topic-uuid-001"
        category="EVENT"
        activeTab="summary"
        activeView="bible"
        onTap={onTap}
      />
    );

    await waitFor(() => {
      expect(getByTestId('topic-page-scroll-topic-uuid-001')).toBeTruthy();
    });

    const scrollView = getByTestId('topic-page-scroll-topic-uuid-001');

    // Simulate quick tap (touchStart + touchEnd with minimal movement)
    fireEvent(scrollView, 'touchStart', {
      nativeEvent: { pageY: 100 },
    });

    // Wait a very short time (less than 200ms)
    await new Promise((resolve) => setTimeout(resolve, 50));

    fireEvent(scrollView, 'touchEnd', {
      nativeEvent: { pageY: 102 }, // Only 2px movement
    });

    // onTap should be called for quick touches
    expect(onTap).toHaveBeenCalled();
  });

  it('handles both view modes (bible references and explanations)', async () => {
    // Test Bible view
    const { getByTestId, rerender } = renderWithProviders(
      <TopicPage topicId="topic-uuid-001" category="EVENT" activeTab="summary" activeView="bible" />
    );

    await waitFor(() => {
      expect(getByTestId('topic-page-topic-uuid-001')).toBeTruthy();
    });

    // References should be fetched in bible view
    expect(mockUseTopicReferences).toHaveBeenCalledWith('topic-uuid-001');

    // Clear mocks and rerender with explanations view
    jest.clearAllMocks();

    // Re-setup mocks since clearAllMocks cleared them
    mockUseTopicById.mockReturnValue({
      data: mockTopicData,
      isLoading: false,
      error: null,
      isError: false,
      isSuccess: true,
    } as any);

    mockUseTopicReferences.mockReturnValue({
      data: mockReferencesData,
      isLoading: false,
      error: null,
      isError: false,
      isSuccess: true,
    } as any);

    // Component should render with either view mode without crashing
    rerender(
      <TopicPage
        topicId="topic-uuid-001"
        category="EVENT"
        activeTab="summary"
        activeView="explanations"
      />
    );

    await waitFor(() => {
      expect(getByTestId('topic-page-topic-uuid-001')).toBeTruthy();
    });
  });

  it('shows skeleton loader while loading', async () => {
    mockUseTopicById.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      isError: false,
      isSuccess: false,
    } as any);

    mockUseTopicReferences.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      isError: false,
      isSuccess: false,
    } as any);

    const { getByTestId } = renderWithProviders(
      <TopicPage topicId="topic-uuid-001" category="EVENT" activeTab="summary" activeView="bible" />
    );

    // Should show skeleton loader while loading
    await waitFor(() => {
      expect(getByTestId('skeleton-loader')).toBeTruthy();
    });
  });

  it('does not call onTap for long touches or large movements', async () => {
    const onTap = jest.fn();

    const { getByTestId } = renderWithProviders(
      <TopicPage
        topicId="topic-uuid-001"
        category="EVENT"
        activeTab="summary"
        activeView="bible"
        onTap={onTap}
      />
    );

    await waitFor(() => {
      expect(getByTestId('topic-page-scroll-topic-uuid-001')).toBeTruthy();
    });

    const scrollView = getByTestId('topic-page-scroll-topic-uuid-001');

    // Simulate touch with large movement (scroll gesture)
    fireEvent(scrollView, 'touchStart', {
      nativeEvent: { pageY: 100 },
    });

    fireEvent(scrollView, 'touchEnd', {
      nativeEvent: { pageY: 200 }, // 100px movement - this is a scroll, not a tap
    });

    // onTap should NOT be called for scroll gestures
    expect(onTap).not.toHaveBeenCalled();
  });
});
