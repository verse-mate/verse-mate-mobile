/**
 * TASK-009: mobile audio player context.
 *
 * Mirrors the web `useAudioPlayerStore` — single-track state machine
 * with the same br-audio-005 guarantee (never auto-play on load).
 * Native playback goes through an injected AudioEngine so this file
 * can be tested headless. The production engine in
 * `lib/audio/expoAudioEngine.ts` wires the player to expo-audio's
 * AudioPlayer + setAudioModeAsync({ shouldPlayInBackground: true }).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";

export interface AudioTrack {
  audio_id: string;
  explanation_id: number;
  url: string;
  duration_seconds: number;
  voice: string;
  language_code: string;
  explanation_type: string;
  book_id: number;
  chapter_number: number;
  tts_provider: string;
  source_href: string;
}

export type AudioPlaybackState =
  | "idle"
  | "loading"
  | "ready"
  | "playing"
  | "paused"
  | "ended"
  | "error";

export interface AudioEngine {
  load(track: AudioTrack): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(seconds: number): Promise<void>;
  setSpeed(rate: number): Promise<void>;
  unload(): Promise<void>;
  /**
   * Subscribe to time/state updates. Engine calls listener whenever
   * currentTime, duration, or natural ended changes.
   */
  subscribe(listener: (ev: AudioEngineEvent) => void): () => void;
}

export type AudioEngineEvent =
  | { type: "time"; currentTime: number }
  | { type: "duration"; duration: number }
  | { type: "ended" }
  | { type: "buffering" }
  | { type: "error"; message: string };

interface State {
  currentTrack: AudioTrack | null;
  playbackState: AudioPlaybackState;
  elapsedSeconds: number;
  durationSeconds: number;
  speed: number;
  error: string | null;
  dockVisible: boolean;
  fullScreenOpen: boolean;
}

type Action =
  | { type: "LOAD"; track: AudioTrack }
  | { type: "PLAY" }
  | { type: "PAUSE" }
  | { type: "SEEK"; seconds: number }
  | { type: "SPEED"; speed: number }
  | { type: "CLOSE" }
  | { type: "ENDED" }
  | { type: "ERROR"; message: string }
  | { type: "TIME"; currentTime: number }
  | { type: "DURATION"; duration: number }
  | { type: "BUFFERING" }
  | { type: "OPEN_FULL" }
  | { type: "CLOSE_FULL" };

const initialState: State = {
  currentTrack: null,
  playbackState: "idle",
  elapsedSeconds: 0,
  durationSeconds: 0,
  speed: 1,
  error: null,
  dockVisible: false,
  fullScreenOpen: false,
};

export function audioReducer(state: State, action: Action): State {
  switch (action.type) {
    case "LOAD":
      // br-audio-005: LOAD never transitions to playing.
      return {
        ...state,
        currentTrack: action.track,
        playbackState: "loading",
        elapsedSeconds: 0,
        durationSeconds: action.track.duration_seconds,
        error: null,
        dockVisible: true,
      };
    case "PLAY":
      return state.currentTrack
        ? { ...state, playbackState: "playing", error: null }
        : state;
    case "PAUSE":
      return { ...state, playbackState: "paused" };
    case "SEEK":
      return { ...state, elapsedSeconds: action.seconds };
    case "SPEED":
      return { ...state, speed: action.speed };
    case "ENDED":
      return { ...state, playbackState: "ended" };
    case "ERROR":
      return { ...state, playbackState: "error", error: action.message };
    case "TIME": {
      // VER-77: if we entered "loading" mid-play because of a buffer
      // stall, an advancing TIME event means the player resumed.
      // Transition back to "playing". The initial post-LOAD "loading"
      // state never sees advancing time before PLAY, so this only
      // recovers from buffering, not from a fresh load.
      const resumedFromBuffering =
        state.playbackState === "loading" &&
        state.currentTrack !== null &&
        action.currentTime > state.elapsedSeconds;
      return {
        ...state,
        elapsedSeconds: action.currentTime,
        playbackState: resumedFromBuffering ? "playing" : state.playbackState,
      };
    }
    case "BUFFERING":
      // Only transition into the buffering view from active playback.
      // Ignores the post-pause status flood that also reports
      // playing=false from the native player.
      return state.playbackState === "playing"
        ? { ...state, playbackState: "loading" }
        : state;
    case "DURATION":
      return { ...state, durationSeconds: action.duration };
    case "CLOSE":
      return {
        ...initialState,
        speed: state.speed,
      };
    case "OPEN_FULL":
      return { ...state, fullScreenOpen: true };
    case "CLOSE_FULL":
      return { ...state, fullScreenOpen: false };
    default:
      return state;
  }
}

export interface AudioPlayerContextValue extends State {
  load: (track: AudioTrack) => Promise<void>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  seek: (seconds: number) => Promise<void>;
  seekRelative: (delta: number) => Promise<void>;
  setSpeed: (speed: number) => Promise<void>;
  close: () => Promise<void>;
  openFullScreen: () => void;
  closeFullScreen: () => void;
}

const Ctx = createContext<AudioPlayerContextValue | null>(null);

export interface AudioPlayerProviderProps {
  engine: AudioEngine;
  children: ReactNode;
  onPlaybackStarted?: (
    track: AudioTrack,
    args: { isResume: boolean; resumePositionSeconds?: number },
  ) => void;
  onPlaybackPaused?: (
    track: AudioTrack,
    positionSeconds: number,
    reason: "user" | "background" | "navigation",
  ) => void;
  onPlaybackCompleted?: (track: AudioTrack) => void;
}

export function AudioPlayerProvider(props: AudioPlayerProviderProps) {
  const [state, dispatch] = useReducer(audioReducer, initialState);
  const engine = props.engine;
  /**
   * Mirrors `state.currentTrack` synchronously so `play()` / `pause()`
   * see the latest track when called inside the same async function as
   * `load()` (`await load(); await play()`). Without the ref, the
   * useCallback closure would capture the pre-LOAD `currentTrack: null`
   * and silently return early. Same bug as the web context (see
   * verse-mate-web/src/audio/AudioPlayerContext.tsx).
   */
  const currentTrackRef = useRef<AudioTrack | null>(null);
  const elapsedRef = useRef<number>(0);

  useEffect(() => {
    const unsubscribe = engine.subscribe((event) => {
      if (event.type === "time")
        dispatch({ type: "TIME", currentTime: event.currentTime });
      else if (event.type === "duration")
        dispatch({ type: "DURATION", duration: event.duration });
      else if (event.type === "ended") dispatch({ type: "ENDED" });
      else if (event.type === "buffering") dispatch({ type: "BUFFERING" });
      else if (event.type === "error")
        dispatch({ type: "ERROR", message: event.message });
    });
    return unsubscribe;
  }, [engine]);

  const load = useCallback(
    async (track: AudioTrack) => {
      currentTrackRef.current = track;
      dispatch({ type: "LOAD", track });
      await engine.load(track);
    },
    [engine],
  );

  const play = useCallback(async () => {
    const track = currentTrackRef.current;
    if (!track) return;
    try {
      await engine.play();
      dispatch({ type: "PLAY" });
      props.onPlaybackStarted?.(track, { isResume: false });
    } catch (err) {
      dispatch({
        type: "ERROR",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, [engine, props]);

  const pause = useCallback(async () => {
    const track = currentTrackRef.current;
    if (!track) return;
    await engine.pause();
    dispatch({ type: "PAUSE" });
    props.onPlaybackPaused?.(track, elapsedRef.current, "user");
  }, [engine, props]);

  const seek = useCallback(
    async (seconds: number) => {
      await engine.seek(seconds);
      dispatch({ type: "SEEK", seconds });
    },
    [engine],
  );

  const seekRelative = useCallback(
    async (delta: number) => {
      const next = Math.max(
        0,
        Math.min(state.durationSeconds, elapsedRef.current + delta),
      );
      await seek(next);
    },
    [seek, state.durationSeconds],
  );

  const setSpeed = useCallback(
    async (speed: number) => {
      await engine.setSpeed(speed);
      dispatch({ type: "SPEED", speed });
    },
    [engine],
  );

  const close = useCallback(async () => {
    await engine.unload();
    currentTrackRef.current = null;
    elapsedRef.current = 0;
    dispatch({ type: "CLOSE" });
  }, [engine]);

  // Keep elapsedRef in sync so pause/seekRelative read the current
  // position without reintroducing stale-closure deps on the callbacks.
  useEffect(() => {
    elapsedRef.current = state.elapsedSeconds;
  }, [state.elapsedSeconds]);

  const openFullScreen = useCallback(() => dispatch({ type: "OPEN_FULL" }), []);
  const closeFullScreen = useCallback(
    () => dispatch({ type: "CLOSE_FULL" }),
    [],
  );

  // Emit COMPLETED on the ended transition.
  useEffect(() => {
    if (state.playbackState === "ended" && state.currentTrack) {
      props.onPlaybackCompleted?.(state.currentTrack);
    }
  }, [state.playbackState, state.currentTrack, props]);

  const value = useMemo<AudioPlayerContextValue>(
    () => ({
      ...state,
      load,
      play,
      pause,
      seek,
      seekRelative,
      setSpeed,
      close,
      openFullScreen,
      closeFullScreen,
    }),
    [
      state,
      load,
      play,
      pause,
      seek,
      seekRelative,
      setSpeed,
      close,
      openFullScreen,
      closeFullScreen,
    ],
  );

  return <Ctx.Provider value={value}>{props.children}</Ctx.Provider>;
}

export function useAudioPlayer(): AudioPlayerContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAudioPlayer outside AudioPlayerProvider");
  return v;
}
