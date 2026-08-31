/**
 * The download UI must reflect the licence: downloadable versions get a
 * download control, stream-only versions get an explicit "streaming only"
 * label and no download affordance — while both remain selectable to play.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React, { type ReactNode } from 'react';
import { ScriptureVersionPicker } from '@/components/bible-brain/ScriptureVersionPicker';

// The first render in this suite pays the one-off cost of compiling the
// component tree and resolving the first MSW-backed query, which can exceed
// jest's 5s default on slower machines.
jest.setTimeout(20_000);

const mockDownload = jest.fn().mockResolvedValue({
  downloaded: 1,
  skipped: 0,
  notLicensed: [],
  failed: [],
  bytesWritten: 2_196_712,
});

jest.mock('@/hooks/bible-brain/use-scripture-download', () => ({
  useScriptureDownload: () => ({
    isDownloading: false,
    completed: 0,
    total: 0,
    currentLabel: null,
    outcome: null,
    error: null,
    download: mockDownload,
    removeFileset: jest.fn(),
    downloadedChapters: jest.fn().mockResolvedValue([]),
    bytesOnDisk: jest.fn().mockResolvedValue(0),
    reset: jest.fn(),
  }),
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

function renderPicker(onSelect = jest.fn()) {
  render(
    <ScriptureVersionPicker
      language="eng"
      onSelect={onSelect}
      chaptersForDownload={(filesetId) => [{ filesetId, book: 'JHN', chapter: 3 }]}
    />,
    { wrapper }
  );
  return { onSelect };
}

beforeEach(() => {
  mockDownload.mockClear();
  mockShowToast.mockClear();
});

describe('ScriptureVersionPicker', () => {
  it('lists downloadable and stream-only versions in separate sections', async () => {
    renderPicker();
    await waitFor(() => expect(screen.getByTestId('scripture-version-ENGESV')).toBeTruthy());
    expect(screen.getByText('Download for offline')).toBeTruthy();
    expect(screen.getByText('Streaming only')).toBeTruthy();
    expect(screen.getByTestId('scripture-version-ENGNLH')).toBeTruthy();
  });

  it('offers a download control only for licensed versions', async () => {
    renderPicker();
    await waitFor(() => expect(screen.getByTestId('scripture-version-ENGESV')).toBeTruthy());
    expect(screen.getByTestId('scripture-download-ENGESV')).toBeTruthy();
    // NLT is stream-only — no download button may exist for it.
    expect(screen.queryByTestId('scripture-download-ENGNLH')).toBeNull();
  });

  it('labels a stream-only version as such', async () => {
    renderPicker();
    await waitFor(() => expect(screen.getByTestId('scripture-version-ENGNLH')).toBeTruthy());
    expect(screen.getAllByText('streaming only').length).toBeGreaterThan(0);
    expect(screen.getAllByText('available offline').length).toBeGreaterThan(0);
  });

  it('marks versions that follow along with the audio', async () => {
    renderPicker();
    await waitFor(() => expect(screen.getByTestId('scripture-version-ENGESV')).toBeTruthy());
    // ESV and NLT are timed; Berean is not.
    expect(screen.getAllByText('follows along')).toHaveLength(2);
  });

  it('excludes text-only versions entirely', async () => {
    renderPicker();
    await waitFor(() => expect(screen.getByTestId('scripture-version-ENGESV')).toBeTruthy());
    expect(screen.queryByTestId('scripture-version-ENGASV')).toBeNull();
  });

  it('selects a version with the fileset for the testament', async () => {
    const { onSelect } = renderPicker();
    await waitFor(() => expect(screen.getByTestId('scripture-version-ENGESV')).toBeTruthy());
    fireEvent.press(
      screen.getByTestId('scripture-version-ENGESV').findByProps({
        accessibilityRole: 'radio',
      })
    );
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ abbr: 'ENGESV' }),
      'ENGESVN1DA'
    );
  });

  it('downloads the requested chapters and confirms to the user', async () => {
    renderPicker();
    await waitFor(() => expect(screen.getByTestId('scripture-download-ENGESV')).toBeTruthy());
    fireEvent.press(screen.getByTestId('scripture-download-ENGESV'));
    await waitFor(() => expect(mockDownload).toHaveBeenCalledTimes(1));
    expect(mockDownload).toHaveBeenCalledWith([
      { filesetId: 'ENGESVN1DA', book: 'JHN', chapter: 3 },
    ]);
    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith('ENGESV ready to listen offline')
    );
  });

  it('tells the user when the server refuses the download as stream-only', async () => {
    mockDownload.mockResolvedValueOnce({
      downloaded: 0,
      skipped: 0,
      notLicensed: [{ filesetId: 'ENGESVN1DA', book: 'JHN', chapter: 3 }],
      failed: [],
      bytesWritten: 0,
    });
    renderPicker();
    await waitFor(() => expect(screen.getByTestId('scripture-download-ENGESV')).toBeTruthy());
    fireEvent.press(screen.getByTestId('scripture-download-ENGESV'));
    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('ENGESV can only be streamed'));
  });

  it('surfaces partial failures', async () => {
    mockDownload.mockResolvedValueOnce({
      downloaded: 2,
      skipped: 0,
      notLicensed: [],
      failed: [{ ref: { filesetId: 'x', book: 'JHN', chapter: 4 }, reason: 'offline' }],
      bytesWritten: 1,
    });
    renderPicker();
    await waitFor(() => expect(screen.getByTestId('scripture-download-ENGESV')).toBeTruthy());
    fireEvent.press(screen.getByTestId('scripture-download-ENGESV'));
    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('Downloaded 2, 1 failed'));
  });
});
