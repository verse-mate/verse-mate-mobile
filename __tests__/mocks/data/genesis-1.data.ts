/**
 * Mock data: Genesis Chapter 1
 *
 * Real API response from GET /bible/book/1/1
 */

import type { GetBibleChapterResponse } from '../../../src/api/generated';

export const mockGenesis1Response: GetBibleChapterResponse = {
  book: {
    bookId: 1,
    name: 'Genesis',
    testament: 'OT',
    genre: {
      g: 1,
      n: 'Law',
    },
    chapters: [
      {
        chapterNumber: 1,
        subtitles: [
          {
            subtitle: 'The Creation',
            start_verse: 1,
            end_verse: 31,
          },
        ],
        verses: [
          {
            verseNumber: 1,
            text: 'In the beginning God created the heavens and the earth.',
          },
          {
            verseNumber: 2,
            text: 'The earth was formless and void, and darkness was over the surface of the deep, and the Spirit of God was moving over the surface of the waters.',
          },
          {
            verseNumber: 3,
            text: 'Then God said, "Let there be light"; and there was light.',
          },
          {
            verseNumber: 4,
            text: 'God saw that the light was good; and God separated the light from the darkness.',
          },
          {
            verseNumber: 5,
            text: 'God called the light day, and the darkness He called night. And there was evening and there was morning, one day.',
          },
          {
            verseNumber: 6,
            text: 'Then God said, "Let there be an expanse in the midst of the waters, and let it separate the waters from the waters."',
          },
          {
            verseNumber: 7,
            text: 'God made the expanse, and separated the waters which were below the expanse from the waters which were above the expanse; and it was so.',
          },
          {
            verseNumber: 8,
            text: 'God called the expanse heaven. And there was evening and there was morning, a second day.',
          },
          {
            verseNumber: 9,
            text: 'Then God said, "Let the waters below the heavens be gathered into one place, and let the dry land appear"; and it was so.',
          },
          {
            verseNumber: 10,
            text: 'God called the dry land earth, and the gathering of the waters He called seas; and God saw that it was good.',
          },
          // Abbreviated for test purposes - real API has all 31 verses
          {
            verseNumber: 31,
            text: 'God saw all that He had made, and behold, it was very good. And there was evening and there was morning, the sixth day.',
          },
        ],
      },
    ],
  },
};

export const mockGenesis1Summary = {
  explanation: {
    book_id: 1,
    chapter_number: 1,
    type: 'summary',
    explanation: `# Summary of Genesis 1

## Overview
Genesis 1 begins with God creating the heavens and the earth through His spoken word. Over six days, God brings order to the formless earth, creating light, sky, land, vegetation, celestial bodies, sea creatures, birds, land animals, and finally humanity in His image.

## Key Themes
- **Creation by Divine Command**: God speaks and creation happens
- **Order from Chaos**: Systematic progression from formless to formed
- **Humanity's Special Role**: Made in God's image to rule creation
- **Goodness of Creation**: Repeated affirmation that creation is "good"

## Structure
Days 1-3: Forming the realms (light, sky, land)
Days 4-6: Filling the realms (sun/moon, sea/air life, land animals and humans)
Day 7: Rest (Sabbath pattern)`,
    explanation_id: 10170,
    language_code: 'en-US',
  },
};
