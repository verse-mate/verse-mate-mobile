/**
 * The words of a multi-word selection, as chips above a definition.
 *
 * Define on a selection of several words opens the first one; these let the reader switch to any
 * other word they selected without selecting again. Shown by both definition sheets (the Greek/Hebrew
 * card and the English dictionary), so switching between a lexicon word and a plain word feels like
 * one control even though it swaps the sheet underneath.
 *
 * More chips than fit stay on one row that scrolls sideways. Sebastian asked for that to be visible:
 * the edge where chips continue fades into the sheet, with a small arrow on it that scrolls the row
 * along (animated, so the chips glide rather than jump). Each side shows only while there is more to
 * see that way.
 *
 * Colours come from the sheet, not from `useTheme()`: the lexicon card is a gorhom BottomSheetModal,
 * which renders through a portal above the ThemeProvider, so a theme hook in here threw "useTheme must
 * be used within a ThemeProvider" and crashed the app the first time Define opened chips (simulator,
 * 2026-10-31). The sheets read the theme where it exists and pass it down.
 */

import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { type getColors, spacing } from '@/theme/tokens';

export interface WordChoiceChipsProps {
  /** The sheet's theme colours (see the note above on why not `useTheme()`). */
  colors: ReturnType<typeof getColors>;
  words: string[];
  active: number;
  onChoose: (index: number) => void;
  testID?: string;
}

/** Width of the fade at an edge, in dp; the arrow sits on its outer half. */
const FADE_WIDTH = 56;
/** How far one arrow press scrolls, as a share of the visible row: enough to bring new chips in while
 * keeping the last ones in view, so the reader does not lose their place. */
const SCROLL_STEP = 0.7;
/** Slack for fractional layout, so a row that is exactly at its end does not keep an arrow. */
const EDGE_SLOP = 1;

/**
 * Where one arrow press scrolls the row to: 70% of the visible width that way, never past either end.
 */
export function chipScrollTarget(
  offset: number,
  viewport: number,
  content: number,
  direction: 1 | -1
): number {
  const maxOffset = Math.max(0, content - viewport);
  return Math.min(maxOffset, Math.max(0, offset + direction * viewport * SCROLL_STEP));
}

export function WordChoiceChips({
  colors,
  words,
  active,
  onChoose,
  testID = 'word-choice-chips',
}: WordChoiceChipsProps) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scrollRef = useRef<ScrollView>(null);
  const [viewport, setViewport] = useState(0);
  const [content, setContent] = useState(0);
  const [offset, setOffset] = useState(0);

  const maxOffset = Math.max(0, content - viewport);
  const canScrollLeft = offset > EDGE_SLOP;
  const canScrollRight = viewport > 0 && offset < maxOffset - EDGE_SLOP;

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setOffset(event.nativeEvent.contentOffset.x);
  }, []);

  const scrollBy = useCallback(
    (direction: 1 | -1) => {
      // Animated: the native scroll view glides to the target instead of jumping there.
      scrollRef.current?.scrollTo({
        x: chipScrollTarget(offset, viewport, content, direction),
        animated: true,
      });
    },
    [offset, viewport, content]
  );

  if (words.length < 2) return null;
  return (
    <View style={styles.wrapper} testID={testID}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        contentContainerStyle={styles.row}
        onLayout={(e) => setViewport(e.nativeEvent.layout.width)}
        onContentSizeChange={(width) => setContent(width)}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        testID={`${testID}-scroll`}
      >
        {words.map((word, index) => {
          const selected = index === active;
          return (
            <Pressable
              // biome-ignore lint/suspicious/noArrayIndexKey: the list is fixed for the sheet's life
              key={`${index}-${word}`}
              onPress={() => !selected && onChoose(index)}
              style={[styles.chip, selected && styles.chipSelected]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              testID={`${testID}-${index}`}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{word}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {canScrollLeft ? (
        <EdgeFade
          side="left"
          color={colors.backgroundElevated}
          styles={styles}
          iconColor={colors.textPrimary}
          onPress={() => scrollBy(-1)}
          testID={`${testID}-scroll-left`}
        />
      ) : null}
      {canScrollRight ? (
        <EdgeFade
          side="right"
          color={colors.backgroundElevated}
          styles={styles}
          iconColor={colors.textPrimary}
          onPress={() => scrollBy(1)}
          testID={`${testID}-scroll-right`}
        />
      ) : null}
    </View>
  );
}

/**
 * The fade over one edge, from transparent to the sheet's colour, with the arrow on top.
 *
 * The fade itself lets touches through (a chip under it can still be tapped where it shows); only the
 * arrow takes them.
 */
function EdgeFade({
  side,
  color,
  iconColor,
  styles,
  onPress,
  testID,
}: {
  side: 'left' | 'right';
  color: string;
  iconColor: string;
  styles: ReturnType<typeof createStyles>;
  onPress: () => void;
  testID: string;
}) {
  const gradientId = `word-chip-fade-${side}`;
  return (
    <View
      style={[styles.edge, side === 'left' ? styles.edgeLeft : styles.edgeRight]}
      pointerEvents="box-none"
    >
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <LinearGradient
            id={gradientId}
            x1={side === 'left' ? '1' : '0'}
            y1="0"
            x2={side === 'left' ? '0' : '1'}
            y2="0"
          >
            <Stop offset="0" stopColor={color} stopOpacity="0" />
            <Stop offset="0.55" stopColor={color} stopOpacity="1" />
            <Stop offset="1" stopColor={color} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
      </Svg>
      <Pressable
        onPress={onPress}
        style={styles.arrow}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={side === 'left' ? 'Show earlier words' : 'Show more words'}
        testID={testID}
      >
        <Ionicons
          name={side === 'left' ? 'chevron-back' : 'chevron-forward'}
          size={16}
          color={iconColor}
        />
      </Pressable>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof getColors>) =>
  StyleSheet.create({
    wrapper: {
      position: 'relative',
    },
    row: {
      gap: spacing.sm,
      paddingVertical: spacing.sm,
    },
    chip: {
      height: 32,
      paddingHorizontal: spacing.md,
      borderRadius: 100,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipSelected: {
      backgroundColor: colors.gold,
      borderColor: colors.gold,
    },
    chipText: {
      fontSize: 13,
      color: colors.textPrimary,
    },
    chipTextSelected: {
      color: colors.black,
    },
    edge: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      width: FADE_WIDTH,
      justifyContent: 'center',
    },
    edgeLeft: {
      left: 0,
      alignItems: 'flex-start',
    },
    edgeRight: {
      right: 0,
      alignItems: 'flex-end',
    },
    arrow: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
