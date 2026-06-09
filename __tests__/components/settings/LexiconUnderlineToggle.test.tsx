/**
 * LexiconUnderlineToggle Component Tests
 *
 * The Settings → Reading toggle for lexicon underlines (MOBILE-1001 #7).
 * Verifies it reflects the persisted preference and updates it on interaction.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type React from 'react';
import { LexiconUnderlineToggle } from '@/components/settings/LexiconUnderlineToggle';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { __TEST_ONLY_RESET_CACHE } from '@/hooks/bible/use-lexicon-underlines';

const STORAGE_KEY = '@versemate:lexicon_underlines';

const renderWithTheme = (component: React.ReactElement) =>
  render(<ThemeProvider>{component}</ThemeProvider>);

describe('LexiconUnderlineToggle', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    __TEST_ONLY_RESET_CACHE();
  });

  afterEach(async () => {
    await AsyncStorage.clear();
  });

  it('renders the switch in the on state by default', async () => {
    renderWithTheme(<LexiconUnderlineToggle />);

    const toggle = await screen.findByTestId('lexicon-underline-toggle');
    await waitFor(() => {
      expect(toggle.props.value).toBe(true);
    });
  });

  it('turning it off updates the switch and persists the preference', async () => {
    renderWithTheme(<LexiconUnderlineToggle />);

    const toggle = await screen.findByTestId('lexicon-underline-toggle');

    await act(async () => {
      fireEvent(toggle, 'valueChange', false);
    });

    await waitFor(() => {
      expect(toggle.props.value).toBe(false);
    });
    expect(await AsyncStorage.getItem(STORAGE_KEY)).toBe('false');
  });
});
