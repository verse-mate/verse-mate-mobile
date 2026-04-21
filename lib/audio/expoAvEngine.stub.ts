/**
 * TASK-009: production engine stub.
 *
 * The real implementation uses:
 *   - `expo-av` Audio.Sound for playback
 *   - `Audio.setAudioModeAsync({ staysActiveInBackground: true,
 *     playsInSilentModeIOS: true, shouldDuckAndroid: true })` in boot
 *   - lock-screen now-playing metadata via `expo-music-info` or the
 *     MediaSession bridge in `modules/`
 *   - Android foreground-service perm via `app.config.js`
 *     (`android.permissions: ['FOREGROUND_SERVICE', 'WAKE_LOCK']`)
 *   - iOS background-audio via `ios.infoPlist.UIBackgroundModes:
 *     ['audio']`
 *
 * Implementation is skeletoned here so typechecking passes; the actual
 * `expo-av` wiring is deferred to a follow-up commit that adds the
 * dependency and runs `bun install`. See tasks.md TASK-009 status for
 * the manual-verification gate.
 */
import type {
  AudioEngine,
  AudioEngineEvent,
  AudioTrack,
} from "../../contexts/AudioPlayerContext";

export class ExpoAvEngineStub implements AudioEngine {
  private listeners = new Set<(ev: AudioEngineEvent) => void>();

  async load(_track: AudioTrack): Promise<void> {
    throw new Error(
      "[AUDIO] ExpoAvEngine not wired — install expo-av and replace this stub",
    );
  }
  async play(): Promise<void> {
    throw new Error("not implemented");
  }
  async pause(): Promise<void> {
    /* no-op */
  }
  async seek(_s: number): Promise<void> {
    /* no-op */
  }
  async setSpeed(_r: number): Promise<void> {
    /* no-op */
  }
  async unload(): Promise<void> {
    /* no-op */
  }
  subscribe(l: (ev: AudioEngineEvent) => void): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
}
