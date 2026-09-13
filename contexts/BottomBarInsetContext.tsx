/**
 * How much fixed furniture a screen has pinned to the very bottom.
 *
 * The audio dock is mounted once, above the navigator, so it cannot see what
 * the screen underneath it puts at `bottom: 0`. On the reader that is the
 * reading-progress bar; everywhere else it is nothing. Hardcoding a number in
 * the dock got it wrong in both directions — a strip of chapter text showed
 * through between the dock and the progress bar on the reader, and the dock
 * floated off the bottom edge on every other screen.
 *
 * So the screen that owns the furniture reports its measured height here and
 * the dock sits exactly on top of it. Measured rather than declared, because
 * the progress bar's height comes from its content (a 6px track next to a
 * 10px label), not from a constant anyone maintains.
 */
import { useFocusEffect } from 'expo-router';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

interface BottomBarInsetValue {
  /** Height in dp of whatever is pinned to the bottom of the current screen. */
  inset: number;
  setInset: (height: number) => void;
}

const Ctx = createContext<BottomBarInsetValue>({ inset: 0, setInset: () => {} });

export function BottomBarInsetProvider({ children }: { children: ReactNode }) {
  const [inset, setInset] = useState(0);
  const value = useMemo(() => ({ inset, setInset }), [inset]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Read the current bottom furniture height. Used by the audio dock. */
export function useBottomBarInset(): number {
  return useContext(Ctx).inset;
}

/**
 * Report the height of this screen's bottom furniture.
 *
 * Published only while the screen is focused, and cleared on blur. Unmount is
 * not enough: expo-router keeps the previous screen mounted underneath, so a
 * reader left behind in the stack went on claiming its progress bar was there
 * and the dock floated ~17dp off the bottom of Settings.
 */
export function useReportBottomBarInset(): (height: number) => void {
  const { setInset } = useContext(Ctx);
  const heightRef = useRef(0);
  const focusedRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      setInset(heightRef.current);
      return () => {
        focusedRef.current = false;
        setInset(0);
      };
    }, [setInset])
  );

  return useCallback(
    (height: number) => {
      heightRef.current = height;
      if (focusedRef.current) setInset(height);
    },
    [setInset]
  );
}
