/**
 * Narration for the Bible version currently being read.
 *
 * There is no audio-language picker by design. The user already chose a
 * translation; narration follows it. If the same translation exists as audio
 * (reading ESV → ESV narration) that is what plays, otherwise the best
 * available voice in the same language, preferring one with verse timing so
 * the reader can follow along.
 */

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { pickAudioFileset, useScriptureVersions } from '@/hooks/bible-brain/use-scripture-versions';
import { useScriptureVoice } from '@/hooks/bible-brain/use-scripture-voice';
import { useBibleVersion } from '@/hooks/use-bible-version';
import type { ScriptureVersion } from '@/lib/bible-brain/api';
import { bibleBrainLanguage, isSameTranslation } from '@/lib/bible-brain/language';
import { getBibleVersions } from '@/src/api/generated/sdk.gen';

export interface ScriptureForVersionResult {
  /** ISO-639-3 for the version being read, or null if we can't map it. */
  language: string | null;
  /** Narrated versions available in that language. */
  versions: ScriptureVersion[];
  offlineCapable: ScriptureVersion[];
  streamOnly: ScriptureVersion[];
  /** The one to play: the user's chosen voice, else the automatic pick. */
  preferred: ScriptureVersion | null;
  /** The stored override, or null when the voice is picked automatically. */
  chosenVoiceAbbr: string | null;
  /** True when `preferred` is the same translation the user is reading. */
  preferredMatchesReading: boolean;
  /** The app's version key being read, e.g. `NASB1995`. */
  readingVersionKey: string | null;
  isLoading: boolean;
  /** The language is known but the provider has no narration for it. */
  unavailableForLanguage: boolean;
}

export function useScriptureForVersion(): ScriptureForVersionResult {
  const { bibleVersion } = useBibleVersion();
  const { voiceAbbr, isLoading: voiceLoading } = useScriptureVoice();

  // The app's own catalogue is what carries `language_code`; it is small and
  // effectively static, so it is cached for the session.
  const { data: appVersions, isLoading: catalogueLoading } = useQuery({
    queryKey: ['bible-versions-catalogue'],
    queryFn: async () => {
      // The endpoint answers `{ versions: [...] }`, not a bare array.
      const response = await getBibleVersions();
      const payload = response.data as
        | { versions?: { version_key?: string; language_code?: string }[] }
        | undefined;
      return payload?.versions ?? [];
    },
    staleTime: Number.POSITIVE_INFINITY,
  });

  const languageCode = useMemo(
    () =>
      (Array.isArray(appVersions) ? appVersions : []).find((v) => v.version_key === bibleVersion)
        ?.language_code,
    [appVersions, bibleVersion]
  );

  const language = bibleBrainLanguage(languageCode);
  const {
    versions,
    offlineCapable,
    streamOnly,
    isLoading: versionsLoading,
  } = useScriptureVersions(language ?? '');
  /**
   * The catalogue fetch counts as loading too. Without it the hook reports
   * "no narration for this language" for a frame before the catalogue lands,
   * which flashes the unavailable state on every mount.
   */
  const isLoading = catalogueLoading || versionsLoading || voiceLoading;

  const preferred = useMemo(() => {
    if (versions.length === 0) return null;
    const withAudio = versions.filter((v) => v.audio_filesets.length > 0);
    if (withAudio.length === 0) return null;

    // 0. An explicit choice wins over everything. Ignored rather than honoured
    //    when it is not narrated in this language — switching the reader from
    //    an English to a Romanian translation must not leave it silent.
    const chosen = voiceAbbr ? withAudio.find((v) => v.abbr === voiceAbbr) : undefined;
    if (chosen) return chosen;

    // 1. The same translation, if it is narrated.
    const exact = bibleVersion
      ? withAudio.find((v) => isSameTranslation(v.abbr, bibleVersion))
      : undefined;
    if (exact) return exact;

    // 2. Otherwise the most capable voice in the language: timed beats
    //    untimed (follow-along works), downloadable beats stream-only.
    const score = (v: ScriptureVersion) =>
      (v.has_verse_timing ? 2 : 0) + (v.offline_capable ? 1 : 0);
    return [...withAudio].sort((a, b) => score(b) - score(a))[0] ?? null;
  }, [versions, bibleVersion, voiceAbbr]);

  return {
    language,
    versions,
    offlineCapable,
    streamOnly,
    preferred,
    chosenVoiceAbbr: voiceAbbr,
    preferredMatchesReading: Boolean(
      preferred && bibleVersion && isSameTranslation(preferred.abbr, bibleVersion)
    ),
    readingVersionKey: bibleVersion ?? null,
    isLoading,
    unavailableForLanguage: !isLoading && language !== null && versions.length === 0,
  };
}

/** Audio fileset to play for a version, respecting the chapter's testament. */
export function filesetFor(
  version: ScriptureVersion | null,
  testament: 'NT' | 'OT'
): string | null {
  return version ? pickAudioFileset(version, testament) : null;
}
