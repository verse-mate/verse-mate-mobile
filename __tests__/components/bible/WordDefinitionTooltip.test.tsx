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
import type { DictionaryResult, StrongsEntry } from '@/types/dictionary';

// Mock expo-haptics
jest.mock('expo-haptics');

// Mock expo-clipboard
jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(undefined),
}));

// Mock react-native Share
jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });

// Mock dictionary-service
const mockLookupWord = jest.fn();
jest.mock('@/services/dictionary-service', () => ({
  lookupWord: (...args: unknown[]) => mockLookupWord(...args),
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

// Sample Easton's entry for testing
const mockEastonEntry = {
  term: 'Love',
  definition: 'This word seems to require explanation only in the case of its use by our Lord.',
  scriptureRefs: ['John 21:16', 'John 21:17', '1 Cor 13'],
  seeAlso: ['agape', 'charity'],
};

// Helper to create DictionaryResult
function makeDictResult(overrides: Partial<DictionaryResult> = {}): DictionaryResult {
  return {
    word: 'love',
    hasNativeDefinition: false,
    source: 'none',
    ...overrides,
  };
}

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

    // Default: no definition found
    mockLookupWord.mockResolvedValue(makeDictResult());
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
      mockLookupWord.mockResolvedValue(
        makeDictResult({
          source: 'strongs',
          strongsNumber: 'G26',
          strongsEntry: mockStrongsEntry,
        })
      );
      mockHasDefinition.mockResolvedValue(true);

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
      mockLookupWord.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(makeDictResult()), 1000))
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
      mockLookupWord.mockResolvedValue(makeDictResult());
      mockHasDefinition.mockResolvedValue(false);

      const { getByText } = render(<WordDefinitionTooltip {...defaultProps} />);

      jest.runAllTimers();

      await waitFor(() => {
        expect(getByText('No definition available')).toBeTruthy();
      });
    });

    it('should show error when lookup fails', async () => {
      mockLookupWord.mockImplementation(() => Promise.reject(new Error('Network error')));
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
      mockLookupWord.mockResolvedValue(
        makeDictResult({
          source: 'strongs',
          strongsNumber: 'G26',
          strongsEntry: mockStrongsEntry,
        })
      );
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

  describe("Easton's Definition", () => {
    beforeEach(() => {
      mockLookupWord.mockResolvedValue(
        makeDictResult({
          source: 'easton',
          eastonEntry: mockEastonEntry,
        })
      );
      mockHasDefinition.mockResolvedValue(false);
    });

    it("should display Easton's source badge", async () => {
      const { getByTestId, getByText } = render(<WordDefinitionTooltip {...defaultProps} />);

      jest.runAllTimers();

      await waitFor(() => {
        expect(getByTestId('easton-source-badge')).toBeTruthy();
        expect(getByText("Easton's Bible Dictionary")).toBeTruthy();
      });
    });

    it("should display Easton's definition text", async () => {
      const { getByText } = render(<WordDefinitionTooltip {...defaultProps} />);

      jest.runAllTimers();

      await waitFor(() => {
        expect(getByText(mockEastonEntry.definition)).toBeTruthy();
      });
    });

    it('should display scripture references when present', async () => {
      const { getByTestId, getByText } = render(<WordDefinitionTooltip {...defaultProps} />);

      jest.runAllTimers();

      await waitFor(() => {
        expect(getByTestId('easton-scripture-refs')).toBeTruthy();
        expect(getByText('Scripture References:')).toBeTruthy();
        expect(getByText('John 21:16, John 21:17, 1 Cor 13')).toBeTruthy();
      });
    });

    it('should display see-also chips when present', async () => {
      const { getByTestId, getByText } = render(<WordDefinitionTooltip {...defaultProps} />);

      jest.runAllTimers();

      await waitFor(() => {
        expect(getByTestId('easton-see-also')).toBeTruthy();
        expect(getByText('See Also:')).toBeTruthy();
        expect(getByText('agape')).toBeTruthy();
        expect(getByText('charity')).toBeTruthy();
      });
    });

    it('should not show scripture refs when empty', async () => {
      mockLookupWord.mockResolvedValue(
        makeDictResult({
          source: 'easton',
          eastonEntry: { ...mockEastonEntry, scriptureRefs: undefined },
        })
      );

      const { queryByTestId } = render(<WordDefinitionTooltip {...defaultProps} />);

      jest.runAllTimers();

      await waitFor(() => {
        expect(queryByTestId('easton-scripture-refs')).toBeNull();
      });
    });

    it('should not show see-also when empty', async () => {
      mockLookupWord.mockResolvedValue(
        makeDictResult({
          source: 'easton',
          eastonEntry: { ...mockEastonEntry, seeAlso: undefined },
        })
      );

      const { queryByTestId } = render(<WordDefinitionTooltip {...defaultProps} />);

      jest.runAllTimers();

      await waitFor(() => {
        expect(queryByTestId('easton-see-also')).toBeNull();
      });
    });

    it("should include Easton's attribution in share content", async () => {
      const { getByTestId } = render(<WordDefinitionTooltip {...defaultProps} />);

      jest.runAllTimers();

      await waitFor(() => {
        expect(getByTestId('word-definition-copy-button')).toBeTruthy();
      });

      fireEvent.press(getByTestId('word-definition-copy-button'));

      await waitFor(() => {
        expect(Clipboard.setStringAsync).toHaveBeenCalled();
      });

      const clipboardCall = (Clipboard.setStringAsync as jest.Mock).mock.calls[0][0];
      expect(clipboardCall).toContain("Easton's Bible Dictionary");
      expect(clipboardCall).toContain(mockEastonEntry.definition);
    });
  });

  describe('Native Dictionary', () => {
    it('should show native dictionary button when available', async () => {
      mockHasDefinition.mockResolvedValue(true);

      const { getByTestId } = render(<WordDefinitionTooltip {...defaultProps} />);

      jest.runAllTimers();

      await waitFor(() => {
        expect(getByTestId('word-definition-native-button')).toBeTruthy();
      });
    });

    it('should call showDefinition when native button pressed', async () => {
      mockHasDefinition.mockResolvedValue(true);

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
      mockLookupWord.mockResolvedValue(
        makeDictResult({
          source: 'strongs',
          strongsNumber: 'G26',
          strongsEntry: mockStrongsEntry,
        })
      );
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

  describe('Dictionary Service Integration', () => {
    it('should call lookupWord with the word', async () => {
      render(<WordDefinitionTooltip {...defaultProps} word="God" />);

      jest.runAllTimers();

      await waitFor(() => {
        expect(mockLookupWord).toHaveBeenCalledWith('God');
      });
    });
  });

  describe('Visibility Changes', () => {
    it('should not fetch definition when not visible', () => {
      render(<WordDefinitionTooltip {...defaultProps} visible={false} />);

      jest.runAllTimers();

      expect(mockLookupWord).not.toHaveBeenCalled();
      expect(mockHasDefinition).not.toHaveBeenCalled();
    });

    it('should fetch definition when becoming visible', async () => {
      const { rerender } = render(<WordDefinitionTooltip {...defaultProps} visible={false} />);

      expect(mockLookupWord).not.toHaveBeenCalled();

      rerender(<WordDefinitionTooltip {...defaultProps} visible={true} />);

      jest.runAllTimers();

      await waitFor(() => {
        expect(mockLookupWord).toHaveBeenCalled();
      });
    });
  });
});
