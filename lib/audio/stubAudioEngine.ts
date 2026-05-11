/**
 * TASK-009: no-op AudioEngine for tests + local development without a
 * real audio library installed. The production engine lives alongside
 * this file as `expoAvEngine.ts` (to be added once `expo-av` is
 * installed — see tasks.md for the follow-up).
 */
import type {
  AudioEngine,
  AudioEngineEvent,
  AudioTrack,
} from "../../contexts/AudioPlayerContext";

export class StubAudioEngine implements AudioEngine {
  private listeners = new Set<(ev: AudioEngineEvent) => void>();
  private loadedTrack: AudioTrack | null = null;
  private currentTime = 0;

  async load(track: AudioTrack): Promise<void> {
    this.loadedTrack = track;
    this.currentTime = 0;
    this.emit({ type: "duration", duration: track.duration_seconds });
  }

  async play(): Promise<void> {
    if (!this.loadedTrack) throw new Error("No track loaded");
  }

  async pause(): Promise<void> {
    /* no-op */
  }

  async seek(seconds: number): Promise<void> {
    this.currentTime = seconds;
    this.emit({ type: "time", currentTime: seconds });
  }

  async setSpeed(_rate: number): Promise<void> {
    /* no-op */
  }

  async unload(): Promise<void> {
    this.loadedTrack = null;
    this.currentTime = 0;
  }

  subscribe(listener: (ev: AudioEngineEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Test helpers — drive events into the subscriber.
  emit(ev: AudioEngineEvent) {
    for (const l of this.listeners) l(ev);
  }
}
