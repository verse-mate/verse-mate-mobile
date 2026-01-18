/**
 * WordDefinitionTooltip Component Tests
 *
 * Tests for the word definition tooltip that appears on long press.
 * Tests rendering, loading states, error states, and user interactions.
 */

import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Share } from 'react-native';
import { WordDefinitionTooltip } from '@/components/bible/WordDefinitionTooltip';
import type { StrongsEntry } from '@/types/dictionary';

// Mock expo-haptics
jest.mock('expo-haptics');

// Mock expo-clipboard
jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(undefined),
}));

// Mock react-native Share
jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });

// Mock lexicon-service
const mockLookup = jest.fn();
const mockIsValidStrongsNumber = jest.fn();
jest.mock('@/services/lexicon-service', () => ({
  lookup: (...args: unknown[]) => mockLookup(...args),
  isValidStrongsNumber: (...args: unknown[]) => mockIsValidStrongsNumber(...args),
}));

// Mock word-mapping-service
const mockHasStrongsNumber = jest.fn();
const mockGetStrongsNumber = jest.fn();
jest.mock('@/services/word-mapping-service', () => ({
  hasStrongsNumber: (...args: unknown[]) => mockHasStrongsNumber(...args),
  getStrongsNumber: (...args: unknown[]) => mockGetStrongsNumber(...args),
}));

// Mock native dictionary hook
const mockShowDefinition = jest.fn();
const mockHasDefinition = jest.fn();
jest.mock('@/hooks/use-native-dictionary', () => ({
  useNativeDictionary: () => ({
    showDefinition: mockShowDefinition,
    hasDefinition: mockHasDefinition,
    isAvailable: true,
  }),
}));

// Mock useSafeAreaInsets
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }),
}));

// Mock useDeviceInfo
jest.mock('@/hooks/use-device-info', () => ({
  useDeviceInfo: () => ({
    isTablet: false,
    useSplitView: false,
    splitRatio: 0.5,
    splitViewMode: 'left-full',
  }),
}));

// Mock useBibleVersion
jest.mock('@/hooks/use-bible-version', () => ({
  useBibleVersion: () => ({
    bibleVersion: 'KJV',
  }),
}));

// Mock ThemeContext
jest.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({
    mode: 'light',
    colors: {
      gold: '#D4AF37',
      textPrimary: '#1A1A1A',
      textSecondary: '#666666',
      background: '#FFFFFF',
      backgroundElevated: '#F5F5F5',
      border: '#E0E0E0',
      divider: '#EEEEEE',
      backdrop: 'rgba(0,0,0,0.5)',
      white: '#FFFFFF',
    },
  }),
}));

// Sample Strong's entry for testing
const mockStrongsEntry: StrongsEntry = {
  id: 'G26',
  lemma: '\u1F00\u03B3\u03AC\u03C0\u03B7',
  definition: 'Love, affection, good-will, benevolence',
  derivation: 'From G25',
  kjvTranslation: 'love, charity, dear, charitably',
};

describe('WordDefinitionTooltip', () => {
  const defaultProps = {
    visible: true,
    word: 'love',
    bookName: 'John',
    chapterNumber: 3,
    verseNumber: 16,
    onClose: jest.fn(),
    onCopy: jest.fn(),
    useModal: false, // Use View overlay for easier testing
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Default mock implementations
    mockHasStrongsNumber.mockReturnValue(false);
    mockGetStrongsNumber.mockReturnValue(null);
    mockIsValidStrongsNumber.mockReturnValue(false);
    mockLookup.mockResolvedValue({ found: false, entry: null });
    mockHasDefinition.mockResolvedValue(false);
    mockShowDefinition.mockResolvedValue(true);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Rendering', () => {
    it('should not render when word is empty', () => {
      const { queryByTestId } = render(<WordDefinitionTooltip {...defaultProps} word="" />);

      expect(queryByTestId('word-definition-tooltip')).toBeNull();
    });

    it('should render tooltip when visible with word', async () => {
      const { getByTestId } = render(<WordDefinitionTooltip {...defaultProps} />);

      // Run timers to allow animations to start
      jest.runAllTimers();

      await waitFor(() => {
        expect(getByTestId('word-definition-tooltip')).toBeTruthy();
      });
    });

    it('should display header title', async () => {
      const { getByText } = render(<WordDefinitionTooltip {...defaultProps} />);

      jest.runAllTimers();

      await waitFor(() => {
        expect(getByText('Word Definition')).toBeTruthy();
      });
    });

    it('should render action buttons', async () => {
      mockHasDefinition.mockResolvedValue(true);
      mockLookup.mockResolvedValue({ found: true, entry: mockStrongsEntry });
      mockHasStrongsNumber.mockReturnValue(true);
      mockGetStrongsNumber.mockReturnValue('G26');

      const { getByTestId } = render(<WordDefinitionTooltip {...defaultProps} />);

      jest.runAllTimers();

      await waitFor(() => {
        expect(getByTestId('word-definition-copy-button')).toBeTruthy();
        expect(getByTestId('word-definition-share-button')).toBeTruthy();
        expect(getByTestId('word-definition-cancel-button')).toBeTruthy();
      });
    });
  });

  describe('Loading State', () => {
    it('should show loading indicator while fetching definition', async () => {
      // Make lookup take time
      mockLookup.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ found: false }), 1000))
      );

      const { getByText } = render(<WordDefinitionTooltip {...defaultProps} />);

      jest.runAllTimers();

      await waitFor(() => {
        expect(getByText('Looking up definition...')).toBeTruthy();
      });
    });
  });

  describe('Error State', () => {
    it('should show error when no definition available', async () => {
      mockLookup.mockResolvedValue({ found: false, entry: null });
      mockHasDefinition.mockResolvedValue(false);

      const { getByText } = render(<WordDefinitionTooltip {...defaultProps} />);

      jest.runAllTimers();

      await waitFor(() => {
        expect(getByText('No definition available')).toBeTruthy();
      });
    });

    it('should show error when lookup fails', async () => {
      // Use implementation that throws to ensure rejection is caught
      mockLookup.mockImplementation(() => Promise.reject(new Error('Network error')));
      mockHasDefinition.mockImplementation(() => Promise.reject(new Error('Network error')));

      const { getByText } = render(<WordDefinitionTooltip {...defaultProps} />);

      // Advance timers and flush promises
      await jest.runAllTimersAsync();

      await waitFor(() => {
        expect(getByText('Failed to load definition')).toBeTruthy();
      });
    });
  });

  describe("Strong's Definition", () => {
    beforeEach(() => {
      mockHasStrongsNumber.mockReturnValue(true);
      mockGetStrongsNumber.mockReturnValue('G26');
      mockLookup.mockResolvedValue({ found: true, entry: mockStrongsEntry });
      mockHasDefinition.mockResolvedValue(false);
    });

    it('should display word title capitalized', async () => {
      const { getByText } = render(<WordDefinitionTooltip {...defaultProps} word="love" />);

      jest.runAllTimers();

      await waitFor(() => {
        expect(getByText('Love')).toBeTruthy();
      });
    });

    it("should display Strong's number badge", async () => {
      const { getByText } = render(<WordDefinitionTooltip {...defaultProps} />);

      jest.runAllTimers();

      await waitFor(() => {
        expect(getByText('G26')).toBeTruthy();
      });
    });

    it('should display lemma (original word)', async () => {
      const { getByText } = render(<WordDefinitionTooltip {...defaultProps} />);

      jest.runAllTimers();

      await waitFor(() => {
        expect(getByText(mockStrongsEntry.lemma)).toBeTruthy();
      });
    });

    it('should display definition text', async () => {
      const { getByText } = render(<WordDefinitionTooltip {...defaultProps} />);

      jest.runAllTimers();

      await waitFor(() => {
        expect(getByText(mockStrongsEntry.definition)).toBeTruthy();
      });
    });

    it('should display derivation when available', async () => {
      const { getByText } = render(<WordDefinitionTooltip {...defaultProps} />);

      jest.runAllTimers();

      await waitFor(() => {
        expect(getByText('Derivation:')).toBeTruthy();
        expect(getByText(mockStrongsEntry.derivation ?? '')).toBeTruthy();
      });
    });

    it('should display KJV translation when available', async () => {
      const { getByText } = render(<WordDefinitionTooltip {...defaultProps} />);

      jest.runAllTimers();

      await waitFor(() => {
        expect(getByText('KJV:')).toBeTruthy();
        expect(getByText(mockStrongsEntry.kjvTranslation ?? '')).toBeTruthy();
      });
    });

    it('should display verse reference', async () => {
      const { getByText } = render(<WordDefinitionTooltip {...defaultProps} />);

      jest.runAllTimers();

      await waitFor(() => {
        expect(getByText('John 3:16')).toBeTruthy();
      });
    });
  });

  describe('Native Dictionary', () => {
    it('should show native dictionary button when available', async () => {
      mockHasDefinition.mockResolvedValue(true);
      mockLookup.mockResolvedValue({ found: false, entry: null });

      const { getByTestId } = render(<WordDefinitionTooltip {...defaultProps} />);

      jest.runAllTimers();

      await waitFor(() => {
        expect(getByTestId('word-definition-native-button')).toBeTruthy();
      });
    });

    it('should call showDefinition when native button pressed', async () => {
      mockHasDefinition.mockResolvedValue(true);
      mockLookup.mockResolvedValue({ found: false, entry: null });

      const { getByTestId } = render(<WordDefinitionTooltip {...defaultProps} />);

      jest.runAllTimers();

      await waitFor(() => {
        expect(getByTestId('word-definition-native-button')).toBeTruthy();
      });

      fireEvent.press(getByTestId('word-definition-native-button'));

      // Wait for async handler to complete
      await waitFor(() => {
        expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
        expect(mockShowDefinition).toHaveBeenCalledWith('love');
      });
    });
  });

  describe('User Interactions', () => {
    beforeEach(() => {
      mockHasStrongsNumber.mockReturnValue(true);
      mockGetStrongsNumber.mockReturnValue('G26');
      mockLookup.mockResolvedValue({ found: true, entry: mockStrongsEntry });
      mockHasDefinition.mockResolvedValue(false);
    });

    it('should copy definition to clipboard when copy button pressed', async () => {
      const onCopy = jest.fn();
      const { getByTestId } = render(<WordDefinitionTooltip {...defaultProps} onCopy={onCopy} />);

      jest.runAllTimers();

      await waitFor(() => {
        expect(getByTestId('word-definition-copy-button')).toBeTruthy();
      });

      fireEvent.press(getByTestId('word-definition-copy-button'));

      // Wait for async handler to complete
      await waitFor(() => {
        expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
        expect(Clipboard.setStringAsync).toHaveBeenCalled();
      });

      // Verify clipboard content includes word and definition
      const clipboardCall = (Clipboard.setStringAsync as jest.Mock).mock.calls[0][0];
      expect(clipboardCall).toContain('Love');
      expect(clipboardCall).toContain('G26');
      expect(clipboardCall).toContain('Definition:');
      expect(clipboardCall).toContain('John 3:16');
    });

    it('should share definition when share button pressed', async () => {
      const { getByTestId } = render(<WordDefinitionTooltip {...defaultProps} />);

      jest.runAllTimers();

      await waitFor(() => {
        expect(getByTestId('word-definition-share-button')).toBeTruthy();
      });

      fireEvent.press(getByTestId('word-definition-share-button'));

      // Wait for async handler to complete
      await waitFor(() => {
        expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
        expect(Share.share).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Love - Word Definition',
          })
        );
      });

      // Verify share content
      const shareCall = (Share.share as jest.Mock).mock.calls[0][0];
      expect(shareCall.message).toContain('Love');
      expect(shareCall.message).toContain('Definition:');
    });

    it('should call onClose when cancel button pressed', async () => {
      const onClose = jest.fn();
      const { getByTestId } = render(<WordDefinitionTooltip {...defaultProps} onClose={onClose} />);

      jest.runAllTimers();

      await waitFor(() => {
        expect(getByTestId('word-definition-cancel-button')).toBeTruthy();
      });

      fireEvent.press(getByTestId('word-definition-cancel-button'));

      // Allow animation to complete
      jest.runAllTimers();

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });
  });

  describe("Strong's Number Detection", () => {
    it('should look up word mapping first', async () => {
      mockHasStrongsNumber.mockReturnValue(true);
      mockGetStrongsNumber.mockReturnValue('H430');
      mockLookup.mockResolvedValue({ found: true, entry: { ...mockStrongsEntry, id: 'H430' } });

      render(<WordDefinitionTooltip {...defaultProps} word="God" />);

      jest.runAllTimers();

      await waitFor(() => {
        expect(mockHasStrongsNumber).toHaveBeenCalledWith('God');
        expect(mockGetStrongsNumber).toHaveBeenCalledWith('God');
        expect(mockLookup).toHaveBeenCalledWith('H430');
      });
    });

    it("should detect if word itself is a Strong's number", async () => {
      mockHasStrongsNumber.mockReturnValue(false);
      mockIsValidStrongsNumber.mockReturnValue(true);
      mockLookup.mockResolvedValue({ found: true, entry: mockStrongsEntry });

      render(<WordDefinitionTooltip {...defaultProps} word="g26" />);

      jest.runAllTimers();

      await waitFor(() => {
        expect(mockIsValidStrongsNumber).toHaveBeenCalledWith('g26');
        expect(mockLookup).toHaveBeenCalledWith('G26');
      });
    });
  });

  describe('Visibility Changes', () => {
    it('should not fetch definition when not visible', () => {
      render(<WordDefinitionTooltip {...defaultProps} visible={false} />);

      jest.runAllTimers();

      expect(mockLookup).not.toHaveBeenCalled();
      expect(mockHasDefinition).not.toHaveBeenCalled();
    });

    it('should fetch definition when becoming visible', async () => {
      mockHasStrongsNumber.mockReturnValue(true);
      mockGetStrongsNumber.mockReturnValue('G26');

      const { rerender } = render(<WordDefinitionTooltip {...defaultProps} visible={false} />);

      expect(mockLookup).not.toHaveBeenCalled();

      rerender(<WordDefinitionTooltip {...defaultProps} visible={true} />);

      jest.runAllTimers();

      await waitFor(() => {
        expect(mockLookup).toHaveBeenCalled();
      });
    });
  });
});
