/**
 * uniqueGospels
 *
 * The API lists one entry per passage, not per Gospel, which was visible on the
 * timeline as "John · John · John" for Nicodemus. Measured against prod: 8+
 * events carry duplicates, up to five entries for three Gospels.
 */
import { uniqueGospels } from '@/components/jesus/JesusParts';

describe('uniqueGospels', () => {
  it('collapses the repeats an event with several passages produces', () => {
    // The real payload for `nicodemus`.
    expect(uniqueGospels(['John', 'John', 'John'])).toEqual(['John']);
  });

  it('keeps first-seen order so the Gospels stay in canonical sequence', () => {
    // The real payload for `event-withered-hand`.
    expect(uniqueGospels(['Matthew', 'Mark', 'Luke', 'Luke', 'Luke'])).toEqual([
      'Matthew',
      'Mark',
      'Luke',
    ]);
  });

  it('treats a missing list as none rather than throwing', () => {
    expect(uniqueGospels(undefined)).toEqual([]);
    expect(uniqueGospels(null)).toEqual([]);
  });
});
