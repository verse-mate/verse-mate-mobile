/**
 * MSW handlers for the Bible Brain (narrated scripture) endpoints.
 *
 * The fixtures mirror what production actually returns, measured against
 * `api.versemate.org`: ESV is licensed for download, NLT is stream-only and
 * answers 404 on /download, and ESV John 3 has 37 verse timestamps over 273s
 * of audio.
 */
import { HttpResponse, http } from 'msw';

const BIBLE_API_BASE_URL = 'http://localhost:4000';

/** A signed CloudFront URL shaped like the real thing. */
export const MOCK_SIGNED_AUDIO_URL =
  'https://d1gd73roq7kqw6.cloudfront.net/audio/ENGESV/ENGESVN1DA/ENGESVN1DA_B04_JHN_003.mp3?Expires=2000000000&Signature=abc&Key-Pair-Id=K1';

/** Filesets our key may download, per the backend's allowlist probe. */
const DOWNLOADABLE_FILESETS = new Set([
  'ENGESVN1DA',
  'ENGESVN1DA-opus16',
  'ENGESVO1DA',
  'ENGKJVN1DA',
  'ENGBERN1DA',
]);

export const mockScriptureVersions = [
  {
    abbr: 'ENGESV',
    name: 'English Standard Version®',
    language: 'English: USA',
    iso: 'eng',
    text_filesets: [{ id: 'ENGESV', type: 'text_plain', size: 'C', offline_capable: false }],
    audio_filesets: [
      { id: 'ENGESVN1DA', type: 'audio', size: 'NT', offline_capable: true },
      { id: 'ENGESVO1DA', type: 'audio', size: 'OT', offline_capable: true },
      {
        id: 'ENGESVN1DA-opus16',
        type: 'audio',
        size: 'NT',
        offline_capable: true,
      },
    ],
    has_verse_timing: true,
    offline_capable: true,
  },
  {
    abbr: 'ENGNLH',
    name: 'New Living Translation® - her.BIBLE',
    language: 'English: USA',
    iso: 'eng',
    text_filesets: [],
    audio_filesets: [{ id: 'ENGNLHN1DA', type: 'audio', size: 'NT', offline_capable: false }],
    // Timed, but stream-only — the combination the download UI must handle.
    has_verse_timing: true,
    offline_capable: false,
  },
  {
    abbr: 'ENGBER',
    name: 'English - Berean Standard',
    language: 'English: USA',
    iso: 'eng',
    text_filesets: [],
    audio_filesets: [{ id: 'ENGBERN1DA', type: 'audio', size: 'NT', offline_capable: true }],
    // Downloadable but has no verse timing.
    has_verse_timing: false,
    offline_capable: true,
  },
  {
    abbr: 'ENGASV',
    name: 'American Standard Version',
    language: 'English: USA',
    iso: 'eng',
    text_filesets: [{ id: 'ENGASV', type: 'text_plain', size: 'C', offline_capable: false }],
    // Text only — must not appear in either audio bucket.
    audio_filesets: [],
    has_verse_timing: false,
    offline_capable: false,
  },
];

/** ESV John 3, first six verses at their real offsets. */
export const mockJohn3Timestamps = [
  { verse: 1, seconds: 2.78 },
  { verse: 2, seconds: 8 },
  { verse: 3, seconds: 20.36 },
  { verse: 4, seconds: 28.6 },
  { verse: 5, seconds: 38.19 },
  { verse: 6, seconds: 47.88 },
];

export const bibleBrainHandlers = [
  http.get(`${BIBLE_API_BASE_URL}/bible/brain/versions`, ({ request }) => {
    const language = new URL(request.url).searchParams.get('language');
    if (!language) {
      return HttpResponse.json(
        { error: 'VALIDATION_ERROR', message: 'Invalid request data' },
        { status: 422 }
      );
    }
    if (language !== 'eng') return HttpResponse.json({ versions: [] });
    return HttpResponse.json({ versions: mockScriptureVersions });
  }),

  http.get(`${BIBLE_API_BASE_URL}/bible/brain/audio/:filesetId/:book/:chapter`, ({ params }) => {
    return HttpResponse.json({
      audio: {
        fileset_id: params.filesetId,
        book_id: params.book,
        chapter: Number(params.chapter),
        url: MOCK_SIGNED_AUDIO_URL,
        duration_seconds: 273,
        filesize_bytes: 2_196_712,
        offline_capable: DOWNLOADABLE_FILESETS.has(String(params.filesetId)),
        expires_in_seconds: 69_000,
      },
    });
  }),

  http.get(
    `${BIBLE_API_BASE_URL}/bible/brain/timestamps/:filesetId/:book/:chapter`,
    ({ params }) => {
      return HttpResponse.json({
        fileset_id: params.filesetId,
        book_id: params.book,
        chapter: Number(params.chapter),
        timestamps: mockJohn3Timestamps,
      });
    }
  ),

  http.get(`${BIBLE_API_BASE_URL}/bible/brain/text/:filesetId/:book/:chapter`, ({ params }) => {
    return HttpResponse.json({
      fileset_id: params.filesetId,
      book_id: params.book,
      chapter: Number(params.chapter),
      verses: [
        {
          verse: 16,
          text: '“For God so loved the world, that he gave his only Son...',
        },
      ],
    });
  }),

  http.get(`${BIBLE_API_BASE_URL}/bible/brain/copyright/:bibleId`, ({ params }) => {
    return HttpResponse.json({
      bible_id: params.bibleId,
      filesets: [
        {
          fileset_id: 'ENGESVN1DA',
          type: 'audio',
          copyright: 'Text: The ESV Bible® Copyright © 2001 by Crossway. Audio: ℗ 2009 Hosanna',
        },
      ],
    });
  }),

  /**
   * The licence gate. A fileset outside the allowlist answers 404, exactly as
   * production does for NLT / NKJV / CSB.
   */
  http.get(`${BIBLE_API_BASE_URL}/bible/brain/download/:filesetId/:book/:chapter`, ({ params }) => {
    const filesetId = String(params.filesetId);
    if (!DOWNLOADABLE_FILESETS.has(filesetId)) {
      return HttpResponse.json(
        {
          error: 'NOT_FOUND',
          message: `${filesetId} is not licensed for offline download`,
        },
        { status: 404 }
      );
    }
    return HttpResponse.json({
      fileset_id: filesetId,
      book_id: params.book,
      chapter: Number(params.chapter),
      url: MOCK_SIGNED_AUDIO_URL,
      filesize_bytes: 2_196_712,
      duration_seconds: 273,
    });
  }),
];
