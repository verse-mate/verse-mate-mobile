/**
 * TASK-017: mobile counterpart of the web AudioPlayerRoot.
 *
 * Mounts inside AudioPlayerProvider — hosts the always-on
 * useAudioProgress hook so periodic save + app-state save run for
 * the entire playback lifecycle (per the v2.0 review fix on web).
 *
 * Renders the persistent dock bar + the full-screen modal. The
 * Bible reading screen mounts <AudioInlineEntry /> separately.
 */
import { useAudioPlayer } from '@/contexts/AudioPlayerContext';
import { useAudioProgress } from '@/hooks/audio/useAudioProgress';
import { AudioDockBar } from './AudioDockBar';
import { AudioFullScreen } from './AudioFullScreen';

export function MobileAudioPlayerRoot() {
  const player = useAudioPlayer();
  // Disable when no track loaded (saves no-ops anyway, but skip the
  // fetch call entirely).
  const progress = useAudioProgress({ disabled: !player.currentTrack });

  return (
    <>
      <AudioDockBar />
      <AudioFullScreen
        resumeProgress={progress.resumeProgress}
        consumeResume={progress.consumeResume}
        dismissResume={progress.dismissResume}
      />
    </>
  );
}
