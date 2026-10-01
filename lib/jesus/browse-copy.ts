/**
 * Copy helpers for the topic-grouped category browse.
 *
 * Ported from verse-mate-web `src/lib/jesusBrowse.ts` so the two surfaces
 * report the same numbers in the same words. The first port counted
 * `total_events` and labelled it with the category noun, which reads as
 * "36 commands" on a category holding 50 of them — `event_count` is how many
 * SCENES the category spans, `facet_count` how many things He actually said or
 * did in them, and one event can hold several. Web names the two separately;
 * this had blurred them into one wrong number.
 *
 * Kept out of the component so the phrasing — which is what the reader
 * actually judges the screen by — can be tested without rendering anything.
 */
import type { JesusBrowse, JesusTopicGroup } from '@/types/jesus';

/**
 * "8 teachings" / "1 teaching" / "3 acts of compassion".
 *
 * The nouns come from the API rather than being pluralised here: "Compassion"
 * is already a plural label but not a countable one, and only the taxonomy
 * knows that.
 */
export function countLabel(
  count: number,
  singular?: string,
  plural?: string,
  language = 'en'
): string {
  const noun = count === 1 ? singular : plural;
  // A taxonomy that carries no noun degrades to the bare number rather than
  // throwing — the count is the load-bearing half, and a browse screen must
  // not fail to render because one label is missing.
  if (!noun) return String(count);
  // Labels arrive title-cased for headings ("Act of compassion"); mid-sentence
  // they read as nouns. German capitalises nouns, so it keeps the label as is.
  if (keepsNounCase(language)) return `${count} ${noun}`;
  return `${count} ${noun.charAt(0).toLowerCase()}${noun.slice(1)}`;
}

function keepsNounCase(language: string): boolean {
  return language.toLowerCase().split(/[-_]/)[0] === 'de';
}

/** The subset of i18next's `t` these helpers use. */
export type Translate = (
  key: string,
  defaultValue: string,
  options: Record<string, unknown>
) => string;

/**
 * The line under the intro: how much there is and how it is divided.
 *
 * Reports what the screen actually shows — "50 commands · 36 moments ·
 * 10 topics". `facet_count` falls back to `total_events` only when the
 * taxonomy does not carry one, so a category with no facet data still
 * reports a real number rather than a zero. The category noun comes from the
 * API (in the content language); "moments" and "topics" are the app's own
 * words, so they come from the locale with its plural forms.
 */
export function categoryStats(browse: JesusBrowse, t: Translate, language = 'en'): string {
  const { type, topics, total_events } = browse;
  const parts = [
    countLabel(type.facet_count || total_events, type.singular, type.plural, language),
  ];
  if (total_events) {
    parts.push(t('jesus.browse.moments', '{{count}} moments', { count: total_events }));
  }
  if (topics.length) {
    parts.push(t('jesus.browse.topics', '{{count}} topics', { count: topics.length }));
  }
  return parts.join(' · ');
}

/** The heading a topic gets: its name plus how much of the category sits there. */
export function topicCount(
  topic: JesusTopicGroup,
  singular?: string,
  plural?: string,
  language = 'en'
): string {
  return countLabel(topic.facet_count || topic.event_count, singular, plural, language);
}

/**
 * Where a topic's material sits in the Gospels.
 *
 * Returns an empty string rather than a lone "Matthew" dangling on its own row
 * when there is nothing to compare it against.
 */
export function topicGospels(topic: JesusTopicGroup): string {
  const gospels = [...new Set(topic.gospels ?? [])];
  if (gospels.length < 2) return '';
  return gospels.join(' · ');
}
