/**
 * The narration-voice control in Settings.
 *
 * The behaviour worth pinning is the offline rule: online you may pick any
 * narrated voice in your language, offline only the ones with chapters on
 * disk — anything else is a control that cannot do what it says.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React, { type ReactNode } from 'react';
import { ScriptureVoiceSetting } from '@/components/bible-brain/ScriptureVoiceSetting';

jest.setTimeout(20_000);

let mockIsOnline = true;
jest.mock('@/contexts/OfflineContext', () => ({
  useOfflineContext: () => ({ isOnline: mockIsOnline }),
}));

let mockVersion = 'NASB1995';
jest.mock('@/hooks/use-bible-version', () => ({
  useBibleVersion: () => ({ bibleVersion: mockVersion, setBibleVersion: jest.fn() }),
}));

let mockVoice: string | null = null;
const mockSetVoice = jest.fn(async (abbr: string | null) => {
  mockVoice = abbr;
});
jest.mock('@/hooks/bible-brain/use-scripture-voice', () => ({
  useScriptureVoice: () => ({
    voiceAbbr: mockVoice,
    setVoiceAbbr: mockSetVoice,
    isLoading: false,
  }),
}));

/** Which filesets have chapters on disk, keyed by fileset id. */
let mockOnDisk: Record<string, number> = {};
jest.mock('@/hooks/bible-brain/use-scripture-download', () => ({
  useScriptureDownload: () => ({
    isDownloading: false,
    completed: 0,
    total: 0,
    currentLabel: null,
    outcome: null,
    error: null,
    download: jest.fn(),
    removeFileset: jest.fn(),
    removeChapters: jest.fn(),
    downloadedChapters: jest.fn(async (filesetId: string) =>
      Array.from({ length: mockOnDisk[filesetId] ?? 0 }, (_, i) => ({
        book: 'JHN',
        chapter: i + 1,
      }))
    ),
    bytesOnDisk: jest.fn(async () => 0),
    reset: jest.fn(),
  }),
}));

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mockIsOnline = true;
  mockVersion = 'NASB1995';
  mockVoice = null;
  mockOnDisk = {};
  mockSetVoice.mockClear();
});

describe('ScriptureVoiceSetting', () => {
  it('offers every narrated voice in the language while online', async () => {
    render(<ScriptureVoiceSetting />, { wrapper });
    await waitFor(() => expect(screen.getByTestId('scripture-voice-toggle')).toBeTruthy());
    fireEvent.press(screen.getByTestId('scripture-voice-toggle'));

    await waitFor(() => expect(screen.getByTestId('scripture-voice-option-ENGESV')).toBeTruthy());
    expect(screen.getByTestId('scripture-voice-option-automatic')).toBeTruthy();
    expect(screen.getByTestId('scripture-voice-option-ENGKJV')).toBeTruthy();
    // Stream-only voices are still choosable — they just cannot be downloaded.
    expect(screen.getByTestId('scripture-voice-option-ENGNLH')).toBeTruthy();
    // Text-only versions have no narration and must not appear.
    expect(screen.queryByTestId('scripture-voice-option-ENGASV')).toBeNull();
  });

  it('stores the chosen voice', async () => {
    render(<ScriptureVoiceSetting />, { wrapper });
    await waitFor(() => expect(screen.getByTestId('scripture-voice-toggle')).toBeTruthy());
    fireEvent.press(screen.getByTestId('scripture-voice-toggle'));
    await waitFor(() => expect(screen.getByTestId('scripture-voice-option-ENGKJV')).toBeTruthy());
    fireEvent.press(screen.getByTestId('scripture-voice-option-ENGKJV'));

    await waitFor(() => expect(mockSetVoice).toHaveBeenCalledWith('ENGKJV'));
  });

  it('goes back to automatic', async () => {
    mockVoice = 'ENGKJV';
    render(<ScriptureVoiceSetting />, { wrapper });
    await waitFor(() => expect(screen.getByTestId('scripture-voice-toggle')).toBeTruthy());
    fireEvent.press(screen.getByTestId('scripture-voice-toggle'));
    await waitFor(() =>
      expect(screen.getByTestId('scripture-voice-option-automatic')).toBeTruthy()
    );
    fireEvent.press(screen.getByTestId('scripture-voice-option-automatic'));

    await waitFor(() => expect(mockSetVoice).toHaveBeenCalledWith(null));
  });

  it('offline, offers only the voices that are downloaded', async () => {
    mockIsOnline = false;
    mockOnDisk = { ENGESVN1DA: 21 };
    render(<ScriptureVoiceSetting />, { wrapper });
    await waitFor(() => expect(screen.getByTestId('scripture-voice-toggle')).toBeTruthy());
    fireEvent.press(screen.getByTestId('scripture-voice-toggle'));

    await waitFor(() => expect(screen.getByTestId('scripture-voice-option-ENGESV')).toBeTruthy());
    expect(screen.queryByTestId('scripture-voice-option-ENGKJV')).toBeNull();
    expect(screen.queryByTestId('scripture-voice-option-ENGNLH')).toBeNull();
  });

  it('offline with nothing downloaded, says so instead of showing an empty list', async () => {
    mockIsOnline = false;
    render(<ScriptureVoiceSetting />, { wrapper });
    await waitFor(() => expect(screen.getByTestId('scripture-voice-toggle')).toBeTruthy());
    fireEvent.press(screen.getByTestId('scripture-voice-toggle'));

    await waitFor(() => expect(screen.getByText(/no narration has been downloaded/i)).toBeTruthy());
    expect(screen.queryByTestId('scripture-voice-option-ENGESV')).toBeNull();
  });

  it('says nothing is available rather than showing a dead control', async () => {
    // German has zero narrated bibles on Bible Brain.
    mockVersion = 'SCH51';
    render(<ScriptureVoiceSetting />, { wrapper });
    await waitFor(() => expect(screen.getByText(/no narrated audio is available/i)).toBeTruthy());
    expect(screen.queryByTestId('scripture-voice-toggle')).toBeNull();
  });
});
