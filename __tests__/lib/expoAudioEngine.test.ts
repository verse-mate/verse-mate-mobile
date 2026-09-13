/**
 * The production audio engine's disposal contract.
 *
 * expo-audio's `remove()` only unregisters the shared object — neither it nor
 * `sharedObjectWillRelease` touches the underlying AVPlayer. A player dropped
 * without being paused therefore keeps producing sound, which is what made
 * closing the dock leave audio running and turned fast taps on the speaker
 * into several overlapping copies of the same chapter.
 */

import type { ScriptureAudioTrack } from '@/contexts/AudioPlayerContext';
import { ExpoAudioEngine } from '@/lib/audio/expoAudioEngine';

const created: { pause: jest.Mock; play: jest.Mock; remove: jest.Mock; id: number }[] = [];

jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn(async () => undefined),
  createAudioPlayer: jest.fn(() => {
    const player = {
      id: created.length,
      play: jest.fn(),
      pause: jest.fn(),
      remove: jest.fn(),
      seekTo: jest.fn(async () => undefined),
      setPlaybackRate: jest.fn(),
      addListener: jest.fn(() => ({ remove: jest.fn() })),
    };
    created.push(player as never);
    return player;
  }),
}));

function track(chapter: number): ScriptureAudioTrack {
  return {
    kind: 'scripture',
    url: `https://example.test/jhn-${chapter}.mp3`,
    duration_seconds: 100,
    language_code: 'en',
    book_id: 43,
    chapter_number: chapter,
    source_href: `/bible/43/${chapter}`,
    fileset_id: 'ENGESVN1DA',
    book_usfm: 'JHN',
    version_abbr: 'ENGESV',
    version_name: 'English Standard Version®',
    is_offline: false,
  };
}

beforeEach(() => {
  created.length = 0;
});

describe('ExpoAudioEngine disposal', () => {
  it('silences the previous player before replacing it', async () => {
    const engine = new ExpoAudioEngine();
    await engine.load(track(3));
    await engine.play();
    await engine.load(track(4));

    expect(created).toHaveLength(2);
    // The first one must be stopped, not merely unregistered.
    expect(created[0].pause).toHaveBeenCalled();
    expect(created[0].remove).toHaveBeenCalled();
    expect(created[1].pause).not.toHaveBeenCalled();
  });

  it('silences the player on unload, so closing the dock actually stops it', async () => {
    const engine = new ExpoAudioEngine();
    await engine.load(track(3));
    await engine.play();
    await engine.unload();

    expect(created[0].pause).toHaveBeenCalled();
    expect(created[0].remove).toHaveBeenCalled();
  });

  it('leaves exactly one live player when loads overlap', async () => {
    const engine = new ExpoAudioEngine();
    await Promise.all([engine.load(track(3)), engine.load(track(4)), engine.load(track(5))]);

    expect(created).toHaveLength(3);
    // Every player but the last has been silenced and disposed.
    expect(created[0].pause).toHaveBeenCalled();
    expect(created[1].pause).toHaveBeenCalled();
    expect(created[2].pause).not.toHaveBeenCalled();
  });
});
