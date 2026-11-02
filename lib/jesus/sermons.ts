/**
 * Jesus's major sermons, by reference.
 *
 * Asked for as "a 'sermons' section … so readers can read the sermon on the
 * mount and others". The corpus has no sermon kind or collection: its events
 * are pericopes, so the Sermon on the Mount is several events (the Beatitudes,
 * the Lord's Prayer, the two builders …) with nothing saying they belong to one
 * sermon. What a sermon IS, though, is a stretch of text — Matthew 5:1–7:29 —
 * and every event carries its passages, so a sermon is defined here by its
 * references and the events inside them are found by matching, not by slug.
 * That keeps working as the corpus is re-cut, and never needs an event slug
 * this app can't see.
 *
 * Each account is also a link into the reader, which is where a sermon is
 * actually read straight through.
 */
import type { JesusEventCard, JesusEventPassage } from '@/types/jesus';

export const BOOK_MATTHEW = 40;
export const BOOK_MARK = 41;
export const BOOK_LUKE = 42;
export const BOOK_JOHN = 43;

/** A run of verses in one book, possibly across chapters. */
export interface SermonRange {
  bookId: number;
  bookName: string;
  from: [chapter: number, verse: number];
  to: [chapter: number, verse: number];
}

export interface Sermon {
  slug: string;
  /**
   * Prefix of its labels, `jesus.sermons.<key>Name` / `<key>Blurb`. Flat
   * rather than nested under the slug: the locale catalogs keep `jesus.*` to
   * group → string, and the key-parity test walks them that way.
   */
  key: string;
  /** English fallback for `<key>Name`. */
  name: string;
  blurb: string;
  /** First account is the fullest telling; the rest are parallels. */
  accounts: SermonRange[];
}

const matt = (from: [number, number], to: [number, number]): SermonRange => ({
  bookId: BOOK_MATTHEW,
  bookName: 'Matthew',
  from,
  to,
});
const mark = (from: [number, number], to: [number, number]): SermonRange => ({
  bookId: BOOK_MARK,
  bookName: 'Mark',
  from,
  to,
});
const luke = (from: [number, number], to: [number, number]): SermonRange => ({
  bookId: BOOK_LUKE,
  bookName: 'Luke',
  from,
  to,
});
const john = (from: [number, number], to: [number, number]): SermonRange => ({
  bookId: BOOK_JOHN,
  bookName: 'John',
  from,
  to,
});

/** In the order they come in His ministry. */
export const SERMONS: Sermon[] = [
  {
    slug: 'nazareth',
    key: 'nazareth',
    name: 'The sermon at Nazareth',
    blurb: 'He reads Isaiah in His hometown synagogue and announces it fulfilled.',
    accounts: [luke([4, 16], [4, 30])],
  },
  {
    slug: 'sermon-on-the-mount',
    key: 'mount',
    name: 'The Sermon on the Mount',
    blurb: 'The Beatitudes, the Lord’s Prayer, and a righteousness deeper than the law.',
    accounts: [matt([5, 1], [7, 29])],
  },
  {
    slug: 'sermon-on-the-plain',
    key: 'plain',
    name: 'The Sermon on the Plain',
    blurb: 'Blessings and woes, love for enemies, and the two builders.',
    accounts: [luke([6, 17], [6, 49])],
  },
  {
    slug: 'sending-the-twelve',
    key: 'twelve',
    name: 'Sending out the Twelve',
    blurb: 'How to go, what to expect, and whom to fear.',
    accounts: [matt([10, 5], [10, 42]), mark([6, 7], [6, 13]), luke([9, 1], [9, 6])],
  },
  {
    slug: 'parables-of-the-kingdom',
    key: 'parables',
    name: 'Parables of the kingdom',
    blurb: 'The sower, the weeds, the mustard seed, and the hidden treasure.',
    accounts: [matt([13, 1], [13, 52]), mark([4, 1], [4, 34]), luke([8, 4], [8, 18])],
  },
  {
    slug: 'bread-of-life',
    key: 'bread',
    name: 'The Bread of Life',
    blurb: 'After feeding the five thousand, He calls Himself the bread from heaven.',
    accounts: [john([6, 22], [6, 71])],
  },
  {
    slug: 'life-together',
    key: 'together',
    name: 'Life together',
    blurb: 'True greatness, the lost sheep, and forgiving seventy times seven.',
    accounts: [matt([18, 1], [18, 35]), mark([9, 33], [9, 50]), luke([9, 46], [9, 50])],
  },
  {
    slug: 'woes-on-the-pharisees',
    key: 'woes',
    name: 'Woes on the scribes and Pharisees',
    blurb: 'Seven woes on religion that loads others and lightens itself.',
    accounts: [matt([23, 1], [23, 39]), luke([11, 37], [11, 54])],
  },
  {
    slug: 'olivet-discourse',
    key: 'olivet',
    name: 'The Olivet Discourse',
    blurb: 'The temple’s fall, the end of the age, and the call to stay awake.',
    accounts: [matt([24, 1], [25, 46]), mark([13, 1], [13, 37]), luke([21, 5], [21, 36])],
  },
  {
    slug: 'upper-room-discourse',
    key: 'upperRoom',
    name: 'The Upper Room Discourse',
    blurb: 'His farewell: the vine, the promised Spirit, and His prayer for His own.',
    accounts: [john([13, 31], [17, 26])],
  },
];

/** "Matthew 5:1–7:29", "Luke 6:17–49". */
export function rangeLabel(range: SermonRange): string {
  const [fc, fv] = range.from;
  const [tc, tv] = range.to;
  return fc === tc
    ? `${range.bookName} ${fc}:${fv}–${tv}`
    : `${range.bookName} ${fc}:${fv}–${tc}:${tv}`;
}

/** Compare two chapter:verse points. */
function cmp(a: [number, number], b: [number, number]): number {
  return a[0] - b[0] || a[1] - b[1];
}

/**
 * Does this passage BEGIN inside the range?
 *
 * The start, not any overlap: "The calling of the Twelve" (Matthew 10:1-4)
 * touches the mission discourse's chapter but is the scene before it, and a
 * whole-chapter passage would otherwise drag every event of that chapter in.
 */
export function passageStartsIn(passage: JesusEventPassage, range: SermonRange): boolean {
  if (passage.book_id !== range.bookId) return false;
  const start: [number, number] = [passage.chapter, passage.verse_start ?? 1];
  return cmp(start, range.from) >= 0 && cmp(start, range.to) <= 0;
}

/**
 * The events told inside a sermon, in the order the caller gave them (the
 * Life timeline's chronological order), each once.
 */
export function eventsForSermon(events: JesusEventCard[], sermon: Sermon): JesusEventCard[] {
  const seen = new Set<string>();
  return events.filter((event) => {
    if (seen.has(event.slug)) return false;
    const inside = (event.passages ?? []).some((passage) =>
      sermon.accounts.some((range) => passageStartsIn(passage, range))
    );
    if (inside) seen.add(event.slug);
    return inside;
  });
}
