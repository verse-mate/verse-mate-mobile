/**
 * TASK-010: AudioResolver — pick a local `file://` URL if we've cached
 * the audio for this (explanation_id, voice, language, content_hash)
 * during a bundle download; else fall back to the presigned streaming
 * URL provided by the server.
 *
 * The bundle download routine in services/offline/seed-manager.ts
 * writes into `FileSystem.documentDirectory + audio/explanation-audio/
 * {explanation_id}/{voice}/{language}/{content_hash}.mp3`. Since the
 * filename includes the content_hash, a server-side audio regen
 * (which changes the hash) naturally invalidates the local cache
 * without any extra bookkeeping.
 */
export interface AudioManifestEntry {
  explanation_id: number;
  voice: string;
  language_code: string;
  content_hash: string;
  duration_seconds: number;
  audio_url: string;
}

export interface FileSystemLike {
  documentDirectory: string | null;
  /** Returns true iff a file exists at the given path. */
  exists(path: string): Promise<boolean>;
}

export function localAudioPath(
  documentDirectory: string,
  entry: AudioManifestEntry,
): string {
  return `${documentDirectory.replace(/\/$/, "")}/audio/explanation-audio/${entry.explanation_id}/${entry.voice}/${entry.language_code}/${entry.content_hash}.mp3`;
}

export async function resolveAudioUrl(
  entry: AudioManifestEntry,
  fs: FileSystemLike,
): Promise<string> {
  if (!fs.documentDirectory) return entry.audio_url;
  const path = localAudioPath(fs.documentDirectory, entry);
  const hasLocal = await fs.exists(path);
  return hasLocal ? `file://${path}` : entry.audio_url;
}

/**
 * Bundle download hook. Caller walks the manifest, invokes this for
 * every audio entry, and reports progress via `onProgress` so the
 * Download Manager screen can draw a bar. Returns the number of audio
 * files newly written to disk (useful for the storage-stats screen).
 *
 * The actual fetch + file write are injected so this module stays
 * free of `expo-file-system` / `fetch` concrete types.
 */
export interface AudioDownloadDeps {
  fs: FileSystemLike & {
    makeDirectoryAsync(path: string, opts: { intermediates: true }): Promise<void>;
    downloadAsync(url: string, localPath: string): Promise<{ uri: string }>;
    deleteAsync(path: string, opts: { idempotent: true }): Promise<void>;
  };
}

export async function downloadAudios(
  entries: AudioManifestEntry[],
  deps: AudioDownloadDeps,
  onProgress?: (done: number, total: number) => void,
): Promise<{ downloaded: number; skipped: number }> {
  if (!deps.fs.documentDirectory) return { downloaded: 0, skipped: 0 };
  let downloaded = 0;
  let skipped = 0;
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const path = localAudioPath(deps.fs.documentDirectory, entry);
    if (await deps.fs.exists(path)) {
      skipped += 1;
      onProgress?.(i + 1, entries.length);
      continue;
    }
    const dir = path.substring(0, path.lastIndexOf("/"));
    await deps.fs.makeDirectoryAsync(dir, { intermediates: true });
    await deps.fs.downloadAsync(entry.audio_url, path);
    downloaded += 1;
    onProgress?.(i + 1, entries.length);
  }
  return { downloaded, skipped };
}

/**
 * Delete every audio file for a language bundle. Called from the
 * Manage Downloads screen when the user deletes a language.
 */
export async function deleteLanguageAudios(
  languageCode: string,
  entries: AudioManifestEntry[],
  deps: AudioDownloadDeps,
): Promise<number> {
  if (!deps.fs.documentDirectory) return 0;
  let removed = 0;
  for (const entry of entries) {
    if (entry.language_code !== languageCode) continue;
    const path = localAudioPath(deps.fs.documentDirectory, entry);
    if (await deps.fs.exists(path)) {
      await deps.fs.deleteAsync(path, { idempotent: true });
      removed += 1;
    }
  }
  return removed;
}

/**
 * Rough estimator for the "N audios · X MB" line on Manage Downloads.
 * Uses duration × 16 KB/s (128 kbps MP3) as the size heuristic. Good
 * enough for a pre-download warning; actual on-disk size is surfaced
 * after the download via fs stats.
 */
export function estimateAudioBundleBytes(entries: AudioManifestEntry[]): number {
  let bytes = 0;
  for (const e of entries) {
    bytes += Math.round(e.duration_seconds * 16 * 1024);
  }
  return bytes;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
