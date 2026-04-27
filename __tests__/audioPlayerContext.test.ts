/**
 * TASK-009 — reducer unit tests. Confirm the same state-machine
 * guarantees as the web store (br-audio-005 + br-audio-011).
 *
 * Also covers the regression for the stale-closure bug fixed in the
 * verse-mate-web context (await load(); await play() must actually
 * play, not silently no-op because the play callback's closure still
 * holds the pre-LOAD currentTrack: null).
 */
import { act, renderHook } from '@testing-library/react-native';
import React from 'react';
import {
  type AudioEngine,
  type AudioEngineEvent,
  AudioPlayerProvider,
  type AudioTrack,
  audioReducer,
  useAudioPlayer,
} from '../contexts/AudioPlayerContext';

const sample: AudioTrack = {
  audio_id: 'a-1',
  explanation_id: 42,
  url: 'https://cdn.test/audio.mp3',
  duration_seconds: 200,
  voice: 'alloy',
  language_code: 'en',
  explanation_type: 'summary',
  book_id: 1,
  chapter_number: 1,
  tts_provider: 'openai',
  source_href: '/bible/1/1',
};

describe('mobile audioReducer', () => {
  test("LOAD moves to 'loading' and never to 'playing' (br-audio-005)", () => {
    const next = audioReducer(
      {
        currentTrack: null,
        playbackState: 'idle',
        elapsedSeconds: 0,
        durationSeconds: 0,
        speed: 1,
        error: null,
        dockVisible: false,
        fullScreenOpen: false,
      },
      { type: 'LOAD', track: sample }
    );
    expect(next.currentTrack?.audio_id).toBe('a-1');
    expect(next.playbackState).toBe('loading');
    expect(next.dockVisible).toBe(true);
  });

  test('PLAY without a track is a no-op', () => {
    const state = {
      currentTrack: null,
      playbackState: 'idle' as const,
      elapsedSeconds: 0,
      durationSeconds: 0,
      speed: 1,
      error: null,
      dockVisible: false,
      fullScreenOpen: false,
    };
    const next = audioReducer(state, { type: 'PLAY' });
    expect(next.playbackState).toBe('idle');
  });

  test('CLOSE resets except keeps speed', () => {
    const state = {
      currentTrack: sample,
      playbackState: 'playing' as const,
      elapsedSeconds: 100,
      durationSeconds: 200,
      speed: 1.5,
      error: null,
      dockVisible: true,
      fullScreenOpen: true,
    };
    const next = audioReducer(state, { type: 'CLOSE' });
    expect(next.currentTrack).toBeNull();
    expect(next.playbackState).toBe('idle');
    expect(next.speed).toBe(1.5);
    expect(next.dockVisible).toBe(false);
  });
});

function createStubEngine() {
  const calls: string[] = [];
  let listener: ((ev: AudioEngineEvent) => void) | null = null;
  const engine: AudioEngine = {
    async load(_track) {
      calls.push('load');
    },
    async play() {
      calls.push('play');
    },
    async pause() {
      calls.push('pause');
    },
    async seek(_s) {
      calls.push('seek');
    },
    async setSpeed(_r) {
      calls.push('setSpeed');
    },
    async unload() {
      calls.push('unload');
    },
    subscribe(l) {
      listener = l;
      return () => {
        if (listener === l) listener = null;
      };
    },
  };
  return { engine, calls, emit: (ev: AudioEngineEvent) => listener?.(ev) };
}

describe('AudioPlayerProvider — stale-closure regression', () => {
  test('await load(); await play() actually invokes engine.play() and transitions to playing', async () => {
    const { engine, calls } = createStubEngine();
    const onPlaybackStarted = jest.fn();

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(AudioPlayerProvider, { engine, onPlaybackStarted, children });
    const { result } = renderHook(() => useAudioPlayer(), { wrapper });

    // Grab `play` BEFORE load — this mimics the consumer pattern that
    // previously triggered the bug. The play closure must read the
    // current track via the ref, not the stale `state.currentTrack`.
    const playBeforeLoad = result.current.play;

    await act(async () => {
      await result.current.load(sample);
      await playBeforeLoad();
    });

    expect(calls).toEqual(['load', 'play']);
    expect(result.current.playbackState).toBe('playing');
    expect(onPlaybackStarted).toHaveBeenCalledWith(sample, { isResume: false });
  });
});
