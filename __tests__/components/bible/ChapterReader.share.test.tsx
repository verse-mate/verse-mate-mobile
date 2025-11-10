/**
 * Tests for ChapterReader Share Functionality
 *
 * Focused tests for share button and share handler in ChapterReader component.
 * Tests cover critical behaviors without exhaustive edge case coverage.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { Alert, Share } from 'react-native';
import { ChapterReader } from '@/components/bible/ChapterReader';
import { AuthProvider } from '@/contexts/AuthContext';
import type { ChapterContent } from '@/types/bible';

// Create a test query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

// Mock will be set up using jest.spyOn in each test

// Mock Haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'light',
  },
  NotificationFeedbackType: {
    Error: 'error',
  },
}));

// Mock environment variable
process.env.EXPO_PUBLIC_WEB_URL = 'https://app.versemate.org';

// Test wrapper with required providers
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>{children}</AuthProvider>
  </QueryClientProvider>
);

describe('ChapterReader Share Functionality', () => {
  const mockChapter: ChapterContent = {
    bookId: 43,
    bookName: 'John',
    chapterNumber: 3,
    title: 'John 3',
    testament: 'NT',
    sections: [
      {
        subtitle: 'Jesus Teaches Nicodemus',
        startVerse: 1,
        endVerse: 21,
        verses: [
          { number: 1, verseNumber: 1, text: 'Now there was a Pharisee, a man named Nicodemus...' },
          { number: 2, verseNumber: 2, text: 'He came to Jesus at night and said...' },
        ],
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders share button in ChapterReader', () => {
    render(
      <TestWrapper>
        <ChapterReader chapter={mockChapter} activeTab="summary" />
      </TestWrapper>
    );

    // Share button should be present (icon button with testID)
    const shareButton = screen.getByTestId('share-button');
    expect(shareButton).toBeTruthy();
  });

  it('calls Share API with correct message when share button pressed', async () => {
    const mockShare = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });

    render(
      <TestWrapper>
        <ChapterReader chapter={mockChapter} activeTab="summary" />
      </TestWrapper>
    );

    const shareButton = screen.getByTestId('share-button');
    fireEvent.press(shareButton);

    // Wait for async share call
    await waitFor(() => {
      expect(mockShare).toHaveBeenCalledWith({
        message: 'Check out John 3 on VerseMate: https://app.versemate.org/bible/43/3',
        url: 'https://app.versemate.org/bible/43/3',
      });
    });

    // Should trigger haptic feedback
    expect(Haptics.impactAsync).toHaveBeenCalled();
  });

  it('handles Share API dismissal gracefully', async () => {
    const mockShare = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'dismissedAction' });

    render(
      <TestWrapper>
        <ChapterReader chapter={mockChapter} activeTab="summary" />
      </TestWrapper>
    );

    const shareButton = screen.getByTestId('share-button');
    fireEvent.press(shareButton);

    await waitFor(() => {
      expect(mockShare).toHaveBeenCalled();
    });

    // Should not throw error or show alert
    // Dismissal is normal user behavior
  });

  it('shows alert when Share API fails', async () => {
    jest.spyOn(Share, 'share').mockRejectedValue(new Error('Share failed'));
    const mockAlert = jest.spyOn(Alert, 'alert');

    render(
      <TestWrapper>
        <ChapterReader chapter={mockChapter} activeTab="summary" />
      </TestWrapper>
    );

    const shareButton = screen.getByTestId('share-button');
    fireEvent.press(shareButton);

    // Wait for error handling
    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith(
        'Share Failed',
        'Unable to share this chapter. Please try again.'
      );
    });

    // Should trigger error haptic feedback
    expect(Haptics.notificationAsync).toHaveBeenCalled();
  });

  it('generates correct share URL for different chapters', async () => {
    const mockShare = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });

    const genesisChapter: ChapterContent = {
      ...mockChapter,
      bookId: 1,
      bookName: 'Genesis',
      chapterNumber: 1,
      title: 'Genesis 1',
      testament: 'OT',
    };

    render(
      <TestWrapper>
        <ChapterReader chapter={genesisChapter} activeTab="summary" />
      </TestWrapper>
    );

    const shareButton = screen.getByTestId('share-button');
    fireEvent.press(shareButton);

    await waitFor(() => {
      expect(mockShare).toHaveBeenCalledWith({
        message: 'Check out Genesis 1 on VerseMate: https://app.versemate.org/bible/1/1',
        url: 'https://app.versemate.org/bible/1/1',
      });
    });
  });
});
