/**
 * Thin wrappers over the generated Bible Brain SDK.
 *
 * The generated names are unwieldy (`getBibleBrainAudioByFilesetIdByBookByChapter`),
 * and callers need a couple of behaviours the raw SDK does not express:
 *   - a stream-only fileset answers 404 on /download, which is a valid answer
 *     meaning "not licensed for offline", not a failure;
 *   - timestamps are normalized once here so the sync code can assume ordering.
 */
import {
  getBibleBrainAudioByFilesetIdByBookByChapter,
  getBibleBrainCopyrightByBibleId,
  getBibleBrainDownloadByFilesetIdByBookByChapter,
  getBibleBrainTextByFilesetIdByBookByChapter,
  getBibleBrainTimestampsByFilesetIdByBookByChapter,
  getBibleBrainVersions,
} from '@/src/api/generated/sdk.gen';
import type { ChapterRef } from './scripture-storage';
import { normalizeTimestamps, type VerseTimestamp } from './verse-sync';

export interface ScriptureFileset {
  id: string;
  type: string;
  size: string;
  offline_capable: boolean;
}

export interface ScriptureVersion {
  abbr: string;
  name: string;
  language: string;
  iso: string;
  text_filesets: ScriptureFileset[];
  audio_filesets: ScriptureFileset[];
  has_verse_timing: boolean;
  offline_capable: boolean;
}

export interface ScriptureChapterAudio {
  fileset_id: string;
  book_id: string;
  chapter: number;
  url: string;
  duration_seconds: number | null;
  filesize_bytes: number | null;
  offline_capable: boolean;
  expires_in_seconds: number | null;
}

/** Versions for a language, each flagged for offline + verse timing. */
export async function fetchScriptureVersions(
  language: string,
): Promise<ScriptureVersion[]> {
  const response = await getBibleBrainVersions({ query: { language } });
  return (response.data?.versions ?? []) as ScriptureVersion[];
}

/** Freshly signed streaming URL. The signature is short-lived — do not cache. */
export async function fetchChapterAudio(
  ref: ChapterRef,
): Promise<ScriptureChapterAudio | null> {
  const response = await getBibleBrainAudioByFilesetIdByBookByChapter({
    path: { filesetId: ref.filesetId, book: ref.book, chapter: ref.chapter },
  });
  return (response.data?.audio as ScriptureChapterAudio | undefined) ?? null;
}

export async function fetchVerseTimestamps(
  ref: ChapterRef,
): Promise<VerseTimestamp[]> {
  const response = await getBibleBrainTimestampsByFilesetIdByBookByChapter({
    path: { filesetId: ref.filesetId, book: ref.book, chapter: ref.chapter },
  });
  return normalizeTimestamps(response.data?.timestamps ?? []);
}

export async function fetchChapterText(
  ref: ChapterRef,
  range?: { verseStart?: number; verseEnd?: number },
): Promise<{ verse: number; text: string }[]> {
  const response = await getBibleBrainTextByFilesetIdByBookByChapter({
    path: { filesetId: ref.filesetId, book: ref.book, chapter: ref.chapter },
    query: { verse_start: range?.verseStart, verse_end: range?.verseEnd },
  });
  return (response.data?.verses ?? []) as { verse: number; text: string }[];
}

/** Copyright strings. The licence requires these be shown to the user. */
export async function fetchScriptureCopyright(
  bibleId: string,
): Promise<{ fileset_id: string; type: string; copyright: string | null }[]> {
  const response = await getBibleBrainCopyrightByBibleId({ path: { bibleId } });
  return (response.data?.filesets ?? []) as {
    fileset_id: string;
    type: string;
    copyright: string | null;
  }[];
}

/**
 * Licence-sanctioned download URL, or null when this fileset is stream-only.
 *
 * The backend answers 404 for a fileset outside our download allowlist. That is
 * expected for NLT/NKJV/CSB, so it is mapped to null rather than thrown — the
 * caller shows "streaming only" and playback still works.
 */
export async function resolveChapterDownloadUrl(
  ref: ChapterRef,
): Promise<string | null> {
  const response = await getBibleBrainDownloadByFilesetIdByBookByChapter({
    path: { filesetId: ref.filesetId, book: ref.book, chapter: ref.chapter },
    throwOnError: false,
  });
  const url = (response.data as { url?: string } | undefined)?.url;
  return typeof url === 'string' && url.length > 0 ? url : null;
}
