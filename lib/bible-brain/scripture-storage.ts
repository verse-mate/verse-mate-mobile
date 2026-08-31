/**
 * Offline storage for Bible Brain scripture audio.
 *
 * Two rules from the Bible Brain licence drive this file:
 *
 *  1. Bytes may only be obtained through the backend's `/bible/brain/download`
 *     route, which enforces a per-fileset allowlist. A fileset that is
 *     stream-only answers 404 there, so `resolveDownloadUrl` returning null is
 *     a normal outcome — not an error — and must leave the user able to stream.
 *  2. Signed CDN URLs expire in under a day, so a download URL is minted per
 *     chapter at download time and never persisted.
 *
 * All I/O goes through an injected `ScriptureStoragePort` so the planning and
 * bookkeeping logic here is testable without a device, matching the pattern in
 * `lib/audio/audioResolver.ts`.
 */

export interface ChapterRef {
  /** Bible Brain fileset, e.g. `ENGESVN1DA`. */
  filesetId: string;
  /** USFM book code, e.g. `JHN`. */
  book: string;
  chapter: number;
}

export interface ScriptureStoragePort {
  /** App document directory, or null where there is no writable FS (web). */
  readonly rootUri: string | null;
  exists(uri: string): Promise<boolean>;
  ensureDir(uri: string): Promise<void>;
  /** Fetches `url` to `destUri`. Resolves with the on-disk size when known. */
  download(url: string, destUri: string): Promise<{ size: number | null }>;
  remove(uri: string): Promise<void>;
  /** Immediate children (names only) of a directory; [] when absent. */
  list(dirUri: string): Promise<string[]>;
  sizeOf(uri: string): Promise<number | null>;
}

/** Mints a fresh, licence-checked download URL. Null = stream-only fileset. */
export type ResolveDownloadUrl = (ref: ChapterRef) => Promise<string | null>;

const ROOT_FOLDER = "scripture-audio";

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

/** Directory holding every downloaded chapter of one fileset. */
export function filesetDirUri(rootUri: string, filesetId: string): string {
  return `${trimTrailingSlash(rootUri)}/${ROOT_FOLDER}/${filesetId}`;
}

/**
 * On-disk location of one chapter. Book and chapter live in the filename
 * rather than nested directories so a fileset's contents can be listed in one
 * call, which is what the Manage Downloads screen needs.
 */
export function chapterFileUri(rootUri: string, ref: ChapterRef): string {
  return `${filesetDirUri(rootUri, ref.filesetId)}/${ref.book}-${ref.chapter}.mp3`;
}

/** Inverse of the filename convention; null for anything unrecognised. */
export function parseChapterFileName(
  name: string,
): { book: string; chapter: number } | null {
  const match = /^([A-Z0-9]{3})-(\d{1,3})\.mp3$/.exec(name);
  if (!match) return null;
  const chapter = Number(match[2]);
  if (!Number.isInteger(chapter) || chapter < 1) return null;
  return { book: match[1], chapter };
}

/**
 * Playable URL for a chapter: the local file when it has been downloaded,
 * otherwise the caller's streaming URL.
 *
 * `isOffline` tells the player which one it got, so the UI can show an offline
 * badge and so analytics doesn't count a cached play as a stream.
 */
export async function resolveScriptureAudioUrl(
  ref: ChapterRef,
  streamUrl: string,
  storage: ScriptureStoragePort,
): Promise<{ url: string; isOffline: boolean }> {
  if (!storage.rootUri) return { url: streamUrl, isOffline: false };
  const local = chapterFileUri(storage.rootUri, ref);
  const hasLocal = await storage.exists(local);
  return hasLocal ? { url: local, isOffline: true } : { url: streamUrl, isOffline: false };
}

export interface DownloadProgress {
  completed: number;
  total: number;
  /** Chapter just finished, for a "Downloading John 3…" line. */
  current: ChapterRef;
}

export interface DownloadOutcome {
  downloaded: number;
  /** Already on disk, so no request was made. */
  skipped: number;
  /**
   * Chapters the licence does not permit downloading. Non-empty means the
   * fileset is stream-only; surface it as information, never as a failure.
   */
  notLicensed: ChapterRef[];
  /** Chapters that errored, with the reason, so the UI can offer a retry. */
  failed: { ref: ChapterRef; reason: string }[];
  bytesWritten: number;
}

/**
 * Downloads a set of chapters, skipping any already present.
 *
 * Sequential on purpose: these are ~2MB files on a phone radio, and the
 * progress bar is more useful than the throughput gain from parallelism. One
 * chapter failing does not abort the rest — a partial download is still worth
 * keeping, and the caller gets a per-chapter failure list to retry.
 */
export async function downloadChapters(
  refs: readonly ChapterRef[],
  storage: ScriptureStoragePort,
  resolveDownloadUrl: ResolveDownloadUrl,
  onProgress?: (progress: DownloadProgress) => void,
): Promise<DownloadOutcome> {
  const outcome: DownloadOutcome = {
    downloaded: 0,
    skipped: 0,
    notLicensed: [],
    failed: [],
    bytesWritten: 0,
  };
  if (!storage.rootUri) {
    return {
      ...outcome,
      failed: refs.map((ref) => ({ ref, reason: "no writable filesystem" })),
    };
  }

  for (let index = 0; index < refs.length; index++) {
    const ref = refs[index];
    const dest = chapterFileUri(storage.rootUri, ref);
    try {
      if (await storage.exists(dest)) {
        outcome.skipped += 1;
        continue;
      }
      const url = await resolveDownloadUrl(ref);
      if (!url) {
        outcome.notLicensed.push(ref);
        continue;
      }
      await storage.ensureDir(filesetDirUri(storage.rootUri, ref.filesetId));
      const { size } = await storage.download(url, dest);
      outcome.downloaded += 1;
      outcome.bytesWritten += size ?? 0;
    } catch (error) {
      outcome.failed.push({
        ref,
        reason: error instanceof Error ? error.message : String(error),
      });
    } finally {
      onProgress?.({ completed: index + 1, total: refs.length, current: ref });
    }
  }
  return outcome;
}

/** Chapters of a fileset currently on disk. */
export async function listDownloadedChapters(
  filesetId: string,
  storage: ScriptureStoragePort,
): Promise<{ book: string; chapter: number }[]> {
  if (!storage.rootUri) return [];
  const names = await storage.list(filesetDirUri(storage.rootUri, filesetId));
  return names
    .map(parseChapterFileName)
    .filter((entry): entry is { book: string; chapter: number } => entry !== null)
    .sort((a, b) => a.book.localeCompare(b.book) || a.chapter - b.chapter);
}

/** Total bytes a fileset occupies on disk. */
export async function filesetBytesOnDisk(
  filesetId: string,
  storage: ScriptureStoragePort,
): Promise<number> {
  if (!storage.rootUri) return 0;
  const dir = filesetDirUri(storage.rootUri, filesetId);
  const names = await storage.list(dir);
  let total = 0;
  for (const name of names) {
    if (!parseChapterFileName(name)) continue;
    total += (await storage.sizeOf(`${dir}/${name}`)) ?? 0;
  }
  return total;
}

/** Deletes every downloaded chapter of a fileset. Returns files removed. */
export async function deleteFilesetDownloads(
  filesetId: string,
  storage: ScriptureStoragePort,
): Promise<number> {
  if (!storage.rootUri) return 0;
  const dir = filesetDirUri(storage.rootUri, filesetId);
  const names = await storage.list(dir);
  let removed = 0;
  for (const name of names) {
    if (!parseChapterFileName(name)) continue;
    await storage.remove(`${dir}/${name}`);
    removed += 1;
  }
  return removed;
}

/**
 * Pre-download size estimate. Bible Brain mp3s are a constant 64 kbps, so
 * bytes ≈ seconds × 8000; `-opus16` filesets are 16 kbps (×2000). Used for the
 * "~N MB" warning before the user commits to a download.
 */
export function estimateChapterBytes(
  durationSeconds: number,
  filesetId: string,
): number {
  const bytesPerSecond = filesetId.endsWith("-opus16") ? 2000 : 8000;
  return Math.round(durationSeconds * bytesPerSecond);
}
