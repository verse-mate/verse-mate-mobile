/**
 * TASK-017 (br-audio-014): mobile audio analytics helpers.
 *
 * Thin wrappers over `analytics.track(...)` so the AudioPlayerProvider
 * callbacks + AudioFullScreen handlers can fire events without
 * importing the AnalyticsEvent enum every time.
 */
import { analytics } from "./analytics";
import {
  AnalyticsEvent,
  type AudioPlaybackCompletedProperties,
  type AudioPlaybackPausedProperties,
  type AudioPlaybackSeekProperties,
  type AudioPlaybackStartedProperties,
  type AudioSpeedChangedProperties,
} from "./types";

export function trackAudioPlaybackStarted(
  props: AudioPlaybackStartedProperties,
): void {
  analytics.track(AnalyticsEvent.AUDIO_PLAYBACK_STARTED, props);
}

export function trackAudioPlaybackPaused(
  props: AudioPlaybackPausedProperties,
): void {
  analytics.track(AnalyticsEvent.AUDIO_PLAYBACK_PAUSED, props);
}

export function trackAudioPlaybackCompleted(
  props: AudioPlaybackCompletedProperties,
): void {
  analytics.track(AnalyticsEvent.AUDIO_PLAYBACK_COMPLETED, props);
}

export function trackAudioSeek(props: AudioPlaybackSeekProperties): void {
  analytics.track(AnalyticsEvent.AUDIO_PLAYBACK_SEEK, props);
}

export function trackAudioSpeedChanged(
  props: AudioSpeedChangedProperties,
): void {
  analytics.track(AnalyticsEvent.AUDIO_SPEED_CHANGED, props);
}
