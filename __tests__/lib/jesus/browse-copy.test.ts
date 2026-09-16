/**
 * The category browse counts, which is what the tester compared against web.
 *
 * The app reported "36 commands" where web reports "50 COMMANDS · 36 MOMENTS ·
 * 10 TOPICS" — it had labelled the EVENT count with the category noun. The two
 * numbers mean different things: `event_count` is how many scenes a category
 * spans, `facet_count` how many things He said or did in them, and one scene
 * can hold several. The live payload for `commands` carries facet_count 50 and
 * event_count 36, which is where these fixtures come from.
 */
import { categoryStats, countLabel, topicCount, topicGospels } from '@/lib/jesus/browse-copy';
import type { JesusBrowse, JesusTopicGroup } from '@/types/jesus';

function topic(over: Partial<JesusTopicGroup> = {}): JesusTopicGroup {
  return {
    slug: 'kingdom',
    name: 'Kingdom',
    description: null,
    brief: null,
    brief_provenance: null,
    gospels: [],
    events: [],
    points: [],
    sort_order: 0,
    event_count: 0,
    facet_count: 0,
    ...(over as object),
  };
}

function browse(over: Partial<JesusBrowse> = {}): JesusBrowse {
  return {
    type: {
      type: 'COMMAND',
      mode: 'WORD',
      slug: 'commands',
      label: 'Commands',
      singular: 'Command',
      plural: 'commands',
      section: 'words',
      blurb: '',
      intro: '',
      event_count: 36,
      facet_count: 50,
    },
    topics: [],
    total_events: 36,
    truncated: false,
    ...(over as object),
  } as JesusBrowse;
}

describe('countLabel', () => {
  it('lower-cases a title-cased noun for mid-sentence use', () => {
    // Labels arrive title-cased for headings ("Act of compassion").
    expect(countLabel(3, 'Act of compassion', 'acts of compassion')).toBe('3 acts of compassion');
  });

  it('uses the singular at exactly one', () => {
    expect(countLabel(1, 'Command', 'commands')).toBe('1 command');
    expect(countLabel(2, 'Command', 'commands')).toBe('2 commands');
  });

  it('degrades to the bare number when the taxonomy carries no noun', () => {
    // A missing label must not take a browse screen down: the count is the
    // load-bearing half.
    expect(countLabel(9)).toBe('9');
    expect(countLabel(9, undefined, '')).toBe('9');
  });
});

describe('categoryStats', () => {
  it('reports facets, moments and topics separately — the reported bug', () => {
    // Exactly what web renders for /jesus/events/browse/commands. Reporting
    // total_events here is what produced "36 commands" for a category holding
    // 50 of them.
    const stats = categoryStats(browse({ topics: Array.from({ length: 10 }, () => topic()) }));
    expect(stats).toBe('50 commands · 36 moments · 10 topics');
  });

  it('falls back to the event count when the taxonomy has no facet count', () => {
    const stats = categoryStats(
      browse({
        type: { ...browse().type, facet_count: 0 },
        topics: [topic()],
      })
    );
    expect(stats).toBe('36 commands · 36 moments · 1 topic');
  });

  it('omits moments entirely when there are none', () => {
    const stats = categoryStats(browse({ total_events: 0, topics: [topic()] }));
    expect(stats).toBe('50 commands · 1 topic');
  });

  it('singularises one moment and one topic', () => {
    const stats = categoryStats(browse({ total_events: 1, topics: [topic()] }));
    expect(stats).toContain('1 moment');
    expect(stats).toContain('1 topic');
    expect(stats).not.toContain('1 moments');
  });
});

describe('topicCount', () => {
  it('names the noun rather than printing a bare number', () => {
    // The section header read "9"; web reads "9 commands".
    expect(topicCount(topic({ facet_count: 9, event_count: 4 }), 'Command', 'commands')).toBe(
      '9 commands'
    );
  });

  it('prefers the facet count over the event count', () => {
    expect(topicCount(topic({ facet_count: 9, event_count: 4 }), 'Command', 'commands')).toBe(
      '9 commands'
    );
    expect(topicCount(topic({ facet_count: 0, event_count: 4 }), 'Command', 'commands')).toBe(
      '4 commands'
    );
  });
});

describe('topicGospels', () => {
  it('stays empty rather than dangling a lone Gospel with nothing to compare', () => {
    expect(topicGospels(topic({ gospels: ['Matthew'] }))).toBe('');
    expect(topicGospels(topic({ gospels: [] }))).toBe('');
  });

  it('joins several, deduped', () => {
    // An event told twice by one Gospel must not print it twice.
    expect(topicGospels(topic({ gospels: ['Matthew', 'Mark', 'Matthew'] }))).toBe('Matthew · Mark');
  });
});
