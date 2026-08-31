/**
 * Jesus tab API types.
 *
 * Ported verbatim from verse-mate-web `src/services/types.ts`. These describe
 * the backend contract, not a client's rendering of it, so the two clients must
 * agree field-for-field — a divergence here is a bug, not a platform
 * difference. Keep them in step when the endpoints change.
 */

// Mirrors the backend's /jesus/* contract. The hub is rendered from
// `JesusOverview` rather than from hardcoded section names, so a taxonomy
// change on the backend reaches web and mobile without a client release.

/** The ten kinds an entry can take. Mirrors `JESUS_KINDS` on the backend. */
export type JesusKind =
  | 'TEACHING'
  | 'QUESTION'
  | 'COMMAND'
  | 'CLAIM'
  | 'MIRACLE'
  | 'HEALING'
  | 'ENCOUNTER'
  | 'COMPASSION'
  | 'CONFRONTATION'
  | 'PARABLE';

/** Top-level groupings on the hub: His Words, His Actions, Parables. */
export type JesusSection = 'words' | 'actions' | 'parables';

/**
 * A scripture reference in both machine and human form. `book_id`/`chapter`
 * drive the deep link into the reader; `display` is what the pill shows.
 */
export interface JesusReference {
  book_id: number;
  book_name: string;
  chapter: number;
  verse_start: number | null;
  verse_end: number | null;
  is_primary: boolean;
  display: string;
}

export interface JesusThemeRef {
  slug: string;
  name: string;
}

/** The card shape every Jesus list endpoint returns. */
export interface JesusEntry {
  slug: string;
  kind: JesusKind | string;
  kind_slug: string;
  kind_label: string;
  section: JesusSection | string | null;
  title: string;
  summary: string | null;
  /** The saying itself, when the entry is a saying. */
  quote: string | null;
  quote_reference: string | null;
  period_slug: string | null;
  period_name: string | null;
  is_translated: boolean;
  references: JesusReference[];
  themes: JesusThemeRef[];
}

export interface JesusKindSummary {
  kind: string;
  slug: string;
  label: string;
  singular: string;
  blurb: string;
  entry_count: number;
}

export interface JesusSectionSummary {
  section: string;
  label: string;
  blurb: string;
  sort_order: number;
  entry_count: number;
  kinds: JesusKindSummary[];
}

export interface JesusPeriodSummary {
  slug: string;
  name: string;
  subtitle: string | null;
  description: string | null;
  sort_order: number;
  entry_count: number;
}

export interface JesusThemeSummary {
  slug: string;
  name: string;
  description: string | null;
  sort_order: number;
  entry_count: number;
}

export interface JesusCollectionSummary {
  slug: string;
  name: string;
  subtitle: string | null;
  description: string | null;
  is_featured?: boolean;
  sort_order: number;
  entry_count: number;
}

/** Everything the hub screen needs, in one request. */
export interface JesusOverview {
  total_entries: number;
  sections: JesusSectionSummary[];
  periods: JesusPeriodSummary[];
  themes: JesusThemeSummary[];
  collections: JesusCollectionSummary[];
}

export interface JesusPassage {
  reference: string;
  book_id: number;
  book_name: string;
  chapter: number;
  verse_start: number | null;
  verse_end: number | null;
  is_primary: boolean;
  verses: { verse_number: number; text: string }[];
}

export interface JesusEntryDetail {
  entry: JesusEntry & {
    harmony_key: string | null;
    chronology_order: number | null;
  };
  /** Scripture resolved into the reader's Bible version. */
  passages: JesusPassage[];
  explanation: {
    summary: string;
    byline: string;
    detailed: string;
  };
  related: JesusEntry[];
}

export interface JesusLifePeriod extends JesusPeriodSummary {
  entries: JesusEntry[];
}

export interface JesusEntryList {
  entries: JesusEntry[];
  total: number;
  limit: number;
  offset: number;
}

export interface MostQuotedVerse {
  reference: string;
  book: string;
  bookId?: number;
  chapter: number;
  verse: number;
  text: string;
  quoteCount: number;
}

// ─── Jesus event graph ────────────────────────────────────────────────────
//
// Supersedes the entry types above. An event is the Gospel pericope; facets are
// the typed things Jesus said and did within it. Categories are views over
// facets, which is why a card carries `matched_facets` — browsing Questions
// shows the storm event labelled with the question inside it.

/** How much weight a claim carries. See specs/jesus-event-graph.md §5. */
export type JesusProvenance = 1 | 2 | 3;

/** Hedging on a reconstruction. `high` needs no caveat in the UI. */
export type JesusConfidence = 'high' | 'probable' | 'disputed';

export interface JesusEventPassage {
  book_id: number;
  book_name: string;
  chapter: number;
  verse_start: number | null;
  verse_end: number | null;
  is_primary: boolean;
  display: string;
  /** Present once the passage has been hydrated with scripture. */
  verses?: { verse_number: number; text: string }[];
  emphasis?: string | null;
  unique_to_account?: string | null;
}

export interface JesusFacet {
  slug: string;
  mode: 'WORD' | 'ACTION';
  type: string;
  type_slug: string;
  type_label: string;
  /** Set on WORD facets — who spoke. */
  speaker: string | null;
  /** Set on ACTION facets — who acted. */
  actor: string | null;
  title: string;
  text: string | null;
  summary: string | null;
  provenance: number;
  reference: string | null;
  book_id: number | null;
  chapter: number | null;
  verse_start: number | null;
  verse_end: number | null;
}

export interface JesusEventCard {
  slug: string;
  title: string;
  summary: string | null;
  period_slug: string | null;
  period_name: string | null;
  sequence: number | null;
  chronology_confidence: JesusConfidence;
  parallel_confidence: JesusConfidence;
  gospels: string[];
  passages: JesusEventPassage[];
  facet_counts: {
    words: number;
    actions: number;
    by_type: Record<string, number>;
  };
  matched_facets: JesusFacet[];
  themes: JesusThemeRef[];
}

export interface JesusReveal {
  content: string;
  source_ref: string | null;
  provenance: number;
}

export interface JesusEventDetail {
  event: JesusEventCard & {
    location: string | null;
    approximate_date: string | null;
    people: { person: string; role: string | null }[];
  };
  words: JesusFacet[];
  actions: JesusFacet[];
  passages: JesusEventPassage[];
  /** Kept apart so the narrator's voice is never merged into Jesus'. */
  reveals: {
    says_about_himself: JesusReveal[];
    demonstrates: JesusReveal[];
    others_say: JesusReveal[];
    narrator_says: JesusReveal[];
  };
  reactions: { who: string; what: string; source_ref: string | null; provenance: number }[];
  explanation: Record<string, string>;
  related: JesusEventCard[];
}

export interface JesusCompareAccount {
  book_id: number;
  gospel: string;
  records_it: boolean;
  passages: JesusEventPassage[];
}

export interface JesusCompare {
  event: JesusEventCard;
  accounts: JesusCompareAccount[];
  shared_by: string[];
  note: string;
  note_provenance: number | null;
  parallel_confidence: JesusConfidence;
}

export interface JesusFacetTypeSummary {
  type: string;
  mode: 'WORD' | 'ACTION';
  slug: string;
  label: string;
  singular: string;
  blurb: string;
  facet_count: number;
}

export interface JesusEventSection {
  section: string;
  label: string;
  blurb: string;
  sort_order: number;
  facet_count: number;
  types: JesusFacetTypeSummary[];
}

export interface JesusEventOverview {
  total_events: number;
  total_facets: number;
  sections: JesusEventSection[];
  periods: (JesusPeriodSummary & { event_count: number })[];
  themes: (JesusThemeSummary & { event_count: number })[];
  collections: (JesusCollectionSummary & { event_count: number })[];
}

export interface JesusEventLifePeriod {
  slug: string;
  name: string;
  subtitle: string | null;
  description: string | null;
  sort_order: number;
  event_count: number;
  events: JesusEventCard[];
}

export interface JesusEventList {
  events: JesusEventCard[];
  total: number;
  limit: number;
  offset: number;
}

// ─── Topic-grouped category browse ────────────────────────────────────────
//
// `GET /jesus/events/browse/:type` returns the same corpus as `?type=` on
// /jesus/events, reorganised: the category is introduced, then each topic says
// what it is about and quotes what He says there, then the events follow. Every
// category — Teachings, Questions, Commands, Claims and the rest — comes back
// in this one shape.

/** One "what He says here" line, lifted from a matched facet. */
export interface JesusTopicPoint {
  slug: string;
  title: string;
  text: string | null;
  summary: string | null;
  reference: string | null;
  provenance: number;
}

export interface JesusTopicGroup {
  /** null on the catch-all group for events carrying no theme. */
  slug: string | null;
  name: string;
  description: string | null;
  sort_order: number;
  event_count: number;
  facet_count: number;
  gospels: string[];
  points: JesusTopicPoint[];
  events: JesusEventCard[];
  /**
   * What He addresses in THIS category, as opposed to what the theme is in
   * general — the difference between "what does He teach about the Kingdom?"
   * and "what is the Kingdom?". Null until the brief has been generated for
   * this (category × topic) pair, which is why `description` still travels
   * alongside it.
   */
  brief: string | null;
  brief_provenance: number | null;
}

export interface JesusBrowseCategory {
  type: string;
  mode: 'WORD' | 'ACTION' | string;
  slug: string;
  label: string;
  singular: string;
  /** The noun to count with, lower-case: "8 teachings", "3 acts of compassion". */
  plural: string;
  section: string;
  blurb: string;
  /** The paragraph under the title: what this category is and how it's laid out. */
  intro: string;
  event_count: number;
  facet_count: number;
}

export interface JesusBrowse {
  type: JesusBrowseCategory;
  topics: JesusTopicGroup[];
  total_events: number;
  /** True when the category hit the server's ceiling and was cut short. */
  truncated: boolean;
}
