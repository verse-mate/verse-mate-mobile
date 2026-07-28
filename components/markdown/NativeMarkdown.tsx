/**
 * Render markdown as ONE native text view per block.
 *
 * ## Why
 *
 * `react-native-markdown-display` emits a React `Text` per inline run and a `View` per block, so a
 * screenful of explanation is dozens of views. On Fabric each is a mount operation dispatched
 * inside the Choreographer callback — the phase `framestats` labels `animation` — and across 25
 * captures the slow-frame count tracked that phase alone (0.9ms to 28.8ms, 3/119 to 51/119 slow
 * frames) while measure/layout stayed at 0.2-0.6ms. The panel is 120Hz, so the budget is 8.3ms.
 *
 * This is the same trick the Bible reader already uses for verses: collapse many styled text
 * nodes into one native view carrying spans. `lib/text/compile-markdown` does the parsing, purely
 * and testably; this file only decides geometry and handles taps.
 *
 * ## Falling back is the default, not the exception
 *
 * The React renderer is used whenever the native path cannot be exact: no native module (web,
 * Expo Go, Jest), width not yet measured, or a document containing something with no span
 * equivalent (tables, images, strikethrough). Partial native rendering is never attempted —
 * silently dropping a table to win frames would be a correctness regression dressed as a
 * performance one.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { type LayoutChangeEvent, Linking, type TextStyle, View } from 'react-native';
import { useNativeText } from '@/hooks/bible/use-native-text';
import { getSharedParser, ReactMarkdown } from '@/lib/markdown/ReactMarkdown';
import { perfCount } from '@/lib/perf/monitor';
import {
  compileMarkdown,
  DEFAULT_MARKDOWN_STYLE,
  type MarkdownBlock,
  type MarkdownStyleConfig,
} from '@/lib/text/compile-markdown';
import {
  isNativeTextAvailable,
  measureTextHeights,
  type TextRange,
  VMText,
} from '@/modules/versemate-text';

/**
 * Last measured content width, kept at module scope.
 *
 * Width is only knowable after a layout pass, and rendering nothing on the first frame makes a tab
 * switch flash empty. Every instance of this component is the same column in the same reader, so
 * the previous width is a correct opening bid — corrected on the very next layout if it is not.
 */
let lastContentWidth = 0;

/** Vertical rhythm, in dp. Deliberately data rather than a stylesheet so blocks stay one view. */
const GAP_PARAGRAPH = 12;
const GAP_HEADING_TOP = 18;
const GAP_HEADING_BOTTOM = 8;
const GAP_LIST_ITEM = 6;
const INDENT_PER_DEPTH = 14;
const QUOTE_BORDER_WIDTH = 3;
const QUOTE_PADDING = 10;
const CODE_PADDING = 10;
const RULE_HEIGHT = 1;

export interface NativeMarkdownProps {
  /** Markdown source. */
  children: string;
  /**
   * The same `style` object the React renderer takes. `style.body` supplies base size, line
   * height and colour, so callers pass what they already pass and the two paths agree.
   */
  style?: Record<string, TextStyle>;
  /** Colours for links, code backgrounds and heading scales. */
  markdownStyle?: Partial<MarkdownStyleConfig>;
  /**
   * Override the renderer choice. Omitted, it follows the SAME stored preference as the verse
   * renderer, which is what makes this a drop-in replacement for `<Markdown>` — no caller has to
   * thread a flag down, and one toggle still moves everything.
   */
  enabled?: boolean;
  testID?: string;
}

export function NativeMarkdown({
  children,
  style,
  markdownStyle,
  enabled,
  testID,
}: NativeMarkdownProps) {
  const [contentWidth, setContentWidth] = useState(lastContentWidth);
  const { useNativeText: preferNative } = useNativeText();

  const body = style?.body ?? {};
  const fontSize = typeof body.fontSize === 'number' ? body.fontSize : 16;
  const lineHeight = typeof body.lineHeight === 'number' ? body.lineHeight : fontSize * 1.5;
  const color = typeof body.color === 'string' ? body.color : '#000000';

  const styleConfig = useMemo<MarkdownStyleConfig>(
    () => ({ ...DEFAULT_MARKDOWN_STYLE, ...markdownStyle }),
    [markdownStyle]
  );

  const native = (enabled ?? preferNative) && isNativeTextAvailable();

  const compiled = useMemo(() => {
    if (!native) return null;
    return compileMarkdown(children, getSharedParser(), styleConfig);
  }, [native, children, styleConfig]);

  /**
   * Heights for every block, in ONE native call.
   *
   * Batched for the same reason the reader batches paragraph measurement: a document is many
   * blocks mounted together, and this turns N JSI crossings into one. A null result means native
   * measurement is unavailable, which is a fallback condition rather than something to paper over
   * with an estimate — a wrong height clips text.
   */
  const measured = useMemo(() => {
    if (!compiled?.supported || contentWidth <= 0 || compiled.blocks.length === 0) return null;
    const requests = compiled.blocks.map((block) => ({
      text: block.text,
      // The bridge shape requires `interactive` to be present; TextRange leaves it optional.
      // Normalising here rather than in the compiler keeps the compiler free of transport concerns.
      ranges: block.ranges.map((range) => ({ ...range, interactive: range.interactive === true })),
      width: Math.max(1, contentWidth - insetFor(block)),
      fontSize: sizeFor(block, fontSize),
      lineHeight: block.kind === 'code' ? fontSize * 1.35 : lineHeight,
    }));
    return measureTextHeights(requests);
  }, [compiled, contentWidth, fontSize, lineHeight]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const width = Math.round(event.nativeEvent.layout.width);
    if (width > 0 && width !== lastContentWidth) lastContentWidth = width;
    if (width > 0) setContentWidth((current) => (current === width ? current : width));
  }, []);

  /** Open the href carried in the tapped range's `tag`. */
  const handleRangeTap = useCallback(
    (blockIndex: number, rangeIndex: number) => {
      const range = compiledRange(compiled?.blocks[blockIndex]?.ranges, rangeIndex);
      const href = range?.tag?.startsWith('link:') ? range.tag.slice('link:'.length) : null;
      if (href) Linking.openURL(href).catch(() => undefined);
    },
    [compiled]
  );

  const usable = compiled?.supported === true && measured !== null;

  /**
   * Record which path was taken, in an EFFECT rather than during render.
   *
   * Counted at all because the A/B is meaningless if the native arm quietly fell back — that is
   * precisely how an earlier renderer comparison produced a "result" from two identical arms. And
   * counted in an effect because a render that React discards under concurrent rendering would
   * otherwise inflate the number being used to judge the experiment.
   */
  const reason = usable ? null : fallbackReason(compiled, measured);
  useEffect(() => {
    if (!native) return;
    perfCount(reason === null ? 'markdown.native' : `markdown.fallback.${reason}`, 1);
  }, [native, reason]);

  if (!usable) {
    // `onLayout` stays on the wrapper so a fallback caused only by an unknown width resolves
    // itself on the next frame instead of being permanent.
    return (
      <View onLayout={handleLayout} testID={testID}>
        <ReactMarkdown style={style}>{children}</ReactMarkdown>
      </View>
    );
  }

  return (
    <View onLayout={handleLayout} testID={testID}>
      {compiled.blocks.map((block, index) => (
        <BlockView
          // Index is a legitimate key here: blocks are positional and a document has no stable
          // per-block identity to key on. A changed document re-renders wholly regardless.
          key={`${block.kind}-${index}`}
          block={block}
          blockIndex={index}
          color={color}
          contentWidth={contentWidth}
          fontSize={fontSize}
          height={measured[index]}
          lineHeight={lineHeight}
          onRangeTap={handleRangeTap}
          styleConfig={styleConfig}
        />
      ))}
    </View>
  );
}

/** One block. Kept separate so the interactive/decorated cases do not clutter the common one. */
function BlockView({
  block,
  blockIndex,
  color,
  contentWidth,
  fontSize,
  height,
  lineHeight,
  onRangeTap,
  styleConfig,
}: {
  block: MarkdownBlock;
  blockIndex: number;
  color: string;
  contentWidth: number;
  fontSize: number;
  height: number;
  lineHeight: number;
  onRangeTap: (blockIndex: number, rangeIndex: number) => void;
  styleConfig: MarkdownStyleConfig;
}) {
  const inset = insetFor(block);
  const width = Math.max(1, contentWidth - inset);

  if (block.kind === 'rule') {
    return (
      <View
        style={{
          height: RULE_HEIGHT,
          backgroundColor: color,
          opacity: 0.2,
          marginVertical: GAP_PARAGRAPH,
        }}
      />
    );
  }

  const text = (
    <VMText
      height={height}
      onRangeTap={(rangeIndex) => onRangeTap(blockIndex, rangeIndex)}
      ranges={block.ranges}
      style={{
        color,
        fontSize: sizeFor(block, fontSize),
        lineHeight: block.kind === 'code' ? fontSize * 1.35 : lineHeight,
      }}
      text={block.text}
      width={width}
    />
  );

  // A quote needs a rule down its left edge and code needs a filled box; neither can be a span, so
  // these two kinds pay for one wrapper view each. Every other kind stays at exactly one view.
  if (block.kind === 'blockquote') {
    return (
      <View
        style={{
          borderLeftColor: color,
          borderLeftWidth: QUOTE_BORDER_WIDTH,
          marginBottom: GAP_PARAGRAPH,
          marginLeft: inset - QUOTE_PADDING - QUOTE_BORDER_WIDTH,
          opacity: 0.85,
          paddingLeft: QUOTE_PADDING,
        }}
      >
        {text}
      </View>
    );
  }

  if (block.kind === 'code') {
    return (
      <View
        style={{
          backgroundColor: styleConfig.codeBackgroundColor,
          borderRadius: 6,
          marginBottom: GAP_PARAGRAPH,
          padding: CODE_PADDING,
        }}
      >
        {text}
      </View>
    );
  }

  return (
    <View
      style={{
        marginBottom: block.kind === 'listItem' ? GAP_LIST_ITEM : GAP_PARAGRAPH,
        marginLeft: inset,
        marginTop: block.kind === 'heading' ? GAP_HEADING_TOP : 0,
        ...(block.kind === 'heading' ? { marginBottom: GAP_HEADING_BOTTOM } : null),
      }}
    >
      {text}
    </View>
  );
}

/** Left inset in dp for a block at its nesting depth. */
function insetFor(block: MarkdownBlock): number {
  if (block.kind === 'blockquote') {
    return Math.max(1, block.depth) * INDENT_PER_DEPTH + QUOTE_PADDING + QUOTE_BORDER_WIDTH;
  }
  if (block.kind === 'listItem') return block.depth * INDENT_PER_DEPTH;
  return 0;
}

/**
 * Base size for a block.
 *
 * Headings get their scale here AND as a whole-block range in the compiler. That is not redundant:
 * the view-level size is what measurement and line height are computed from, while the range is
 * what lets a link or code span inside a heading layer on top correctly.
 */
function sizeFor(block: MarkdownBlock, fontSize: number): number {
  if (block.kind === 'code') return fontSize * 0.92;
  return fontSize;
}

/** Safe lookup, because a stale tap can arrive after the document changed. */
function compiledRange(ranges: TextRange[] | undefined, index: number): TextRange | undefined {
  return ranges && index >= 0 && index < ranges.length ? ranges[index] : undefined;
}

/** Why the React renderer was used, for the perf report. */
function fallbackReason(
  compiled: ReturnType<typeof compileMarkdown> | null,
  measured: number[] | null
): string {
  if (!compiled) return 'no-native';
  if (!compiled.supported) return compiled.unsupportedReason ?? 'unsupported';
  if (measured === null) return 'unmeasured';
  return 'unknown';
}

export default NativeMarkdown;
