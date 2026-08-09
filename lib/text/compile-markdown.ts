/**
 * Compile markdown into flat strings plus decorated character ranges.
 *
 * ## Why this exists
 *
 * `react-native-markdown-display` renders one React `Text` per inline run and one `View` per
 * block, so a screenful of explanation is dozens of separate views. On Fabric every one of those
 * is a mount operation dispatched inside the Choreographer callback — the phase
 * `dumpsys gfxinfo framestats` calls `animation` — and across 25 captures the slow-frame count
 * tracked that phase and nothing else, with measure/layout (`traversals`) steady at 0.2-0.6ms.
 * On a 120Hz panel the budget is 8.3ms and that phase alone reached 28.8ms.
 *
 * The Bible reader already solved the same problem by rendering a whole paragraph as ONE native
 * text view with spans. This is that trick applied to markdown: one view per BLOCK instead of one
 * per inline run.
 *
 * A previous attempt aimed at the same phase from the other direction — spreading the mount over
 * several frames — and measured as a wash (frame mean 13.19 -> 12.70ms but `tab.switch`
 * 85.7 -> 90.9ms), so it was reverted. Fewer views is the untried half.
 *
 * ## Why a pure function
 *
 * No React, no native calls, no theme objects — markdown in, blocks out. That keeps the
 * interesting logic (nested emphasis, list numbering, offset arithmetic) testable on the Pi
 * without a device, which is the same reason `lib/text`'s verse compiler is pure. Styling
 * decisions arrive as a plain `MarkdownStyleConfig` so tests can assert on structure using
 * obvious numbers.
 *
 * ## Fidelity over coverage
 *
 * Anything this cannot express EXACTLY — tables, images, embedded HTML, strikethrough (Android's
 * StyleSpan has no such axis) — makes the whole document report `supported: false` so the caller
 * falls back to the React renderer wholesale. Rendering most of a document natively and quietly
 * dropping a table would be a correctness regression sold as a performance win.
 */

import type { TextRange } from '@/modules/versemate-text';

/**
 * Structural type for the parser, rather than importing markdown-it's own.
 *
 * `markdown-it` ships no type declarations in this tree, and adding @types just to name a
 * parameter would make a production dependency of a detail only this signature needs. Anything
 * with a `parse` is acceptable, which also makes the function trivially fakeable in tests.
 */
export interface MarkdownParser {
  parse(source: string, env: Record<string, unknown>): unknown[];
}

/** A markdown-it token, narrowed to the fields used here. */
interface MdToken {
  type: string;
  tag: string;
  nesting: number;
  content: string;
  markup: string;
  level: number;
  children?: MdToken[] | null;
  attrs?: [string, string][] | null;
  info?: string;
}

/** What a block is, so the renderer can pick spacing and decoration without re-parsing. */
export type MarkdownBlockKind =
  | 'paragraph'
  | 'heading'
  | 'listItem'
  | 'blockquote'
  | 'code'
  | 'rule';

export interface MarkdownBlock {
  kind: MarkdownBlockKind;
  /** Flat text; `text.slice(range.start, range.end)` is exactly the decorated substring. */
  text: string;
  ranges: TextRange[];
  /** 1-6 for headings, 0 otherwise. Drives font scale in the renderer. */
  headingLevel: number;
  /** Nesting depth for lists and quotes, 0 at the top level. Drives left inset. */
  depth: number;
}

export interface CompiledMarkdown {
  blocks: MarkdownBlock[];
  /** False when the document contains anything the native path cannot render exactly. */
  supported: boolean;
  /** Why it is unsupported — surfaced in perf reports rather than guessed at. */
  unsupportedReason?: string;
}

export interface MarkdownStyleConfig {
  /** Weight applied to `**strong**` and to heading text. */
  boldWeight: string;
  /** Colour for `[links](…)`, which are also marked interactive. */
  linkColor: string;
  /** Background behind `` `code` `` spans. */
  codeBackgroundColor: string;
  /** Multipliers for h1..h6, index 0 = h1. */
  headingScales: number[];
}

export const DEFAULT_MARKDOWN_STYLE: MarkdownStyleConfig = {
  boldWeight: '700',
  linkColor: '#2563eb',
  codeBackgroundColor: 'rgba(127,127,127,0.15)',
  headingScales: [1.5, 1.3, 1.15, 1.05, 1.0, 1.0],
};

/**
 * Block tokens that are safe to ignore entirely — they only open or close grouping that the
 * block list already expresses through `depth`.
 */
const STRUCTURAL_TAGS = new Set(['ul', 'ol', 'li', 'blockquote']);

/** Inline token types with no exact span equivalent. Presence of any forces the fallback. */
const UNSUPPORTED_INLINE = new Set(['image', 'html_inline', 's_open', 's_close']);
const UNSUPPORTED_BLOCK = new Set([
  'table_open',
  'html_block',
  'math_block',
  'footnote_open',
  'footnote_block_open',
]);

/** Mutable state while walking one block's inline children. */
interface InlineAcc {
  text: string;
  ranges: TextRange[];
}

/**
 * Walk inline tokens, emitting a range per styled span.
 *
 * Open/close tokens nest, so each open pushes a start offset and its close pops it and emits the
 * range covering everything written in between. That is what makes `**bold with *italic* inside**`
 * produce two overlapping ranges rather than three adjacent ones — which matters because the
 * native side composes weight and slant into a single `Typeface.BOLD_ITALIC`.
 */
function walkInline(
  tokens: MdToken[],
  acc: InlineAcc,
  style: MarkdownStyleConfig
): string | null {
  // Each entry remembers where a decoration started and what to emit when it closes.
  const open: { start: number; apply: (r: TextRange) => void }[] = [];

  for (const token of tokens) {
    if (UNSUPPORTED_INLINE.has(token.type)) return token.type;

    switch (token.type) {
      case 'text':
        acc.text += token.content;
        break;

      case 'softbreak':
        // A single newline in the source is a space when rendered, matching CommonMark.
        acc.text += ' ';
        break;

      case 'hardbreak':
        acc.text += '\n';
        break;

      case 'code_inline':
        acc.ranges.push({
          start: acc.text.length,
          end: acc.text.length + token.content.length,
          backgroundColor: style.codeBackgroundColor,
          tag: 'code',
        });
        acc.text += token.content;
        break;

      case 'strong_open':
        open.push({
          start: acc.text.length,
          apply: (r) => {
            r.fontWeight = style.boldWeight;
            r.tag = 'strong';
          },
        });
        break;

      case 'em_open':
        open.push({
          start: acc.text.length,
          apply: (r) => {
            r.fontStyle = 'italic';
            r.tag = 'em';
          },
        });
        break;

      case 'link_open': {
        const href = token.attrs?.find(([name]) => name === 'href')?.[1] ?? '';
        open.push({
          start: acc.text.length,
          apply: (r) => {
            r.color = style.linkColor;
            r.interactive = true;
            // The href rides in `tag` because the native side treats it as opaque, and the
            // renderer needs it to open the link on tap without keeping a parallel array.
            r.tag = `link:${href}`;
          },
        });
        break;
      }

      case 'strong_close':
      case 'em_close':
      case 'link_close': {
        const entry = open.pop();
        if (!entry) break;
        if (acc.text.length > entry.start) {
          const range: TextRange = { start: entry.start, end: acc.text.length };
          entry.apply(range);
          acc.ranges.push(range);
        }
        break;
      }

      default:
        // An unknown inline token with children still contributes text; one without is inert
        // markup. Neither should silently drop content, so recurse and let the child walk decide.
        if (token.children && token.children.length > 0) {
          const bad = walkInline(token.children, acc, style);
          if (bad) return bad;
        } else if (token.content && token.nesting === 0) {
          return token.type;
        }
        break;
    }
  }
  return null;
}

/**
 * Compile a markdown document.
 *
 * `parser` is injected rather than constructed so the app's single shared `MarkdownIt` is reused —
 * building one costs a LinkifyIt regex compile, measured at 178ms of self time across six chapter
 * swipes when the library rebuilt it per render.
 */
export function compileMarkdown(
  source: string,
  parser: MarkdownParser,
  style: MarkdownStyleConfig = DEFAULT_MARKDOWN_STYLE
): CompiledMarkdown {
  if (!source.trim()) return { blocks: [], supported: true };

  let tokens: MdToken[];
  try {
    tokens = parser.parse(source, {}) as unknown as MdToken[];
  } catch {
    // A parser that throws is not a reason to show nothing — hand the document to the React
    // renderer, which has its own error handling.
    return { blocks: [], supported: false, unsupportedReason: 'parse-error' };
  }

  const blocks: MarkdownBlock[] = [];
  let depth = 0;
  // Ordered-list counters, one per nesting level, so nested lists number independently.
  const listCounters: number[] = [];
  let orderedDepth = 0;
  /**
   * Enclosing containers, innermost last.
   *
   * Tracked forward rather than recovered by scanning backwards from each `inline` token. The
   * scan-back version got blockquotes wrong: markdown-it wraps quoted text in a `paragraph_open`
   * INSIDE the `blockquote_open`, so the nearest opener is the paragraph and the quote is
   * invisible from there. Which container a block sits in is state, so it is kept as state.
   */
  const containers: ('list-ordered' | 'list-unordered' | 'quote')[] = [];
  let itemDepth = 0;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (UNSUPPORTED_BLOCK.has(token.type)) {
      return { blocks: [], supported: false, unsupportedReason: token.type };
    }

    switch (token.type) {
      case 'bullet_list_open':
        containers.push('list-unordered');
        depth++;
        break;
      case 'ordered_list_open':
        containers.push('list-ordered');
        depth++;
        orderedDepth++;
        listCounters[orderedDepth] = 1;
        break;
      case 'bullet_list_close':
        containers.pop();
        depth = Math.max(0, depth - 1);
        break;
      case 'ordered_list_close':
        containers.pop();
        listCounters[orderedDepth] = 0;
        orderedDepth = Math.max(0, orderedDepth - 1);
        depth = Math.max(0, depth - 1);
        break;
      case 'blockquote_open':
        containers.push('quote');
        depth++;
        break;
      case 'blockquote_close':
        containers.pop();
        depth = Math.max(0, depth - 1);
        break;
      case 'list_item_open':
        itemDepth++;
        break;
      case 'list_item_close':
        itemDepth = Math.max(0, itemDepth - 1);
        break;

      case 'hr':
        blocks.push({ kind: 'rule', text: '', ranges: [], headingLevel: 0, depth });
        break;

      case 'fence':
      case 'code_block':
        blocks.push({
          kind: 'code',
          // Trailing newline is the fence's own delimiter, not content; keeping it would draw an
          // empty last line inside the code block's background.
          text: token.content.replace(/\n$/, ''),
          ranges: [],
          headingLevel: 0,
          depth,
        });
        break;

      case 'inline': {
        // `inline` always directly follows its block's open token, so the previous token gives the
        // block kind and the container stack gives the context.
        const owner = ownerOf(tokens[i - 1], containers, itemDepth);
        const acc: InlineAcc = { text: '', ranges: [] };
        const bad = walkInline(token.children ?? [], acc, style);
        if (bad) return { blocks: [], supported: false, unsupportedReason: bad };

        let text = acc.text;
        const ranges = acc.ranges;
        let headingLevel = 0;

        if (owner.kind === 'heading') {
          headingLevel = owner.headingLevel;
          const scale = style.headingScales[headingLevel - 1] ?? 1;
          // Whole-block decoration rather than a style on the view, so a heading containing a
          // link or code span still layers correctly on top of it.
          ranges.unshift({
            start: 0,
            end: text.length,
            fontWeight: style.boldWeight,
            fontScale: scale,
            tag: `h${headingLevel}`,
          });
        }

        if (owner.kind === 'listItem') {
          const marker =
            owner.ordered && listCounters[orderedDepth]
              ? `${listCounters[orderedDepth]++}. `
              : '•  ';
          // The marker is part of the SAME string, which is the whole point: a separate bullet
          // view would put the view count straight back.
          text = marker + text;
          for (const range of ranges) {
            range.start += marker.length;
            range.end += marker.length;
          }
        }

        blocks.push({ kind: owner.kind, text, ranges, headingLevel, depth });
        break;
      }

      default:
        // Paragraph/heading/list-item open and close tokens carry no content of their own.
        if (
          !STRUCTURAL_TAGS.has(token.tag) &&
          token.nesting === 0 &&
          token.content &&
          token.type !== 'text'
        ) {
          return { blocks: [], supported: false, unsupportedReason: token.type };
        }
        break;
    }
  }

  return { blocks, supported: true };
}

/**
 * Which block an `inline` token belongs to.
 *
 * `opener` is the token immediately before it — `heading_open` or `paragraph_open` — and the
 * container stack supplies what encloses that. Blockquotes are why the stack is needed at all:
 * their text sits inside a paragraph, so the opener alone reports "paragraph".
 */
function ownerOf(
  opener: MdToken | undefined,
  containers: ('list-ordered' | 'list-unordered' | 'quote')[],
  itemDepth: number
): { kind: MarkdownBlockKind; headingLevel: number; ordered: boolean } {
  if (opener?.type === 'heading_open') {
    return {
      kind: 'heading',
      headingLevel: Number.parseInt(opener.tag.slice(1), 10) || 1,
      ordered: false,
    };
  }

  const innermost = containers[containers.length - 1];
  // Innermost wins, so `> - item` is a list item inside a quote rather than a quote line.
  if (innermost === 'quote') return { kind: 'blockquote', headingLevel: 0, ordered: false };
  if (itemDepth > 0 && innermost) {
    return { kind: 'listItem', headingLevel: 0, ordered: innermost === 'list-ordered' };
  }
  return { kind: 'paragraph', headingLevel: 0, ordered: false };
}
