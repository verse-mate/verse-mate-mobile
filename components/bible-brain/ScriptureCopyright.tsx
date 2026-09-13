/**
 * Copyright notice for narrated scripture.
 *
 * Not optional decoration: the Bible Brain licence requires that "the
 * copyrights for the content must also be viewable to the user", so any screen
 * that plays or offers a version must render this.
 */
import { useQuery } from '@tanstack/react-query';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { fetchScriptureCopyright } from '@/lib/bible-brain/api';
import { fontSizes, spacing } from '@/theme/tokens';

export interface ScriptureCopyrightProps {
  /** Bible id, e.g. `ENGESV`. */
  bibleId: string;
}

export function ScriptureCopyright({ bibleId }: ScriptureCopyrightProps) {
  const { colors } = useTheme();
  const { data } = useQuery({
    queryKey: ['scripture-copyright', bibleId],
    queryFn: () => fetchScriptureCopyright(bibleId),
    // Copyright text is effectively immutable.
    staleTime: Number.POSITIVE_INFINITY,
    enabled: Boolean(bibleId),
  });

  // De-duplicate: the API repeats the same string across a version's filesets.
  const notices = [
    ...new Set((data ?? []).map((row) => row.copyright).filter((text): text is string => !!text)),
  ];
  if (notices.length === 0) return null;

  return (
    <View style={styles.container} testID={`scripture-copyright-${bibleId}`}>
      {notices.map((notice) => (
        <Text key={notice} style={[styles.notice, { color: colors.textSecondary }]}>
          {notice}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  notice: {
    fontSize: fontSizes.caption,
    lineHeight: 16,
  },
});
