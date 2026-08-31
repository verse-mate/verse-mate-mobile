/**
 * Regression guard: resume-progress must stay an explanation-only concern.
 *
 * `useAudioProgress` persists a resume position keyed on `explanation_id`.
 * Scripture narration has no explanation row, so if a scripture track ever
 * reached that hook it would read and write progress against an id that does
 * not exist. The track union makes that a type error; this test makes it a
 * behavioural guarantee too, because the failure would otherwise be silent.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import React, { type ReactNode } from 'react';
import {
  AudioPlayerProvider,
  type ExplanationAudioTrack,
  useAudioPlayer,
} from '@/contexts/AudioPlayerContext';
import { useAudioProgress } from '@/hooks/audio/useAudioProgress';
import { useScriptureAudio } from '@/hooks/bible-brain/use-scripture-audio';
import { StubAudioEngine } from '@/lib/audio/stubAudioEngine';
import type { ScriptureStoragePort } from '@/lib/bible-brain/scripture-storage';

jest.mock('@/lib/audio/audioApi', () => ({
  fetchProgress: jest.fn().mockResolvedValue(null),
  saveProgress: jest.fn().mockResolvedValue(undefined),
}));

const audioApi = require('@/lib/audio/audioApi') as {
  fetchProgress: jest.Mock;
  saveProgress: jest.Mock;
};

const storage: ScriptureStoragePort = {
  rootUri: null,
  async exists() {
    return false;
  },
  async ensureDir() {},
  async download() {
    return { size: null };
  },
  async remove() {},
  async list() {
    return [];
  },
  async sizeOf() {
    return null;
  },
};

const explanationTrack: ExplanationAudioTrack = {
  kind: 'explanation',
  audio_id: 'exp-42',
  explanation_id: 42,
  url: 'https://cdn.test/exp.mp3',
  duration_seconds: 120,
  voice: 'nova',
  language_code: 'en',
  explanation_type: 'summary',
  book_id: 43,
  chapter_number: 3,
  tts_provider: 'openai',
  source_href: '/bible/43/3',
};

function harness() {
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
    progress: useAudioProgress(),
  });
  return { engine, Wrapper, hook };
}

beforeEach(() => {
  audioApi.fetchProgress.mockClear();
  audioApi.saveProgress.mockClear();
});

describe('resume progress vs scripture narration', () => {
  it('does not fetch a resume position for a scripture track', async () => {
    const { Wrapper, hook } = harness();
    const { result } = renderHook(hook, { wrapper: Wrapper });

    await act(async () => {
      await result.current.scripture.playChapter({
        filesetId: 'ENGESVN1DA',
        book: 'JHN',
        chapter: 3,
        bookId: 43,
        versionAbbr: 'ENGESV',
        versionName: 'ESV',
        languageCode: 'en',
        sourceHref: '/bible/43/3',
      });
    });

    expect(result.current.player.currentTrack?.kind).toBe('scripture');
    expect(audioApi.fetchProgress).not.toHaveBeenCalled();
  });

  it('does not save progress when scripture playback pauses', async () => {
    const { Wrapper, hook } = harness();
    const { result } = renderHook(hook, { wrapper: Wrapper });

    await act(async () => {
      await result.current.scripture.playChapter({
        filesetId: 'ENGESVN1DA',
        book: 'JHN',
        chapter: 3,
        bookId: 43,
        versionAbbr: 'ENGESV',
        versionName: 'ESV',
        languageCode: 'en',
        sourceHref: '/bible/43/3',
      });
    });
    await act(async () => {
      await result.current.player.pause();
    });

    expect(audioApi.saveProgress).not.toHaveBeenCalled();
  });

  it('still fetches a resume position for an explanation track', async () => {
    // Proves the guard narrowed by kind rather than disabling the hook wholesale.
    const { Wrapper, hook } = harness();
    const { result } = renderHook(hook, { wrapper: Wrapper });

    await act(async () => {
      await result.current.player.load(explanationTrack);
    });

    await waitFor(() => expect(audioApi.fetchProgress).toHaveBeenCalledWith(42));
  });
});
