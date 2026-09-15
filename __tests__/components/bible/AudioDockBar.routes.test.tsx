/**
 * Where the audio dock is allowed to appear.
 *
 * The dock is mounted above the navigator on purpose, so playback survives
 * screen changes (br-audio-011). That is right for the reader, the hub and
 * settings. It is wrong for the Jesus feature, which is its OWN reader with
 * its own passages on screen — a bar reading "JHN 19" pinned under a Luke 2
 * event is a second reading context contradicting the first. Reported as
 * "audio should disappear".
 *
 * Hidden, not stopped: nothing asked for playback to end, and closing the
 * track would punish someone who only wanted to look something up mid-chapter.
 * These tests pin that distinction — the dock must vanish while the player
 * keeps its track.
 */
import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AudioDockBar } from '@/components/bible/AudioDockBar';
import type { AudioTrack } from '@/contexts/AudioPlayerContext';
import { ThemeProvider } from '@/contexts/ThemeContext';

let mockPathname = '/bible/42/2';
jest.mock('expo-router', () => ({
  usePathname: () => mockPathname,
}));

const track: AudioTrack = {
  kind: 'scripture',
  url: 'https://cdn.test/jhn19.mp3',
  duration_seconds: 363,
  language_code: 'en',
  book_id: 43,
  chapter_number: 19,
  source_href: '/bible/43/19',
  fileset_id: 'ENGESVN1DA',
  book_usfm: 'JHN',
  version_abbr: 'ENGESV',
  version_name: 'English Standard Version',
  is_offline: false,
};

const mockPlayer = {
  currentTrack: track as AudioTrack | null,
  playbackState: 'playing' as const,
  elapsedSeconds: 27,
  durationSeconds: 363,
  speed: 1.25,
  dockVisible: true,
  play: jest.fn(),
  pause: jest.fn(),
  setSpeed: jest.fn(),
  openFullScreen: jest.fn(),
  close: jest.fn(),
};

jest.mock('@/contexts/AudioPlayerContext', () => {
  const actual = jest.requireActual('@/contexts/AudioPlayerContext');
  return {
    ...actual,
    useAudioPlayer: () => mockPlayer,
  };
});

jest.mock('@/contexts/BottomBarInsetContext', () => ({
  useBottomBarInset: () => 0,
}));

jest.mock('@/src/api', () => ({
  useBibleTestaments: () => ({ data: [{ id: 43, name: 'John' }] }),
}));

/** The dock reads theme tokens and the safe-area inset; both need a provider. */
function renderDock() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 59, left: 0, right: 0, bottom: 34 },
      }}
    >
      <ThemeProvider>
        <AudioDockBar />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

describe('AudioDockBar route visibility', () => {
  beforeEach(() => {
    mockPlayer.currentTrack = track;
    mockPlayer.dockVisible = true;
  });

  it('shows in the reader', () => {
    mockPathname = '/bible/43/19';
    renderDock();
    expect(screen.queryByTestId('audio-dock-play-toggle')).toBeTruthy();
  });

  it('disappears on a Jesus event — the reported bug', () => {
    mockPathname = '/jesus/event/the-boy-in-the-temple';
    renderDock();
    expect(screen.queryByTestId('audio-dock-play-toggle')).toBeNull();
  });

  it('disappears everywhere under /jesus, not just the event screen', () => {
    for (const path of ['/jesus', '/jesus/browse/commands', '/jesus/study/x']) {
      mockPathname = path;
      const view = renderDock();
      expect(screen.queryByTestId('audio-dock-play-toggle')).toBeNull();
      view.unmount();
    }
  });

  it('hides the dock without touching playback', () => {
    // The whole point of "hidden, not stopped".
    mockPathname = '/jesus/event/x';
    renderDock();
    expect(mockPlayer.close).not.toHaveBeenCalled();
    expect(mockPlayer.pause).not.toHaveBeenCalled();
    expect(mockPlayer.currentTrack).toBe(track);
  });

  it('comes back on the way out of the Jesus feature', () => {
    mockPathname = '/jesus/event/x';
    const view = renderDock();
    expect(screen.queryByTestId('audio-dock-play-toggle')).toBeNull();
    view.unmount();

    mockPathname = '/bible/43/19';
    renderDock();
    expect(screen.queryByTestId('audio-dock-play-toggle')).toBeTruthy();
  });

  it('names the book rather than the USFM code the fileset is addressed by', () => {
    // The bar shipped reading "JHN 19"; the spec asked for "Mark 8".
    mockPathname = '/bible/43/19';
    renderDock();
    expect(screen.getByText('John 19')).toBeTruthy();
    expect(screen.queryByText(/JHN/)).toBeNull();
  });
});
