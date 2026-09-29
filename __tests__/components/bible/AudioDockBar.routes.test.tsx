/**
 * Where the audio dock is allowed to appear.
 *
 * The dock is mounted above the navigator on purpose, so playback survives
 * screen changes (br-audio-011). It stays out of the Jesus feature (its OWN
 * reader — a bar reading "JHN 19" under a Luke 2 event contradicts it) and
 * out of settings.
 *
 * Paused, not stopped: where the bar is hidden, playback pauses (audio with no
 * control on screen could not be paused), but the track is kept so the bar is
 * back, paused, in the reader.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  AudioDockBar,
  claimsDrag,
  dockHiddenOn,
  isDismissDrag,
} from '@/components/bible/AudioDockBar';
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
    mockPlayer.close.mockClear();
    mockPlayer.pause.mockClear();
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

  it('pauses playback where the bar is hidden, and keeps the track', () => {
    // Audio playing on with no control on screen could not be paused from
    // there. Pause, never close: the track must survive for the return.
    for (const path of ['/settings', '/jesus/event/x']) {
      mockPlayer.pause.mockClear();
      mockPathname = path;
      const view = renderDock();
      expect(mockPlayer.pause).toHaveBeenCalledTimes(1);
      expect(mockPlayer.close).not.toHaveBeenCalled();
      expect(mockPlayer.currentTrack).toBe(track);
      view.unmount();
    }
  });

  it('does not pause in the reader', () => {
    mockPlayer.pause.mockClear();
    mockPathname = '/bible/43/19';
    renderDock();
    expect(mockPlayer.pause).not.toHaveBeenCalled();
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

  it('stays out of settings and the pages opened from it (Andy, build 119)', () => {
    for (const path of ['/settings', '/manage-downloads', '/widget-info']) {
      mockPathname = path;
      const view = renderDock();
      expect(screen.queryByTestId('audio-dock-play-toggle')).toBeNull();
      view.unmount();
    }
    expect(mockPlayer.close).not.toHaveBeenCalled();
  });

  it('matches whole route segments, not any path that shares a prefix', () => {
    expect(dockHiddenOn('/settings')).toBe(true);
    expect(dockHiddenOn('/jesus/event/x')).toBe(true);
    expect(dockHiddenOn('/settingsx')).toBe(false);
    expect(dockHiddenOn('/bible/43/19')).toBe(false);
    expect(dockHiddenOn(undefined)).toBe(false);
  });
});

describe('AudioDockBar swipe down to dismiss', () => {
  beforeEach(() => {
    mockPathname = '/bible/43/19';
    mockPlayer.currentTrack = track;
    mockPlayer.dockVisible = true;
    mockPlayer.close.mockClear();
    mockPlayer.pause.mockClear();
  });

  it('dismisses on a long or fast downward drag, not a short one', () => {
    expect(isDismissDrag(60, 0)).toBe(true);
    expect(isDismissDrag(10, 1.2)).toBe(true);
    expect(isDismissDrag(20, 0.1)).toBe(false);
    expect(isDismissDrag(-80, 0)).toBe(false);
  });

  it('only claims clearly vertical downward drags, so taps and sideways moves pass', () => {
    expect(claimsDrag(0, 20)).toBe(true);
    expect(claimsDrag(0, 4)).toBe(false);
    expect(claimsDrag(40, 20)).toBe(false);
    expect(claimsDrag(0, -20)).toBe(false);
  });

  it('keeps taps working — play does not close the player', () => {
    renderDock();
    expect(screen.getByTestId('audio-dock').props.onMoveShouldSetResponder).toBeDefined();
    fireEvent.press(screen.getByTestId('audio-dock-play-toggle'));
    expect(mockPlayer.pause).toHaveBeenCalled();
    expect(mockPlayer.close).not.toHaveBeenCalled();
  });
});
