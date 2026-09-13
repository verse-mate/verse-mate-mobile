/**
 * The narration control in the reader header. It is only an icon — version,
 * verse and scrubber belong to the player dock — so these tests are about
 * when it appears and what a tap does.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React, { type ReactNode } from 'react';
import { ScriptureAudioButton } from '@/components/bible-brain/ScriptureAudioButton';

jest.setTimeout(20_000);

let mockVersion = 'KJV';
jest.mock('@/hooks/use-bible-version', () => ({
  useBibleVersion: () => ({ bibleVersion: mockVersion, setBibleVersion: jest.fn() }),
}));

const mockPlayChapter = jest.fn().mockResolvedValue(undefined);
const mockPause = jest.fn().mockResolvedValue(undefined);
const mockPlay = jest.fn().mockResolvedValue(undefined);
let mockTrack: Record<string, unknown> | null = null;
let mockPlaybackState = 'idle';

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
  useScriptureAudio: () => ({ playChapter: mockPlayChapter, isPreparing: false, error: null }),
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
  mockVersion = 'KJV';
});

describe('ScriptureAudioButton', () => {
  it('appears for a language that has narration', async () => {
    render(<ScriptureAudioButton bookId={43} chapterNumber={3} />, { wrapper });
    await waitFor(() => expect(screen.getByTestId('scripture-audio-button')).toBeTruthy());
  });

  it('renders nothing for German, which has no narration at all', async () => {
    mockVersion = 'SCH51';
    render(<ScriptureAudioButton bookId={43} chapterNumber={3} />, { wrapper });
    // A dead control is worse than no control.
    await waitFor(() => expect(screen.queryByTestId('scripture-audio-button')).toBeNull());
  });

  it('plays the chapter in the translation being read', async () => {
    render(<ScriptureAudioButton bookId={43} chapterNumber={3} />, { wrapper });
    await waitFor(() => expect(screen.getByTestId('scripture-audio-button')).toBeTruthy());
    fireEvent.press(screen.getByTestId('scripture-audio-button'));

    await waitFor(() => expect(mockPlayChapter).toHaveBeenCalledTimes(1));
    expect(mockPlayChapter.mock.calls[0][0]).toMatchObject({
      filesetId: 'ENGKJVN1DA',
      versionAbbr: 'ENGKJV',
      book: 'JHN',
      chapter: 3,
      bookId: 43,
    });
  });

  it('picks the Old Testament fileset for an OT chapter', async () => {
    render(<ScriptureAudioButton bookId={1} chapterNumber={1} />, { wrapper });
    await waitFor(() => expect(screen.getByTestId('scripture-audio-button')).toBeTruthy());
    fireEvent.press(screen.getByTestId('scripture-audio-button'));
    await waitFor(() => expect(mockPlayChapter).toHaveBeenCalled());
    expect(mockPlayChapter.mock.calls[0][0]).toMatchObject({
      filesetId: 'ENGKJVO1DA',
      book: 'GEN',
    });
  });

  it('pauses rather than restarting when this chapter is already playing', async () => {
    mockTrack = { kind: 'scripture', book_usfm: 'JHN', chapter_number: 3 };
    mockPlaybackState = 'playing';
    render(<ScriptureAudioButton bookId={43} chapterNumber={3} />, { wrapper });
    await waitFor(() => expect(screen.getByTestId('scripture-audio-button')).toBeTruthy());
    fireEvent.press(screen.getByTestId('scripture-audio-button'));
    await waitFor(() => expect(mockPause).toHaveBeenCalledTimes(1));
    expect(mockPlayChapter).not.toHaveBeenCalled();
  });

  it('resumes without re-fetching when loaded but paused', async () => {
    mockTrack = { kind: 'scripture', book_usfm: 'JHN', chapter_number: 3 };
    mockPlaybackState = 'paused';
    render(<ScriptureAudioButton bookId={43} chapterNumber={3} />, { wrapper });
    await waitFor(() => expect(screen.getByTestId('scripture-audio-button')).toBeTruthy());
    fireEvent.press(screen.getByTestId('scripture-audio-button'));
    await waitFor(() => expect(mockPlay).toHaveBeenCalledTimes(1));
    expect(mockPlayChapter).not.toHaveBeenCalled();
  });

  it('renders nothing for an unknown book', async () => {
    render(<ScriptureAudioButton bookId={999} chapterNumber={1} />, { wrapper });
    await waitFor(() => expect(screen.queryByTestId('scripture-audio-button')).toBeNull());
  });
});
