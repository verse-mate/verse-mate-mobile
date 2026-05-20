// Test-only mock for @versemate/lexicon.
//
// The real package ships 38 MB of generated TypeScript + JSON via a
// `file:` symlink. Jest's babel transform tries to resolve
// `@babel/runtime/helpers/...` relative to the source file's location
// (outside the mobile repo's node_modules) and fails. Existing tests
// don't actually exercise lexicon loading — ChapterReader just imports
// from the package — so this stub keeps imports resolvable and
// `loadAlignmentFor` returns `null` (the "no alignment" branch falls
// straight through to the legacy WordDefinitionTooltip path).

export type LemmaKey = string;

export interface RelatedWord {
  lemma: string;
  translit: string;
  note: string;
}

export interface LexEntry {
  lemma: string;
  translit: string;
  pronunciation?: string;
  strongs: string;
  pos: string;
  basicGloss: string;
  semanticRange?: string[];
  ntFrequency?: number;
  otFrequency?: number;
  loaded?: boolean;
  related?: RelatedWord[];
  notes?: string;
}

export interface AlignedToken {
  surface: string;
  lemma: LemmaKey;
  contextual?: string;
}

export interface ChapterAlignment {
  bookId: number;
  book: string;
  chapter: number;
  version: string;
  verses: Record<number, AlignedToken[]>;
  lexicon: Record<LemmaKey, LexEntry>;
  themeLemmas?: LemmaKey[];
}

export async function loadAlignmentFor(
  _bookId: number,
  _chapter: number,
): Promise<ChapterAlignment | null> {
  return null;
}

export function getBookSlug(_bookId: number): string | null {
  return null;
}

export const BOOK_SLUGS: Record<number, string> = {};
