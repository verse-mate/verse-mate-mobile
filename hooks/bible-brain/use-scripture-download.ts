/**
 * Download manager for narrated scripture.
 *
 * Only versions Bible Brain licenses for download reach this hook — the rest
 * are streaming-only and the UI never offers a button for them. A chapter that
 * turns out not to be licensed mid-run is reported in `notLicensed` rather than
 * failing the batch, because the user can still stream it.
 */
import { useCallback, useMemo, useState } from 'react';
import { resolveChapterDownloadUrl } from '@/lib/bible-brain/api';
import { getExpoScriptureStorage } from '@/lib/bible-brain/expo-scripture-storage';
import {
  type ChapterRef,
  type DownloadOutcome,
  deleteChapterDownloads,
  deleteFilesetDownloads,
  downloadChapters,
  filesetBytesOnDisk,
  listDownloadedChapters,
  type ScriptureStoragePort,
} from '@/lib/bible-brain/scripture-storage';

export interface DownloadState {
  isDownloading: boolean;
  completed: number;
  total: number;
  /** Human-readable position, e.g. `JHN 3`. */
  currentLabel: string | null;
  outcome: DownloadOutcome | null;
  error: string | null;
}

const idleState: DownloadState = {
  isDownloading: false,
  completed: 0,
  total: 0,
  currentLabel: null,
  outcome: null,
  error: null,
};

export interface UseScriptureDownloadResult extends DownloadState {
  /** Downloads the given chapters, skipping any already on disk. */
  download: (refs: ChapterRef[]) => Promise<DownloadOutcome | null>;
  /** Removes every downloaded chapter of a fileset. */
  removeFileset: (filesetId: string) => Promise<number>;
  /** Removes just the given chapters — one book, not the whole testament. */
  removeChapters: (refs: ChapterRef[]) => Promise<number>;
  downloadedChapters: (filesetId: string) => Promise<{ book: string; chapter: number }[]>;
  bytesOnDisk: (filesetId: string) => Promise<number>;
  reset: () => void;
}

export function useScriptureDownload(
  /** Injectable for tests; defaults to the shared expo-backed port. */
  storageOverride?: ScriptureStoragePort
): UseScriptureDownloadResult {
  // Memoized so the callbacks below keep a stable identity across renders.
  const storage = useMemo(() => storageOverride ?? getExpoScriptureStorage(), [storageOverride]);
  const [state, setState] = useState<DownloadState>(idleState);

  const download = useCallback(
    async (refs: ChapterRef[]) => {
      if (refs.length === 0) return null;
      setState({ ...idleState, isDownloading: true, total: refs.length });
      try {
        const outcome = await downloadChapters(
          refs,
          storage,
          resolveChapterDownloadUrl,
          (progress) => {
            setState((prev) => ({
              ...prev,
              completed: progress.completed,
              total: progress.total,
              currentLabel: `${progress.current.book} ${progress.current.chapter}`,
            }));
          }
        );
        setState((prev) => ({
          ...prev,
          isDownloading: false,
          currentLabel: null,
          outcome,
        }));
        return outcome;
      } catch (err) {
        setState((prev) => ({
          ...prev,
          isDownloading: false,
          currentLabel: null,
          error: err instanceof Error ? err.message : String(err),
        }));
        return null;
      }
    },
    [storage]
  );

  const removeFileset = useCallback(
    (filesetId: string) => deleteFilesetDownloads(filesetId, storage),
    [storage]
  );

  const removeChapters = useCallback(
    (refs: ChapterRef[]) => deleteChapterDownloads(refs, storage),
    [storage]
  );

  const downloadedChapters = useCallback(
    (filesetId: string) => listDownloadedChapters(filesetId, storage),
    [storage]
  );

  const bytesOnDisk = useCallback(
    (filesetId: string) => filesetBytesOnDisk(filesetId, storage),
    [storage]
  );

  const reset = useCallback(() => setState(idleState), []);

  return {
    ...state,
    download,
    removeFileset,
    removeChapters,
    downloadedChapters,
    bytesOnDisk,
    reset,
  };
}
