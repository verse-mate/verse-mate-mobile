/**
 * The narration voice the user picked, or null for "whichever fits best".
 *
 * Narration still follows the translation being read — this is the override
 * for when a language has several voices and the automatic pick is not the
 * one you want. Stored as a Bible Brain version abbreviation (`ENGESV`), not
 * a fileset id, because a version spans an NT and an OT fileset and the reader
 * chooses between them per chapter.
 *
 * Same module-level subscriber pattern as `useBibleVersion`: Settings and the
 * already-mounted reader are different component trees, so without the
 * broadcast the reader keeps its stale `useState` and goes on playing the old
 * voice until it remounts.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const SCRIPTURE_VOICE_KEY = 'scripture-voice';

type Listener = () => void;
const listeners = new Set<Listener>();

/** Undefined = never read from storage yet; null = explicitly automatic. */
let cachedVoice: string | null | undefined;

/** Test-only: Jest's AsyncStorage.clear() does not touch module state. */
export function resetCachedScriptureVoice(): void {
  cachedVoice = undefined;
}

export interface UseScriptureVoiceResult {
  /** Chosen version abbr, or null when the app picks automatically. */
  voiceAbbr: string | null;
  /** Pass null to go back to automatic. */
  setVoiceAbbr: (abbr: string | null) => Promise<void>;
  isLoading: boolean;
}

export function useScriptureVoice(): UseScriptureVoiceResult {
  const [voiceAbbr, setVoiceState] = useState<string | null>(cachedVoice ?? null);
  const [isLoading, setIsLoading] = useState(cachedVoice === undefined);

  useEffect(() => {
    let active = true;

    const refresh = async () => {
      try {
        const stored = await AsyncStorage.getItem(SCRIPTURE_VOICE_KEY);
        cachedVoice = stored || null;
        if (active) setVoiceState(cachedVoice);
      } catch {
        // Best-effort: an unreadable preference just means automatic.
        if (active) setVoiceState(null);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    refresh();
    listeners.add(refresh);
    return () => {
      active = false;
      listeners.delete(refresh);
    };
  }, []);

  const setVoiceAbbr = useCallback(async (abbr: string | null) => {
    if (abbr) {
      await AsyncStorage.setItem(SCRIPTURE_VOICE_KEY, abbr);
    } else {
      await AsyncStorage.removeItem(SCRIPTURE_VOICE_KEY);
    }
    cachedVoice = abbr;
    setVoiceState(abbr);
    for (const fn of listeners) fn();
  }, []);

  return { voiceAbbr, setVoiceAbbr, isLoading };
}
