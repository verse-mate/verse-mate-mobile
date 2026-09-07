/**
 * The reader's Listen control: picks a verse-timed version when one exists,
 * plays the chapter on screen, and surfaces the follow-along verse.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React, { type ReactNode } from 'react';
import { ScriptureListenBar } from '@/components/bible-brain/ScriptureListenBar';

jest.setTimeout(20_000);

const mockPlayChapter = jest.fn().mockResolvedValue(undefined);
const mockPause = jest.fn().mockResolvedValue(undefined);
const mockPlay = jest.fn().mockResolvedValue(undefined);

let mockTrack: Record<string, unknown> | null = null;
let mockPlaybackState = 'idle';
let mockActiveVerse: number | null = null;
let mockHasTiming = false;

jest.mock('@/contexts/AudioPlayerContext', () => ({
  useAudioPlayer: () => ({
    currentTrack: mockTrack,
    playbackState: mockPlaybackState,
    pause: mockPause,
    play: mockPlay,
  }),
  isScriptureTrack: (t: { kind?: string } | null) => t?.kind === 'scripture',
}));

jest.mock('@/hooks/bible-brain/use-scripture-audio', () => ({
  useScriptureAudio: () => ({
    playChapter: mockPlayChapter,
    isPreparing: false,
    error: null,
  }),
}));

jest.mock('@/hooks/bible-brain/use-verse-sync', () => ({
  useVerseSync: () => ({
    activeVerse: mockActiveVerse,
    hasTiming: mockHasTiming,
    timestamps: [],
    seekToVerse: jest.fn(),
    isLoading: false,
  }),
}));

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mockPlayChapter.mockClear();
  mockPause.mockClear();
  mockPlay.mockClear();
  mockTrack = null;
  mockPlaybackState = 'idle';
  mockActiveVerse = null;
  mockHasTiming = false;
});

describe('ScriptureListenBar', () => {
  it('offers Listen for a New Testament chapter', async () => {
    // John = book 43, NT.
    render(<ScriptureListenBar bookId={43} chapterNumber={3} />, { wrapper });
    await waitFor(() => expect(screen.getByTestId('scripture-listen-bar')).toBeTruthy());
    expect(screen.getByText('Listen')).toBeTruthy();
  });

  it('plays the chapter on screen with a verse-timed fileset', async () => {
    render(<ScriptureListenBar bookId={43} chapterNumber={3} />, { wrapper });
    await waitFor(() => expect(screen.getByTestId('scripture-listen-toggle')).toBeTruthy());
    fireEvent.press(screen.getByTestId('scripture-listen-toggle'));

    await waitFor(() => expect(mockPlayChapter).toHaveBeenCalledTimes(1));
    const args = mockPlayChapter.mock.calls[0][0];
    // EN1ESV's NT fileset IS timed, so the first candidate is kept. JHN is the
    // USFM code for book 43.
    expect(args).toMatchObject({
      filesetId: 'ENGESHN1DA',
      book: 'JHN',
      chapter: 3,
      bookId: 43,
      versionAbbr: 'EN1ESV',
    });
  });

  it('skips a fileset with no timing for this chapter and takes the next', async () => {
    // Regression: `has_verse_timing` is a VERSION flag, but timing lives per
    // fileset. EN1ESV reports timing (its NT fileset has it) while its OT
    // fileset ENGESHO1DA has none for Genesis — picking on the version flag
    // alone silently lost follow-along for the whole Old Testament.
    render(<ScriptureListenBar bookId={1} chapterNumber={1} />, { wrapper });
    await waitFor(() => expect(screen.getByTestId('scripture-listen-toggle')).toBeTruthy());
    fireEvent.press(screen.getByTestId('scripture-listen-toggle'));

    await waitFor(() => expect(mockPlayChapter).toHaveBeenCalledTimes(1));
    expect(mockPlayChapter.mock.calls[0][0]).toMatchObject({
      // Falls through EN1ESV's untimed ENGESHO1DA to ESV's timed OT fileset.
      filesetId: 'ENGESVO1DA',
      versionAbbr: 'ENGESV',
      book: 'GEN',
    });
  });

  it('pauses instead of restarting when this chapter is already playing', async () => {
    mockTrack = { kind: 'scripture', book_usfm: 'JHN', chapter_number: 3, is_offline: false };
    mockPlaybackState = 'playing';
    render(<ScriptureListenBar bookId={43} chapterNumber={3} />, { wrapper });
    await waitFor(() => expect(screen.getByText('Pause')).toBeTruthy());
    fireEvent.press(screen.getByTestId('scripture-listen-toggle'));
    await waitFor(() => expect(mockPause).toHaveBeenCalledTimes(1));
    expect(mockPlayChapter).not.toHaveBeenCalled();
  });

  it('resumes without re-fetching when the chapter is loaded but paused', async () => {
    mockTrack = { kind: 'scripture', book_usfm: 'JHN', chapter_number: 3, is_offline: false };
    mockPlaybackState = 'paused';
    render(<ScriptureListenBar bookId={43} chapterNumber={3} />, { wrapper });
    await waitFor(() => expect(screen.getByTestId('scripture-listen-toggle')).toBeTruthy());
    fireEvent.press(screen.getByTestId('scripture-listen-toggle'));
    await waitFor(() => expect(mockPlay).toHaveBeenCalledTimes(1));
    expect(mockPlayChapter).not.toHaveBeenCalled();
  });

  it('shows the follow-along verse while this chapter narrates', async () => {
    mockTrack = { kind: 'scripture', book_usfm: 'JHN', chapter_number: 3, is_offline: false };
    mockPlaybackState = 'playing';
    mockHasTiming = true;
    mockActiveVerse = 16;
    render(<ScriptureListenBar bookId={43} chapterNumber={3} />, { wrapper });
    await waitFor(() => expect(screen.getByTestId('scripture-active-verse')).toBeTruthy());
    expect(screen.getByText('verse 16')).toBeTruthy();
  });

  it('marks playback as offline when serving a downloaded file', async () => {
    mockTrack = { kind: 'scripture', book_usfm: 'JHN', chapter_number: 3, is_offline: true };
    mockPlaybackState = 'playing';
    render(<ScriptureListenBar bookId={43} chapterNumber={3} />, { wrapper });
    await waitFor(() => expect(screen.getByText(/offline/)).toBeTruthy());
  });

  it('renders nothing for a book id that does not exist', async () => {
    render(<ScriptureListenBar bookId={999} chapterNumber={1} />, { wrapper });
    await waitFor(() => expect(screen.queryByTestId('scripture-listen-bar')).toBeNull());
  });
});
