/**
 * Runtime switch between the native text renderer and the legacy `<Text>` tree.
 *
 * ## Why runtime and not build-time
 *
 * The whole point of Phase 4 is an honest A/B: legacy vs native, measured on the
 * same device, in the same session, running the same flow. A build-time flag
 * would mean two APKs, and two builds differ in more than the flag — different
 * JS bundle, different install, different warm-up state. Comparing them would
 * measure the build as much as the change.
 *
 * A runtime flag means **one build serves both arms**, so the only difference
 * between measurements is the code path.
 *
 * It also doubles as the escape hatch: if the native path misbehaves on a device
 * we do not have, the renderer can be turned off without shipping a release.
 *
 * Follows the module-level-subscriber pattern of `use-lexicon-underlines` so
 * toggling in Settings updates an already-mounted reader live — otherwise
 * flipping the arm would need a chapter remount, and a remount is exactly the
 * expensive event being measured.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { isNativeTextAvailable } from '@/modules/versemate-text';

const STORAGE_KEY = '@versemate:native_text_renderer';

/**
 * ON by default, as of 2026-07-29.
 *
 * The two conditions the previous comment set have both been met on device.
 *
 * The Phase 4 A/B: same-binary, flipping only this preference. Frames over the 8.33ms budget 74/119 ->
 * 57/119, p99 279ms -> 62ms, worst frame 300ms -> 63ms, and the `animation` phase (Fabric mount
 * dispatch, the only phase the slow-frame count tracks) 7.2ms -> 4.1ms.
 *
 * The QA checklist: .maestro/perf/decoration-qa.yaml exercised on device with screenshots — lexicon
 * dotted underlines, superscript verse numbers, a highlight background correctly excluding the verse
 * numbers, no clipped descenders, selection and lexicon tap.
 *
 * Defaulting it OFF now has the failure mode the old comment warned about, inverted: a preview build
 * would ship the renderer nobody has been testing. The operator has used this on for the whole
 * measurement effort, so on is the tested configuration.
 *
 * The stored preference still wins, and `useNativeText` is still false wherever the native module is
 * absent — web, Expo Go, Jest, and iOS until its port compiles — so those keep the React path.
 */
const DEFAULT_ENABLED = true;

let inMemoryCache: boolean | null = null;
const listeners = new Set<(value: boolean) => void>();

function notify(value: boolean): void {
  inMemoryCache = value;
  for (const listener of listeners) listener(value);
}

/** FOR TEST ENVIRONMENTS ONLY — resets the in-memory cache. */
export function __TEST_ONLY_RESET_NATIVE_TEXT_CACHE(): void {
  inMemoryCache = null;
  listeners.clear();
}

export interface UseNativeTextResult {
  /**
   * Whether to render through the native path.
   *
   * False whenever the native module is absent, regardless of the stored
   * preference — on web, in Expo Go, and in Jest there is nothing to render
   * with, and honouring the preference there would produce blank text.
   */
  useNativeText: boolean;
  /** The stored preference, independent of whether native is usable here. */
  preference: boolean;
  setUseNativeText: (value: boolean) => Promise<void>;
  /** True while the initial read from storage is in flight. */
  isLoading: boolean;
  /** Whether the native module exists on this platform/build at all. */
  isAvailable: boolean;
}

export function useNativeText(): UseNativeTextResult {
  const [preference, setPreference] = useState<boolean>(inMemoryCache ?? DEFAULT_ENABLED);
  const [isLoading, setIsLoading] = useState(inMemoryCache === null);

  useEffect(() => {
    const listener = (value: boolean) => setPreference(value);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (inMemoryCache !== null) return;
    let isMounted = true;

    (async () => {
      try {
        setIsLoading(true);
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        const value = stored === null ? DEFAULT_ENABLED : stored === 'true';
        if (isMounted) {
          inMemoryCache = value;
          setPreference(value);
          // Announce the resolved arm so a capture can VERIFY which renderer it is
          // measuring instead of inferring it. Inferring from rendered output was
          // indirect and got it wrong: a flip whose flow reported FAILED had in
          // fact toggled the flag, and the probe still read the old arm.
          if (__DEV__) {
            console.log(`[VMPERF] arm preference=${value} available=${isNativeTextAvailable()}`);
          }
        }
      } catch {
        // A storage failure must not decide the renderer. Fall back to the
        // default rather than leaving the flag in an indeterminate state.
        if (isMounted) {
          inMemoryCache = DEFAULT_ENABLED;
          setPreference(DEFAULT_ENABLED);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const setUseNativeText = async (value: boolean): Promise<void> => {
    // Notify first so the UI responds immediately; persistence is not on the
    // critical path for a toggle the user just flipped.
    notify(value);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // Preference is lost on restart but the current session still honours it.
    }
  };

  const isAvailable = isNativeTextAvailable();

  return {
    useNativeText: preference && isAvailable,
    preference,
    setUseNativeText,
    isLoading,
    isAvailable,
  };
}
