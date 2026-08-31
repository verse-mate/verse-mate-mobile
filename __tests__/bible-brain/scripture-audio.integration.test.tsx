/**
 * End-to-end-ish integration: play a narrated chapter through the real audio
 * player, follow it with verse sync, and download it under the real licence
 * rules — all against the MSW fixtures that mirror production.
 *
 * The player runs on StubAudioEngine so time can be driven deterministically
 * instead of waiting on real audio.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import React, { type ReactNode } from 'react';
import {
  AudioPlayerProvider,
  isScriptureTrack,
  trackDisplayLabel,
  useAudioPlayer,
} from '@/contexts/AudioPlayerContext';
import { useScriptureAudio } from '@/hooks/bible-brain/use-scripture-audio';
import { useScriptureDownload } from '@/hooks/bible-brain/use-scripture-download';
import { useVerseSync } from '@/hooks/bible-brain/use-verse-sync';
import { StubAudioEngine } from '@/lib/audio/stubAudioEngine';
import {
  chapterFileUri,
  type DownloadOutcome,
  type ScriptureStoragePort,
} from '@/lib/bible-brain/scripture-storage';
import { MOCK_SIGNED_AUDIO_URL } from '../mocks/handlers/bible-brain.handlers';

const ROOT = 'file:///documents';

function makeStorage(seed: string[] = []) {
  const files = new Set(seed);
  const downloaded: string[] = [];
  const port: ScriptureStoragePort = {
    rootUri: ROOT,
    async exists(uri) {
      return files.has(uri);
    },
    async ensureDir() {},
    async download(_url, destUri) {
      files.add(destUri);
      downloaded.push(destUri);
      return { size: 2_196_712 };
    },
    async remove(uri) {
      files.delete(uri);
    },
    async list(dirUri) {
      return [...files]
        .filter((f) => f.startsWith(`${dirUri}/`))
        .map((f) => f.slice(dirUri.length + 1));
    },
    async sizeOf(uri) {
      return files.has(uri) ? 2_196_712 : null;
    },
  };
  return { port, files, downloaded };
}

const ESV_JOHN_3 = {
  filesetId: 'ENGESVN1DA',
  book: 'JHN',
  chapter: 3,
  bookId: 43,
  versionAbbr: 'ENGESV',
  versionName: 'English Standard Version®',
  languageCode: 'en',
  sourceHref: '/bible/43/3',
};

function harness(storage: ScriptureStoragePort) {
  const engine = new StubAudioEngine();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AudioPlayerProvider engine={engine}>{children}</AudioPlayerProvider>
      </QueryClientProvider>
    );
  }
  const hook = () => ({
    player: useAudioPlayer(),
    scripture: useScriptureAudio(storage),
    sync: useVerseSync(),
    download: useScriptureDownload(storage),
  });
  return { engine, Wrapper, hook };
}

describe('scripture playback', () => {
  it('streams a chapter and exposes it as a scripture track', async () => {
    const { port } = makeStorage();
    const { Wrapper, hook } = harness(port);
    const { result } = renderHook(hook, { wrapper: Wrapper });

    await act(async () => {
      await result.current.scripture.playChapter(ESV_JOHN_3);
    });

    const track = result.current.player.currentTrack;
    expect(isScriptureTrack(track)).toBe(true);
    if (!isScriptureTrack(track)) throw new Error('expected scripture track');
    expect(track.url).toBe(MOCK_SIGNED_AUDIO_URL);
    expect(track.is_offline).toBe(false);
    expect(track.fileset_id).toBe('ENGESVN1DA');
    expect(track.book_usfm).toBe('JHN');
    expect(track.duration_seconds).toBe(273);
    expect(result.current.player.playbackState).toBe('playing');
  });

  it('plays the downloaded file when one exists, and says so', async () => {
    const local = chapterFileUri(ROOT, {
      filesetId: 'ENGESVN1DA',
      book: 'JHN',
      chapter: 3,
    });
    const { port } = makeStorage([local]);
    const { Wrapper, hook } = harness(port);
    const { result } = renderHook(hook, { wrapper: Wrapper });

    await act(async () => {
      await result.current.scripture.playChapter(ESV_JOHN_3);
    });

    const track = result.current.player.currentTrack;
    if (!isScriptureTrack(track)) throw new Error('expected scripture track');
    expect(track.url).toBe(local);
    expect(track.is_offline).toBe(true);
  });

  it('labels the player with the version and reference, not an explanation type', async () => {
    const { port } = makeStorage();
    const { Wrapper, hook } = harness(port);
    const { result } = renderHook(hook, { wrapper: Wrapper });
    await act(async () => {
      await result.current.scripture.playChapter(ESV_JOHN_3);
    });
    const track = result.current.player.currentTrack;
    if (!track) throw new Error('no track');
    expect(trackDisplayLabel(track)).toEqual({
      primary: 'English Standard Version®',
      secondary: 'JHN 3',
    });
  });
});

describe('verse sync', () => {
  it('advances the active verse as the audio plays', async () => {
    const { port } = makeStorage();
    const { engine, Wrapper, hook } = harness(port);
    const { result } = renderHook(hook, { wrapper: Wrapper });

    await act(async () => {
      await result.current.scripture.playChapter(ESV_JOHN_3);
    });
    await waitFor(() => expect(result.current.sync.hasTiming).toBe(true));

    // Before verse 1 begins (v1 starts at 2.78s).
    act(() => engine.emit({ type: 'time', currentTime: 1 }));
    expect(result.current.sync.activeVerse).toBeNull();

    act(() => engine.emit({ type: 'time', currentTime: 3 }));
    expect(result.current.sync.activeVerse).toBe(1);

    act(() => engine.emit({ type: 'time', currentTime: 21 }));
    expect(result.current.sync.activeVerse).toBe(3);

    act(() => engine.emit({ type: 'time', currentTime: 48 }));
    expect(result.current.sync.activeVerse).toBe(6);
  });

  it('seeks playback to a tapped verse', async () => {
    const { port } = makeStorage();
    const { Wrapper, hook } = harness(port);
    const { result } = renderHook(hook, { wrapper: Wrapper });

    await act(async () => {
      await result.current.scripture.playChapter(ESV_JOHN_3);
    });
    await waitFor(() => expect(result.current.sync.hasTiming).toBe(true));

    await act(async () => {
      await result.current.sync.seekToVerse(5);
    });
    expect(result.current.player.elapsedSeconds).toBeCloseTo(38.19, 2);
    expect(result.current.sync.activeVerse).toBe(5);
  });

  it('is inert when no scripture track is loaded', () => {
    const { port } = makeStorage();
    const { Wrapper, hook } = harness(port);
    const { result } = renderHook(hook, { wrapper: Wrapper });
    expect(result.current.sync.activeVerse).toBeNull();
    expect(result.current.sync.hasTiming).toBe(false);
  });
});

describe('download honours the Bible Brain licence', () => {
  it('downloads a licensed version', async () => {
    const { port, downloaded } = makeStorage();
    const { Wrapper, hook } = harness(port);
    const { result } = renderHook(hook, { wrapper: Wrapper });

    let outcome: DownloadOutcome | null = null;
    await act(async () => {
      outcome = await result.current.download.download([
        { filesetId: 'ENGESVN1DA', book: 'JHN', chapter: 3 },
        { filesetId: 'ENGESVN1DA', book: 'JHN', chapter: 4 },
      ]);
    });

    expect(outcome).toMatchObject({ downloaded: 2, notLicensed: [], failed: [] });
    expect(downloaded).toHaveLength(2);
  });

  it('reports a stream-only version instead of failing', async () => {
    // ENGNLHN1DA (NLT) answers 404 on /download in production.
    const { port, downloaded } = makeStorage();
    const { Wrapper, hook } = harness(port);
    const { result } = renderHook(hook, { wrapper: Wrapper });

    let captured: DownloadOutcome | null = null;
    await act(async () => {
      captured = await result.current.download.download([
        { filesetId: 'ENGNLHN1DA', book: 'JHN', chapter: 3 },
      ]);
    });
    // Re-widened deliberately: control-flow analysis cannot see the assignment
    // inside the async act() callback, so it narrows `captured` back to null.
    const outcome = captured as DownloadOutcome | null;

    expect(outcome).toMatchObject({ downloaded: 0, failed: [] });
    expect(outcome?.notLicensed).toHaveLength(1);
    expect(downloaded).toEqual([]);
    expect(result.current.download.error).toBeNull();
  });

  it('a stream-only version still plays', async () => {
    const { port } = makeStorage();
    const { Wrapper, hook } = harness(port);
    const { result } = renderHook(hook, { wrapper: Wrapper });

    await act(async () => {
      await result.current.scripture.playChapter({
        ...ESV_JOHN_3,
        filesetId: 'ENGNLHN1DA',
        versionAbbr: 'ENGNLH',
        versionName: 'New Living Translation®',
      });
    });
    const track = result.current.player.currentTrack;
    if (!isScriptureTrack(track)) throw new Error('expected scripture track');
    expect(track.url).toBe(MOCK_SIGNED_AUDIO_URL);
    expect(track.is_offline).toBe(false);
    expect(result.current.player.playbackState).toBe('playing');
  });

  it('tracks progress through a multi-chapter download', async () => {
    const { port } = makeStorage();
    const { Wrapper, hook } = harness(port);
    const { result } = renderHook(hook, { wrapper: Wrapper });

    await act(async () => {
      await result.current.download.download([
        { filesetId: 'ENGESVN1DA', book: 'JHN', chapter: 1 },
        { filesetId: 'ENGESVN1DA', book: 'JHN', chapter: 2 },
      ]);
    });
    expect(result.current.download.completed).toBe(2);
    expect(result.current.download.total).toBe(2);
    expect(result.current.download.isDownloading).toBe(false);
  });

  it('deletes a version and reports what is left on disk', async () => {
    const local = chapterFileUri(ROOT, {
      filesetId: 'ENGESVN1DA',
      book: 'JHN',
      chapter: 3,
    });
    const { port } = makeStorage([local]);
    const { Wrapper, hook } = harness(port);
    const { result } = renderHook(hook, { wrapper: Wrapper });

    await waitFor(async () => {
      expect(await result.current.download.downloadedChapters('ENGESVN1DA')).toHaveLength(1);
    });
    await act(async () => {
      const removed = await result.current.download.removeFileset('ENGESVN1DA');
      expect(removed).toBe(1);
    });
    expect(await result.current.download.downloadedChapters('ENGESVN1DA')).toEqual([]);
  });
});
