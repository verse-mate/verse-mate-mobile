/**
 * TASK-009 — reducer unit tests. Confirm the same state-machine
 * guarantees as the web store (br-audio-005 + br-audio-011).
 */
import { type AudioTrack, audioReducer } from '../contexts/AudioPlayerContext';

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
