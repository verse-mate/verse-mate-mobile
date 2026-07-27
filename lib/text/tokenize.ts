/**
 * Whitespace tokenisation and lexicon matching, as pure functions.
 *
 * Ported from the logic that currently lives inside `HighlightedText`'s render
 * path (`tokenizeText`, `lexiconLookups`, `stripPunct`, `findMultiWordMatch`).
 * Behaviour is preserved deliberately, with one documented fix — see
 * `expandToMatchUnits`.
 */

import type { AlignedToken, ChapterAlignment, LexEntry } from '@versemate/lexicon';

/** Punctuation stripped from a word's edges before lexicon lookup. */
const EDGE_PUNCT = /^[.,;:!?"'’()]+|[.,;:!?"'’()]+$/g;

/** Characters that may appear inside a word without breaking it. */
const WORD_CHAR = /[\p{L}\p{M}\p{N}'’-]/u;

/** One whitespace-delimited token, with the offsets of its punctuation-free core. */
export interface WordToken {
  /** The token exactly as it appears, punctuation included. */
  raw: string;
  /** Offset of `raw` in the source string. */
  start: number;
  /** Offset just past `raw`. */
  end: number;
  /** Offset of the first character after any leading punctuation. */
  coreStart: number;
  /** Offset just past the last character before any trailing punctuation. */
  coreEnd: number;
  /** Whether whitespace follows this token in the source. */
  trailingSpace: boolean;
}

/**
 * Split on whitespace, recording where each token's punctuation-free core sits.
 *
 * Core offsets exist so an underline can cover `Trials` but not the comma in
 * `Trials,` — web renders per-word spans, and a decoration that swallows
 * punctuation reads as a different glyph run.
 */
export function tokenize(text: string): WordToken[] {
  const tokens: WordToken[] = [];
  const re = /(\S+)(\s*)/g;
  let match: RegExpExecArray | null = re.exec(text);
  while (match !== null) {
    const raw = match[1];
    const start = match.index;
    let coreStart = start;
    let coreEnd = start + raw.length;
    while (coreStart < coreEnd && !WORD_CHAR.test(text[coreStart])) coreStart++;
    while (coreEnd > coreStart && !WORD_CHAR.test(text[coreEnd - 1])) coreEnd--;

    tokens.push({
      raw,
      start,
      end: start + raw.length,
      coreStart,
      coreEnd,
      trailingSpace: match[2].length > 0,
    });
    match = re.exec(text);
  }
  return tokens;
}

/** Lowercase and strip edge punctuation, for lexicon key lookup. */
export function normalizeWord(word: string): string {
  return word.toLowerCase().replace(EDGE_PUNCT, '');
}

/** A lexicon entry matched to a surface form. */
export interface LexHit {
  token: AlignedToken;
  entry: LexEntry;
  isTheme: boolean;
}

interface MultiCandidate extends LexHit {
  /** Normalised parts, length >= 2. */
  parts: string[];
  /** The surface as it appears in the lexicon data. */
  surface: string;
}

/** Per-verse lexicon lookup tables. */
export interface LexIndex {
  /** Single-word surfaces, keyed by normalised form. */
  single: Map<string, LexHit>;
  /** Multi-part surfaces, keyed by their first normalised part. */
  multi: Map<string, MultiCandidate[]>;
}

/**
 * Build lookup tables for one verse's alignment.
 *
 * `AlignedToken.surface` is a single string on legacy lexicon data and a
 * `string[]` of cross-translation surfaces (KJV/NASB/ESV/NIV/…) on newer
 * `@versemate/lexicon` builds. Every variant is registered, because otherwise
 * BSB/NASB wording drift silently drops the underline — e.g. BSB
 * "Submit yourselves" vs NASB "Submit". Mirrors web's `TokenizedVerse.surfacesOf`.
 */
export function buildLexIndex(
  alignment: ChapterAlignment | null | undefined,
  verseNumber: number
): LexIndex | null {
  const verseTokens = alignment?.verses?.[verseNumber];
  if (!alignment || !verseTokens) return null;

  const single = new Map<string, LexHit>();
  const multi = new Map<string, MultiCandidate[]>();
  const themeLemmas = new Set(alignment.themeLemmas ?? []);

  for (const token of verseTokens) {
    const entry = alignment.lexicon[token.lemma];
    if (!entry) continue;
    const isTheme = themeLemmas.has(token.lemma);
    const surfaces = Array.isArray(token.surface) ? token.surface : [token.surface];

    for (const surface of surfaces) {
      if (!surface) continue;
      // Split on whitespace AND hyphens so the lexicon's "double-minded" can
      // match a verse rendered "double minded", and vice versa.
      const parts = surface
        .toLowerCase()
        .split(/[\s-]+/)
        .filter(Boolean);
      if (parts.length === 0) continue;

      if (parts.length === 1) {
        // First-write-wins keeps the data file's ordering authoritative when one
        // surface maps to several lemmas within a verse.
        if (!single.has(parts[0])) single.set(parts[0], { token, entry, isTheme });
      } else {
        const head = parts[0];
        const list = multi.get(head);
        const candidate: MultiCandidate = { parts, surface, token, entry, isTheme };
        if (list) list.push(candidate);
        else multi.set(head, [candidate]);
      }
    }
  }

  return { single, multi };
}

/**
 * A single matchable word, which may be one part of a hyphenated token.
 *
 * @see expandToMatchUnits for why hyphens are split here.
 */
export interface MatchUnit {
  /** Normalised form used for comparison. */
  word: string;
  /** Index of the token this unit came from. */
  tokenIndex: number;
  /** Offset of this unit's first character in the source. */
  start: number;
  /** Offset just past this unit's last character. */
  end: number;
  /**
   * True when punctuation after this unit should stop a phrase continuing
   * through it — e.g. `double,` cannot begin `double minded`.
   */
  blockedAfter: boolean;
}

/**
 * Expand tokens into per-word match units, splitting on internal hyphens.
 *
 * ## The fix this carries
 *
 * `buildLexIndex` splits lexicon surfaces on whitespace *and* hyphens, so
 * `double-minded` is indexed as the two parts `['double', 'minded']`. But the
 * verse tokeniser splits on whitespace only, so a verse rendering the same word
 * as one token `double-minded` produced the lookup key `double-minded`, which
 * matched neither the single map nor the multi map's `double` head. The match
 * was silently lost — recorded as a known edge case in `HighlightedText`
 * (VER-mobile-lex-coverage-gap).
 *
 * Splitting the verse side on hyphens too makes both sides use the same unit, so
 * a phrase spanning a hyphen inside one token and a phrase spanning two
 * whitespace-separated tokens match through one code path instead of two.
 */
export function expandToMatchUnits(text: string, tokens: WordToken[]): MatchUnit[] {
  const units: MatchUnit[] = [];

  tokens.forEach((token, tokenIndex) => {
    const core = text.slice(token.coreStart, token.coreEnd);
    // Trailing punctuation between this token and the next breaks a phrase. The
    // final unit of a token is the only one that can be blocked, since anything
    // between hyphen-split units is by definition a hyphen.
    const blocked = hasPhraseBreakingPunct(text.slice(token.coreEnd, token.end));

    if (!core) return;

    let offset = 0;
    const pieces = core.split('-');
    pieces.forEach((piece, i) => {
      const isLast = i === pieces.length - 1;
      if (piece.length > 0) {
        units.push({
          word: piece.toLowerCase(),
          tokenIndex,
          start: token.coreStart + offset,
          end: token.coreStart + offset + piece.length,
          blockedAfter: isLast ? blocked : false,
        });
      }
      // +1 for the hyphen consumed by the split.
      offset += piece.length + 1;
    });
  });

  return units;
}

/** True when the given inter-word text contains punctuation that ends a phrase. */
function hasPhraseBreakingPunct(between: string): boolean {
  // Hyphens are allowed through: lexicon parts are hyphen-split too, so a hyphen
  // joins rather than separates.
  return /[^\p{L}\p{M}\p{N}'’\-\s]/u.test(between);
}

/** A resolved lexicon match over a run of match units. */
export interface LexMatch {
  /** Index of the first unit covered. */
  fromUnit: number;
  /** Index of the last unit covered, inclusive. */
  toUnit: number;
  /** Offset of the match's first character. */
  start: number;
  /** Offset just past the match's last character. */
  end: number;
  /** The surface as rendered in the verse, e.g. `double-minded`. */
  surface: string;
  hit: LexHit;
  /** True when the match spans more than one unit. */
  isMultiWord: boolean;
}

/**
 * Find every lexicon match over `units`, greedy longest-first, non-overlapping.
 *
 * Multi-word candidates are tried before single-word ones at each position, and
 * the longest candidate wins, so `double-minded` beats a bare `double`.
 */
export function matchLexicon(text: string, units: MatchUnit[], index: LexIndex): LexMatch[] {
  const matches: LexMatch[] = [];
  let i = 0;

  while (i < units.length) {
    const multiMatch = findMultiWordMatch(text, units, index, i);
    if (multiMatch) {
      matches.push(multiMatch);
      i = multiMatch.toUnit + 1;
      continue;
    }

    const hit = index.single.get(units[i].word);
    if (hit) {
      matches.push({
        fromUnit: i,
        toUnit: i,
        start: units[i].start,
        end: units[i].end,
        surface: text.slice(units[i].start, units[i].end),
        hit,
        isMultiWord: false,
      });
    }
    i++;
  }

  return matches;
}

function findMultiWordMatch(
  text: string,
  units: MatchUnit[],
  index: LexIndex,
  startIdx: number
): LexMatch | null {
  const candidates = index.multi.get(units[startIdx].word);
  if (!candidates || candidates.length === 0) return null;

  let best: MultiCandidate | null = null;
  for (const candidate of candidates) {
    const need = candidate.parts.length;
    if (startIdx + need > units.length) continue;

    let ok = true;
    for (let k = 0; k < need; k++) {
      const unit = units[startIdx + k];
      if (unit.word !== candidate.parts[k]) {
        ok = false;
        break;
      }
      // Punctuation after any part but the last breaks the phrase. The last
      // part may legitimately end a sentence.
      if (k < need - 1 && unit.blockedAfter) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    if (!best || candidate.parts.length > best.parts.length) best = candidate;
  }

  if (!best) return null;
  const toUnit = startIdx + best.parts.length - 1;
  return {
    fromUnit: startIdx,
    toUnit,
    start: units[startIdx].start,
    end: units[toUnit].end,
    surface: text.slice(units[startIdx].start, units[toUnit].end),
    hit: { token: best.token, entry: best.entry, isTheme: best.isTheme },
    isMultiWord: true,
  };
}
