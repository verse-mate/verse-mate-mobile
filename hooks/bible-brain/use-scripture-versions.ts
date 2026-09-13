/**
 * Bible Brain versions for a language, split into what can go offline and what
 * cannot.
 *
 * Which versions may be downloaded is decided by Bible Brain per fileset, not
 * by us — the backend probes its `/download` allowlist and returns an
 * `offline_capable` flag per version. The download UI keys off that: licensed
 * versions get a download button, the rest are marked streaming-only.
 */
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { fetchScriptureVersions, type ScriptureVersion } from '@/lib/bible-brain/api';

/** Cheap on the client, but the backend probes upstream — cache generously. */
const VERSIONS_STALE_MS = 60 * 60 * 1000;

/**
 * One shared empty array for "no data yet".
 *
 * `query.data ?? []` looks harmless but mints a fresh array on every render
 * while the query is loading or failed, and consumers memoize off it. A
 * consumer that then sets state from an effect keyed on that array re-renders
 * itself forever — and "failed" is the offline case, which is exactly when the
 * narration UI is on screen.
 */
const NO_VERSIONS: ScriptureVersion[] = [];

export interface UseScriptureVersionsResult {
  versions: ScriptureVersion[];
  /** Downloadable for offline listening. */
  offlineCapable: ScriptureVersion[];
  /** Has audio, but may only be streamed. */
  streamOnly: ScriptureVersion[];
  /** Downloadable *and* verse-timed — the best experience in the reader. */
  bestForReader: ScriptureVersion[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
}

export function useScriptureVersions(language: string): UseScriptureVersionsResult {
  const query = useQuery({
    queryKey: ['scripture-versions', language],
    queryFn: () => fetchScriptureVersions(language),
    staleTime: VERSIONS_STALE_MS,
    enabled: Boolean(language),
  });

  const versions = query.data ?? NO_VERSIONS;

  const buckets = useMemo(() => {
    const offlineCapable: ScriptureVersion[] = [];
    const streamOnly: ScriptureVersion[] = [];
    const bestForReader: ScriptureVersion[] = [];
    for (const version of versions) {
      const hasAudio = version.audio_filesets.length > 0;
      if (version.offline_capable) {
        offlineCapable.push(version);
        if (version.has_verse_timing) bestForReader.push(version);
      } else if (hasAudio) {
        streamOnly.push(version);
      }
    }
    return { offlineCapable, streamOnly, bestForReader };
  }, [versions]);

  return {
    versions,
    ...buckets,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Audio filesets of a version that cover a given testament.
 *
 * Bible Brain splits narration into NT and OT filesets (`…N1DA` / `…O1DA`), so
 * playing John needs the NT one. `-opus16` variants are preferred when
 * `preferSmall` is set — same narration at 16 kbps instead of 64, which matters
 * for a whole-testament download over cellular.
 */
export function pickAudioFileset(
  version: ScriptureVersion | undefined,
  testament: 'NT' | 'OT',
  preferSmall = false
): string | null {
  if (!version) return null;
  const candidates = version.audio_filesets.filter((fileset) => {
    const size = (fileset.size || '').toUpperCase();
    return testament === 'NT' ? size.includes('NT') : size.includes('OT');
  });
  if (candidates.length === 0) return null;
  const small = candidates.filter((f) => f.id.endsWith('-opus16'));
  const full = candidates.filter((f) => !f.id.endsWith('-opus16'));
  const ordered = preferSmall ? [...small, ...full] : [...full, ...small];
  return ordered[0]?.id ?? null;
}
