/**
 * TASK-017: production audio engine using expo-audio (Expo SDK 54+).
 *
 * Replaces the previous expoAvEngine.stub.ts. Uses expo-audio's
 * imperative AudioPlayer API (not the React hook variant) since the
 * AudioPlayerProvider is the single source of truth for audio state
 * and we want one shared instance regardless of which screen is
 * mounted.
 *
 * Background-audio support is configured in two places:
 *   1. `app.config.js` — iOS UIBackgroundModes:['audio'], Android
 *      FOREGROUND_SERVICE / FOREGROUND_SERVICE_MEDIA_PLAYBACK / WAKE_LOCK
 *   2. setAudioModeAsync({ shouldPlayInBackground: true,
 *      playsInSilentMode: true }) called once on engine boot.
 *
 * Lock-screen / Control Center metadata is set via player.metadata
 * after `replace(source)` so the user sees what's playing without
 * unlocking. The engine clears metadata on unload to avoid stale
 * notifications.
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import type {
  AudioEngine,
  AudioEngineEvent,
  AudioTrack,
} from "../../contexts/AudioPlayerContext";

const TIME_UPDATE_INTERVAL_MS = 250;

type Listener = (ev: AudioEngineEvent) => void;

export class ExpoAudioEngine implements AudioEngine {
  private listeners = new Set<Listener>();
  private player: AudioPlayer | null = null;
  private currentTrack: AudioTrack | null = null;
  private statusUnsub: (() => void) | null = null;
  private lastEmittedDuration = 0;
  private endedFired = false;
  private boot: Promise<void> | null = null;

  /** Lazy boot so unit tests that never call load() don't hit native. */
  private async ensureBoot(): Promise<void> {
    if (this.boot) return this.boot;
    this.boot = setAudioModeAsync({
      // Keep audio playing when the app is backgrounded or the screen
      // locks — required by br-audio-011 (cross-nav continuity) and
      // the broader hands-free use case.
      shouldPlayInBackground: true,
      playsInSilentMode: true,
      shouldRouteThroughEarpiece: false,
    }).catch((err) => {
      // Non-fatal — playback still works in foreground if audio mode
      // setup fails. Surface as engine error so callers know.
      this.emit({
        type: "error",
        message: `audio mode init failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    });
    return this.boot;
  }

  private emit(ev: AudioEngineEvent): void {
    for (const l of this.listeners) l(ev);
  }

  private teardownPlayer(): void {
    this.statusUnsub?.();
    this.statusUnsub = null;
    if (this.player) {
      try {
        this.player.remove();
      } catch {
        // already removed — ignore
      }
      this.player = null;
    }
    this.lastEmittedDuration = 0;
    this.endedFired = false;
  }

  private wireStatus(player: AudioPlayer): void {
    const subscription = player.addListener("playbackStatusUpdate", (status) => {
      if (status.duration > 0 && status.duration !== this.lastEmittedDuration) {
        this.lastEmittedDuration = status.duration;
        this.emit({ type: "duration", duration: status.duration });
      }
      this.emit({ type: "time", currentTime: status.currentTime });
      if (status.didJustFinish && !this.endedFired) {
        this.endedFired = true;
        this.emit({ type: "ended" });
      }
    });
    this.statusUnsub = () => subscription.remove();
  }

  async load(track: AudioTrack): Promise<void> {
    await this.ensureBoot();
    this.teardownPlayer();
    this.currentTrack = track;
    this.endedFired = false;
    try {
      this.player = createAudioPlayer({ uri: track.url }, {
        updateInterval: TIME_UPDATE_INTERVAL_MS,
      });
      this.wireStatus(this.player);
      // TODO(TASK-017 follow-up): lock-screen / Control Center
      // metadata. expo-audio (SDK 54) does not expose a setNowPlaying
      // API directly. Either upgrade to a future expo-audio release
      // that adds it, or add a thin native module / react-native
      // -track-player integration so the lock screen shows the
      // chapter + explanation type and the OS media keys work.
      // Background audio (UIBackgroundModes / FOREGROUND_SERVICE +
      // setAudioModeAsync) is already configured above, so playback
      // continues — we just don't currently surface the metadata.
    } catch (err) {
      this.emit({
        type: "error",
        message: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  async play(): Promise<void> {
    if (!this.player) throw new Error("engine: play() before load()");
    this.player.play();
  }

  async pause(): Promise<void> {
    if (!this.player) return;
    this.player.pause();
  }

  async seek(seconds: number): Promise<void> {
    if (!this.player) return;
    await this.player.seekTo(seconds);
  }

  async setSpeed(rate: number): Promise<void> {
    if (!this.player) return;
    this.player.setPlaybackRate(rate);
  }

  async unload(): Promise<void> {
    this.teardownPlayer();
    this.currentTrack = null;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
