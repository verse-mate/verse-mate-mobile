/**
 * The Manage Downloads section. Asserts the licence split reaches the screen:
 * downloadable versions expand into a per-book download list (with the
 * copyright notice the licence requires), stream-only versions are listed but
 * offer no download.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React, { type ReactNode } from 'react';
import { ScriptureAudioSection } from '@/components/bible-brain/ScriptureAudioSection';

jest.setTimeout(20_000);

const mockDownload = jest.fn().mockResolvedValue({
  downloaded: 21,
  skipped: 0,
  notLicensed: [],
  failed: [],
  bytesWritten: 21 * 2_196_712,
});
const mockDownloadedChapters = jest.fn().mockResolvedValue([]);
const mockRemoveFileset = jest.fn().mockResolvedValue(21);
const mockRemoveChapters = jest.fn().mockResolvedValue(50);

jest.mock('@/hooks/bible-brain/use-scripture-download', () => ({
  useScriptureDownload: () => ({
    isDownloading: false,
    completed: 0,
    total: 0,
    currentLabel: null,
    outcome: null,
    error: null,
    download: mockDownload,
    removeFileset: mockRemoveFileset,
    removeChapters: mockRemoveChapters,
    downloadedChapters: mockDownloadedChapters,
    bytesOnDisk: jest.fn().mockResolvedValue(0),
    reset: jest.fn(),
  }),
}));

let mockVersion = 'KJV';
jest.mock('@/hooks/use-bible-version', () => ({
  useBibleVersion: () => ({ bibleVersion: mockVersion, setBibleVersion: jest.fn() }),
}));

const mockShowToast = jest.fn();
jest.mock('@/contexts/ToastContext', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mockDownload.mockClear();
  mockShowToast.mockClear();
  mockDownloadedChapters.mockClear();
  mockRemoveFileset.mockClear();
  mockRemoveChapters.mockClear();
  mockVersion = 'KJV';
});

describe('ScriptureAudioSection', () => {
  it('lists only downloadable versions as selectable', async () => {
    render(<ScriptureAudioSection />, { wrapper });
    await waitFor(() => expect(screen.getByTestId('scripture-audio-version-ENGESV')).toBeTruthy());
    expect(screen.getByTestId('scripture-audio-version-ENGBER')).toBeTruthy();
    // NLT is stream-only: listed, but with no download affordance.
    expect(screen.getByText('streaming only')).toBeTruthy();
    expect(screen.getByTestId('scripture-audio-version-ENGNLH')).toBeTruthy();
  });

  it('expands into a per-book list with the copyright notice', async () => {
    render(<ScriptureAudioSection />, { wrapper });
    await waitFor(() => expect(screen.getByTestId('scripture-audio-version-ENGESV')).toBeTruthy());
    fireEvent.press(screen.getByTestId('scripture-audio-version-ENGESV'));

    await waitFor(() => expect(screen.getByTestId('scripture-audio-books-ENGESV')).toBeTruthy());
    // Licence term 3: the copyright must be viewable.
    await waitFor(() => expect(screen.getByTestId('scripture-copyright-ENGESV')).toBeTruthy());
    // Book 43 is John.
    expect(screen.getByTestId('scripture-audio-download-43')).toBeTruthy();
  });

  it('downloads exactly the chapters of the chosen book', async () => {
    render(<ScriptureAudioSection />, { wrapper });
    await waitFor(() => expect(screen.getByTestId('scripture-audio-version-ENGESV')).toBeTruthy());
    fireEvent.press(screen.getByTestId('scripture-audio-version-ENGESV'));
    await waitFor(() => expect(screen.getByTestId('scripture-audio-download-43')).toBeTruthy());
    fireEvent.press(screen.getByTestId('scripture-audio-download-43'));

    await waitFor(() => expect(mockDownload).toHaveBeenCalledTimes(1));
    const refs = mockDownload.mock.calls[0][0];
    expect(refs).toHaveLength(21); // John has 21 chapters
    expect(refs[0]).toEqual({
      filesetId: 'ENGESVN1DA',
      book: 'JHN',
      chapter: 1,
    });
    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('John available offline'));
  });

  it('shows a book already on disk as complete rather than downloadable', async () => {
    // 21 chapters of John present = the book is complete.
    mockDownloadedChapters.mockResolvedValueOnce(
      Array.from({ length: 21 }, (_, i) => ({ book: 'JHN', chapter: i + 1 }))
    );
    render(<ScriptureAudioSection />, { wrapper });
    await waitFor(() => expect(screen.getByTestId('scripture-audio-version-ENGESV')).toBeTruthy());
    fireEvent.press(screen.getByTestId('scripture-audio-version-ENGESV'));
    await waitFor(() => expect(screen.getByTestId('scripture-audio-delete-43')).toBeTruthy());
    expect(screen.queryByTestId('scripture-audio-download-43')).toBeNull();
  });

  it('reports a partially failed book download', async () => {
    mockDownload.mockResolvedValueOnce({
      downloaded: 19,
      skipped: 0,
      notLicensed: [],
      failed: [
        { ref: { filesetId: 'ENGESVN1DA', book: 'JHN', chapter: 20 }, reason: 'offline' },
        { ref: { filesetId: 'ENGESVN1DA', book: 'JHN', chapter: 21 }, reason: 'offline' },
      ],
      bytesWritten: 1,
    });
    render(<ScriptureAudioSection />, { wrapper });
    await waitFor(() => expect(screen.getByTestId('scripture-audio-version-ENGESV')).toBeTruthy());
    fireEvent.press(screen.getByTestId('scripture-audio-version-ENGESV'));
    await waitFor(() => expect(screen.getByTestId('scripture-audio-download-43')).toBeTruthy());
    fireEvent.press(screen.getByTestId('scripture-audio-download-43'));
    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('John: 2 chapter(s) failed'));
  });

  it('downloads an Old Testament book from the OT fileset, not the NT one', async () => {
    // Regression: the section used to resolve one fileset (`…N1DA`) for every
    // book, so every OT download asked the New Testament fileset for Genesis
    // and got a 404 back from Bible Brain.
    render(<ScriptureAudioSection />, { wrapper });
    await waitFor(() => expect(screen.getByTestId('scripture-audio-version-ENGESV')).toBeTruthy());
    fireEvent.press(screen.getByTestId('scripture-audio-version-ENGESV'));
    await waitFor(() => expect(screen.getByTestId('scripture-audio-download-1')).toBeTruthy());
    fireEvent.press(screen.getByTestId('scripture-audio-download-1'));

    await waitFor(() => expect(mockDownload).toHaveBeenCalledTimes(1));
    const refs = mockDownload.mock.calls[0][0];
    expect(refs).toHaveLength(50); // Genesis has 50 chapters
    expect(refs[0]).toEqual({ filesetId: 'ENGESVO1DA', book: 'GEN', chapter: 1 });
  });

  it('offers only New Testament books for a version narrated for the NT alone', async () => {
    render(<ScriptureAudioSection />, { wrapper });
    await waitFor(() => expect(screen.getByTestId('scripture-audio-version-ENGBER')).toBeTruthy());
    fireEvent.press(screen.getByTestId('scripture-audio-version-ENGBER'));
    await waitFor(() => expect(screen.getByTestId('scripture-audio-books-ENGBER')).toBeTruthy());
    // John is there; Genesis must not be, since ENGBER has no OT fileset.
    expect(screen.getByTestId('scripture-audio-download-43')).toBeTruthy();
    expect(screen.queryByTestId('scripture-audio-download-1')).toBeNull();
  });

  it('removes one book without deleting the rest of the testament', async () => {
    mockDownloadedChapters.mockResolvedValue(
      Array.from({ length: 50 }, (_, i) => ({ book: 'GEN', chapter: i + 1 }))
    );
    render(<ScriptureAudioSection />, { wrapper });
    await waitFor(() => expect(screen.getByTestId('scripture-audio-version-ENGESV')).toBeTruthy());
    fireEvent.press(screen.getByTestId('scripture-audio-version-ENGESV'));
    await waitFor(() => expect(screen.getByTestId('scripture-audio-delete-1')).toBeTruthy());
    fireEvent.press(screen.getByTestId('scripture-audio-delete-1'));

    await waitFor(() => expect(mockRemoveChapters).toHaveBeenCalledTimes(1));
    expect(mockRemoveFileset).not.toHaveBeenCalled();
    const refs = mockRemoveChapters.mock.calls[0][0];
    expect(refs).toHaveLength(50);
    expect(refs[0]).toEqual({ filesetId: 'ENGESVO1DA', book: 'GEN', chapter: 1 });
    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('Genesis narration removed'));
  });

  it("downloads a whole testament in one tap, from that testament's fileset", async () => {
    render(<ScriptureAudioSection />, { wrapper });
    await waitFor(() => expect(screen.getByTestId('scripture-audio-version-ENGESV')).toBeTruthy());
    fireEvent.press(screen.getByTestId('scripture-audio-version-ENGESV'));
    await waitFor(() => expect(screen.getByTestId('scripture-audio-download-all-NT')).toBeTruthy());
    fireEvent.press(screen.getByTestId('scripture-audio-download-all-NT'));

    await waitFor(() => expect(mockDownload).toHaveBeenCalledTimes(1));
    const refs = mockDownload.mock.calls[0][0];
    expect(refs).toHaveLength(260); // 27 NT books
    expect(refs.every((r: { filesetId: string }) => r.filesetId === 'ENGESVN1DA')).toBe(true);
    expect(refs[0]).toEqual({ filesetId: 'ENGESVN1DA', book: 'MAT', chapter: 1 });
  });

  it('downloads the whole Bible as one OT run and one NT run', async () => {
    render(<ScriptureAudioSection />, { wrapper });
    await waitFor(() => expect(screen.getByTestId('scripture-audio-version-ENGESV')).toBeTruthy());
    fireEvent.press(screen.getByTestId('scripture-audio-version-ENGESV'));
    await waitFor(() =>
      expect(screen.getByTestId('scripture-audio-download-all-ALL')).toBeTruthy()
    );
    fireEvent.press(screen.getByTestId('scripture-audio-download-all-ALL'));

    // Two runs, because a fileset covers one testament and no more.
    await waitFor(() => expect(mockDownload).toHaveBeenCalledTimes(2));
    expect(mockDownload.mock.calls[0][0][0].filesetId).toBe('ENGESVO1DA');
    expect(mockDownload.mock.calls[1][0][0].filesetId).toBe('ENGESVN1DA');
    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith('Whole Bible available offline')
    );
  });

  it('offers no whole-Bible option for a version narrated for the NT alone', async () => {
    render(<ScriptureAudioSection />, { wrapper });
    await waitFor(() => expect(screen.getByTestId('scripture-audio-version-ENGBER')).toBeTruthy());
    fireEvent.press(screen.getByTestId('scripture-audio-version-ENGBER'));
    await waitFor(() => expect(screen.getByTestId('scripture-audio-download-all-NT')).toBeTruthy());
    expect(screen.queryByTestId('scripture-audio-download-all-ALL')).toBeNull();
    expect(screen.queryByTestId('scripture-audio-download-all-OT')).toBeNull();
  });

  it('collapses the book list when the version is tapped again', async () => {
    render(<ScriptureAudioSection />, { wrapper });
    await waitFor(() => expect(screen.getByTestId('scripture-audio-version-ENGESV')).toBeTruthy());
    fireEvent.press(screen.getByTestId('scripture-audio-version-ENGESV'));
    await waitFor(() => expect(screen.getByTestId('scripture-audio-books-ENGESV')).toBeTruthy());
    fireEvent.press(screen.getByTestId('scripture-audio-version-ENGESV'));
    await waitFor(() => expect(screen.queryByTestId('scripture-audio-books-ENGESV')).toBeNull());
  });
});
