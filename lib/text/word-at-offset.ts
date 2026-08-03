/**
 * Resolve the word at a character offset.
 *
 * ## Why this exists
 *
 * Topics makes EVERY word tappable for a dictionary lookup, and it paid for that by rendering one node
 * per word: `dictionaryMarkdownRules` overrides the markdown `text` rule with a `<HighlightedText>` per
 * text node, which tokenizes per word (`tokenizeText`) and emits a `<Text>` per segment. A four-tab-switch
 * capture created **7453** `RCTText` views, and the worst frame spent 139.7ms of 158.8ms in `traversal`
 * — Android measuring and laying out that tree. Traversal cost scales with how many views are resident,
 * so no amount of mount scheduling helps; the view count itself has to go.
 *
 * `VMText` already reports a `charOffset` on tap for exactly this reason — its own docs call it "the
 * difference between one node and one-node-per-verse". So one native view per BLOCK is enough: when a tap
 * lands, ask which word was at that offset. That is what this function does, and it means the tappable-word
 * feature costs zero extra views.
 *
 * Interactive ranges would NOT have worked here, which is worth recording because it was the first plan:
 * "every word is tappable" means one range per word, which is the same explosion wearing a different hat.
 */

/** A word boundary is whitespace, matching `HighlightedText`'s `/(\S+)(\s*)/g` tokenizer. */
function isBoundary(ch: string): boolean {
  return /\s/.test(ch);
}

/**
 * Punctuation trimmed from the ENDS only.
 *
 * The tokenizer this replaces kept punctuation attached ("beginning," stayed one token), but a dictionary
 * lookup wants the word. Trimming only the ends preserves the inner marks that belong to a word —
 * hyphens in "worn-out", the apostrophe in "God's" — which a blanket strip would destroy.
 */
const EDGE_PUNCTUATION = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;

export interface WordAtOffset {
  /** The word with edge punctuation removed. Empty when the offset is not on a word. */
  word: string;
  /** Character offset where the returned word starts, before trimming. */
  start: number;
  /** Character offset just past the word's last character, before trimming. */
  end: number;
}

/**
 * The word containing `offset`, or an empty result when the offset falls on whitespace or outside the text.
 *
 * A tap that lands between words returns `word: ''` rather than guessing at a neighbour — a definition
 * popover for a word the reader did not tap is worse than no popover.
 */
export function wordAtOffset(text: string, offset: number): WordAtOffset {
  const empty: WordAtOffset = { word: '', start: offset, end: offset };
  if (!text || offset < 0 || offset >= text.length) return empty;
  if (isBoundary(text[offset])) return empty;

  let start = offset;
  while (start > 0 && !isBoundary(text[start - 1])) start -= 1;

  let end = offset;
  while (end < text.length && !isBoundary(text[end])) end += 1;

  const raw = text.slice(start, end);
  return { word: raw.replace(EDGE_PUNCTUATION, ''), start, end };
}
