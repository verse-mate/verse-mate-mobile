/**
 * Mock data: Matthew Chapter 5 (Sermon on the Mount - Beatitudes)
 *
 * Sample data for testing New Testament content
 */

import type { GetBibleChapterResponse } from '../../../src/api/generated';

export const mockMatthew5Response: GetBibleChapterResponse = {
  book: {
    bookId: 40,
    name: 'Matthew',
    testament: 'NT',
    genre: {
      g: 5,
      n: 'Gospels',
    },
    chapters: [
      {
        chapterNumber: 5,
        subtitles: [
          {
            subtitle: 'The Beatitudes',
            start_verse: 1,
            end_verse: 12,
          },
          {
            subtitle: 'Disciples and the World',
            start_verse: 13,
            end_verse: 16,
          },
        ],
        verses: [
          {
            verseNumber: 1,
            text: 'When Jesus saw the crowds, He went up on the mountain; and after He sat down, His disciples came to Him.',
          },
          {
            verseNumber: 2,
            text: 'He opened His mouth and began to teach them, saying,',
          },
          {
            verseNumber: 3,
            text: '"Blessed are the poor in spirit, for theirs is the kingdom of heaven.',
          },
          {
            verseNumber: 4,
            text: '"Blessed are those who mourn, for they shall be comforted.',
          },
          {
            verseNumber: 5,
            text: '"Blessed are the gentle, for they shall inherit the earth.',
          },
          {
            verseNumber: 6,
            text: '"Blessed are those who hunger and thirst for righteousness, for they shall be satisfied.',
          },
          {
            verseNumber: 13,
            text: '"You are the salt of the earth; but if the salt has become tasteless, how can it be made salty again? It is no longer good for anything, except to be thrown out and trampled under foot by men.',
          },
          {
            verseNumber: 14,
            text: '"You are the light of the world. A city set on a hill cannot be hidden;',
          },
        ],
      },
    ],
  },
};
