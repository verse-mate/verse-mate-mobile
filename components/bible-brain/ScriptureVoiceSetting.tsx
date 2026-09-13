/**
 * "Narration voice" in Settings, under Language Preferences.
 *
 * There is still no audio-*language* picker: the voices offered are the ones
 * Bible Brain has for the language of the translation being read. What this
 * adds is the choice *within* that language, which until now only existed
 * implicitly — the app picked one and the only place you could see the others
 * was the downloads screen.
 *
 * Offline, the list narrows to voices with chapters actually on disk. Showing
 * a voice that cannot play is worse than a short list, and "why is this one
 * greyed out" is answered by the row itself rather than by a toast after the
 * tap.
 */
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useOfflineContext } from '@/contexts/OfflineContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useScriptureDownload } from '@/hooks/bible-brain/use-scripture-download';
import { useScriptureForVersion } from '@/hooks/bible-brain/use-scripture-for-version';
import { pickAudioFileset } from '@/hooks/bible-brain/use-scripture-versions';
import { useScriptureVoice } from '@/hooks/bible-brain/use-scripture-voice';
import type { ScriptureVersion } from '@/lib/bible-brain/api';
import { isSameTranslation } from '@/lib/bible-brain/language';
import { fontSizes, spacing } from '@/theme/tokens';

/** Both filesets of a version, NT and OT, ignoring the ones it does not have. */
function filesetsOf(version: ScriptureVersion): string[] {
  return (['NT', 'OT'] as const)
    .map((testament) => pickAudioFileset(version, testament))
    .filter((id): id is string => id !== null);
}

export function ScriptureVoiceSetting() {
  const { colors } = useTheme();
  const { isOnline } = useOfflineContext();
  const { versions, preferred, language, readingVersionKey, isLoading, unavailableForLanguage } =
    useScriptureForVersion();
  const { voiceAbbr, setVoiceAbbr } = useScriptureVoice();
  const { downloadedChapters } = useScriptureDownload();

  const [expanded, setExpanded] = useState(false);
  const [downloadedAbbrs, setDownloadedAbbrs] = useState<Set<string> | null>(null);

  const narrated = useMemo(
    () => versions.filter((version) => version.audio_filesets.length > 0),
    [versions]
  );

  // Which voices have anything on disk. Needed to render the offline list, and
  // worth showing online too — it is the difference between instant playback
  // and a network round-trip per chapter.
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      narrated.map(async (version) => {
        for (const filesetId of filesetsOf(version)) {
          const chapters = await downloadedChapters(filesetId);
          if (chapters.length > 0) return version.abbr;
        }
        return null;
      })
    ).then((hits) => {
      if (cancelled) return;
      setDownloadedAbbrs(new Set(hits.filter((abbr): abbr is string => abbr !== null)));
    });
    return () => {
      cancelled = true;
    };
  }, [narrated, downloadedChapters]);

  const selectable = useMemo(() => {
    if (isOnline) return narrated;
    if (!downloadedAbbrs) return [];
    return narrated.filter((version) => downloadedAbbrs.has(version.abbr));
  }, [isOnline, narrated, downloadedAbbrs]);

  if (isLoading) {
    return (
      <View style={styles.stateBlock} testID="scripture-voice-loading">
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  // Nothing to choose between — say why rather than showing an empty control.
  if (!language || unavailableForLanguage || narrated.length === 0) {
    return (
      <View style={styles.stateBlock}>
        <Text style={[styles.stateText, { color: colors.textSecondary }]}>
          {language
            ? 'No narrated audio is available for this language yet.'
            : 'Narration is not offered for the language of your Bible version.'}
        </Text>
      </View>
    );
  }

  const summary = voiceAbbr
    ? (narrated.find((v) => v.abbr === voiceAbbr)?.name ?? voiceAbbr)
    : `Automatic${preferred ? ` · ${preferred.name}` : ''}`;

  const renderRow = (
    key: string,
    title: string,
    meta: string | null,
    selected: boolean,
    onPress: () => void
  ) => (
    <Pressable
      key={key}
      testID={`scripture-voice-option-${key}`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        { borderBottomColor: colors.divider },
        selected && { backgroundColor: `${colors.gold}1A` },
        pressed && { opacity: 0.6 },
      ]}
    >
      <View style={styles.optionText}>
        <Text style={[styles.optionTitle, { color: colors.textPrimary }]} numberOfLines={2}>
          {title}
        </Text>
        {meta ? (
          <Text style={[styles.optionMeta, { color: colors.textSecondary }]}>{meta}</Text>
        ) : null}
      </View>
      {selected ? <Ionicons name="checkmark" size={20} color={colors.gold} /> : null}
    </Pressable>
  );

  return (
    <View testID="scripture-voice-setting">
      <Pressable
        testID="scripture-voice-toggle"
        accessibilityRole="button"
        accessibilityLabel={`Narration voice, currently ${summary}`}
        accessibilityState={{ expanded }}
        style={[styles.selectButton, { backgroundColor: colors.backgroundElevated }]}
        onPress={() => setExpanded(!expanded)}
      >
        <View style={styles.selectText}>
          <Text style={[styles.selectLabel, { color: colors.textSecondary }]}>Narration voice</Text>
          <Text style={[styles.selectValue, { color: colors.textPrimary }]} numberOfLines={1}>
            {summary}
          </Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.textSecondary}
        />
      </Pressable>

      {expanded ? (
        <View
          style={[styles.picker, { backgroundColor: colors.backgroundElevated }]}
          testID="scripture-voice-picker"
        >
          {!isOnline && selectable.length === 0 ? (
            <Text style={[styles.stateText, { color: colors.textSecondary, padding: spacing.md }]}>
              You are offline and no narration has been downloaded yet.
            </Text>
          ) : (
            <ScrollView style={styles.pickerScroll} nestedScrollEnabled>
              {renderRow(
                'automatic',
                'Automatic',
                preferred ? `Currently ${preferred.name}` : 'Matches your translation',
                voiceAbbr === null,
                () => {
                  void setVoiceAbbr(null);
                  setExpanded(false);
                }
              )}
              {selectable.map((version) => {
                const bits = [
                  readingVersionKey && isSameTranslation(version.abbr, readingVersionKey)
                    ? 'your version'
                    : null,
                  version.has_verse_timing ? 'follows along' : null,
                  downloadedAbbrs?.has(version.abbr)
                    ? 'downloaded'
                    : version.offline_capable
                      ? 'can be downloaded'
                      : 'streaming only',
                ].filter(Boolean);
                return renderRow(
                  version.abbr,
                  version.name,
                  bits.join(' · '),
                  voiceAbbr === version.abbr,
                  () => {
                    void setVoiceAbbr(version.abbr);
                    setExpanded(false);
                  }
                );
              })}
            </ScrollView>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stateBlock: { paddingVertical: spacing.md, alignItems: 'center' },
  stateText: { fontSize: fontSizes.bodySmall, textAlign: 'center', lineHeight: 20 },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: 12,
  },
  selectText: { flex: 1, gap: 2 },
  selectLabel: { fontSize: fontSizes.caption },
  selectValue: { fontSize: fontSizes.body },
  picker: { marginTop: spacing.sm, borderRadius: 12, overflow: 'hidden' },
  pickerScroll: { maxHeight: 280 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionText: { flex: 1, gap: 2 },
  optionTitle: { fontSize: fontSizes.bodySmall, lineHeight: 20 },
  optionMeta: { fontSize: fontSizes.caption },
});
