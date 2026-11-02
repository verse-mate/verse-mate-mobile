/**
 * Sermons are defined by reference, and the events inside one are found by
 * matching their passages. These pin the matching rules: a passage counts
 * when it STARTS inside the range (so the scene before a sermon stays out),
 * ranges may cross chapters, and each event is listed once, in timeline order.
 */
import { eventsForSermon, passageStartsIn, rangeLabel, SERMONS } from '@/lib/jesus/sermons';
import type { JesusEventCard, JesusEventPassage } from '@/types/jesus';

const passage = (
  book_id: number,
  chapter: number,
  verse_start: number | null,
  verse_end: number | null = verse_start
): JesusEventPassage => ({
  book_id,
  book_name: 'x',
  chapter,
  verse_start,
  verse_end,
  is_primary: true,
  display: `${book_id} ${chapter}:${verse_start}`,
});

const event = (slug: string, ...passages: JesusEventPassage[]) =>
  ({ slug, title: slug, passages }) as unknown as JesusEventCard;

function sermon(slug: string) {
  const found = SERMONS.find((s) => s.slug === slug);
  if (!found) throw new Error(`no sermon ${slug}`);
  return found;
}
const mount = sermon('sermon-on-the-mount');
const olivet = sermon('olivet-discourse');
const twelve = sermon('sending-the-twelve');

describe('sermons', () => {
  it('labels a range within one chapter and across chapters', () => {
    expect(rangeLabel(mount.accounts[0])).toBe('Matthew 5:1–7:29');
    expect(sermon('sermon-on-the-plain').accounts.map(rangeLabel)).toEqual(['Luke 6:17–49']);
  });

  it('matches a passage that starts inside a cross-chapter range', () => {
    expect(passageStartsIn(passage(40, 6, 9, 13), mount.accounts[0])).toBe(true); // Lord's Prayer
    expect(passageStartsIn(passage(40, 7, 24, 27), mount.accounts[0])).toBe(true); // two builders
    expect(passageStartsIn(passage(40, 8, 1, 4), mount.accounts[0])).toBe(false);
    expect(passageStartsIn(passage(42, 6, 9, 13), mount.accounts[0])).toBe(false); // wrong book
  });

  it('leaves out the scene just before the sermon', () => {
    // Matthew 10:1-4 names the Twelve; the mission discourse starts at 10:5.
    expect(passageStartsIn(passage(40, 10, 1, 4), twelve.accounts[0])).toBe(false);
    expect(passageStartsIn(passage(40, 10, 16, 23), twelve.accounts[0])).toBe(true);
  });

  it('treats a whole-chapter passage as starting at verse 1', () => {
    expect(passageStartsIn(passage(40, 25, null, null), olivet.accounts[0])).toBe(true);
    expect(passageStartsIn(passage(40, 23, null, null), olivet.accounts[0])).toBe(false);
  });

  it('finds events in any account, in the order given, each once', () => {
    const events = [
      event('beatitudes', passage(40, 5, 3, 12), passage(42, 6, 20, 23)),
      event('healing', passage(40, 8, 1, 4)),
      event('olivet-mark', passage(41, 13, 1, 2)),
      event('lords-prayer', passage(40, 6, 9, 13)),
      event('beatitudes', passage(40, 5, 3, 12)),
    ];
    expect(eventsForSermon(events, mount).map((e) => e.slug)).toEqual([
      'beatitudes',
      'lords-prayer',
    ]);
    expect(eventsForSermon(events, olivet).map((e) => e.slug)).toEqual(['olivet-mark']);
  });

  it('gives every sermon a unique slug and label key, and well-formed ranges', () => {
    expect(new Set(SERMONS.map((s) => s.slug)).size).toBe(SERMONS.length);
    expect(new Set(SERMONS.map((s) => s.key)).size).toBe(SERMONS.length);
    for (const sermon of SERMONS) {
      for (const r of sermon.accounts) {
        expect(r.to[0] > r.from[0] || (r.to[0] === r.from[0] && r.to[1] >= r.from[1])).toBe(true);
      }
    }
  });
});

describe('sermon labels', () => {
  const en = require('@/locales/en.json') as { jesus: { sermons: Record<string, string> } };
  it.each(SERMONS.map((s) => s.key))('English has a name and blurb for %s', (key) => {
    expect(typeof en.jesus.sermons[`${key}Name`]).toBe('string');
    expect(typeof en.jesus.sermons[`${key}Blurb`]).toBe('string');
  });
});
