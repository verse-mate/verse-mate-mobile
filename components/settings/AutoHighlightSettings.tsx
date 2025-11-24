/**
 * Auto-Highlight Settings Component
 *
 * Mobile implementation of auto-highlight theme preferences.
 * Allows users to toggle themes, adjust relevance thresholds, and bulk enable/disable.
 */

import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { colors, fontSizes, fontWeights, spacing } from '@/constants/bible-design-tokens';
import { getUserThemePreferences, updateUserThemePreference } from '@/lib/api/auto-highlights';

interface HighlightTheme {
  theme_id: number;
  theme_name: string;
  theme_color: string;
  theme_description: string | null;
  is_enabled: boolean;
  custom_color: string | null;
  relevance_threshold: number;
}

interface AutoHighlightSettingsProps {
  isLoggedIn: boolean;
}

const COLOR_MAP: Record<string, string> = {
  yellow: '#fef08a',
  blue: '#bfdbfe',
  green: '#bbf7d0',
  orange: '#fed7aa',
  pink: '#fbcfe8',
  purple: '#e9d5ff',
  red: '#fca5a5',
  teal: '#5eead4',
  brown: '#d7bfaa',
};

export function AutoHighlightSettings({ isLoggedIn }: AutoHighlightSettingsProps) {
  const queryClient = useQueryClient();
  const [themes, setThemes] = useState<HighlightTheme[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Fetch theme preferences
  useEffect(() => {
    const fetchPreferences = async () => {
      if (!isLoggedIn) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const result = await getUserThemePreferences();
        // API response is wrapped in { success: true, data: [...] }
        const themesData = result.data || result;
        setThemes(themesData as HighlightTheme[]);
      } catch (err) {
        console.error('Failed to fetch highlight preferences:', err);
        setError('Failed to load highlight preferences');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPreferences();
  }, [isLoggedIn]);

  const updatePreference = async (
    themeId: number,
    updates: { is_enabled?: boolean; relevance_threshold?: number }
  ) => {
    try {
      await updateUserThemePreference(themeId, updates);

      // Invalidate user preferences query
      queryClient.invalidateQueries({
        predicate: (q) => {
          const k = q.queryKey as unknown as (string | undefined)[];
          return Array.isArray(k) && k[0] === 'user-theme-preferences';
        },
      });

      // Invalidate auto-highlights queries to refresh
      queryClient.invalidateQueries({
        predicate: (q) => {
          const k = q.queryKey as unknown as (string | undefined)[];
          return Array.isArray(k) && k[0] === 'auto-highlights';
        },
      });

      setSuccessMessage('Preferences updated');
      setTimeout(() => setSuccessMessage(null), 2000);
    } catch (err) {
      console.error('Failed to update preference:', err);
      setError('Failed to update preference');
      setTimeout(() => setError(null), 3000);
      throw err;
    }
  };

  const handleToggleTheme = async (themeId: number, currentStatus: boolean) => {
    if (!isLoggedIn) return;

    const newStatus = !currentStatus;

    // Optimistic update
    setThemes((prev) =>
      prev.map((theme) =>
        theme.theme_id === themeId ? { ...theme, is_enabled: newStatus } : theme
      )
    );

    try {
      await updatePreference(themeId, { is_enabled: newStatus });
    } catch {
      // Revert on error
      setThemes((prev) =>
        prev.map((theme) =>
          theme.theme_id === themeId ? { ...theme, is_enabled: currentStatus } : theme
        )
      );
    }
  };

  const handleRelevanceChange = async (themeId: number, newRelevance: number) => {
    if (!isLoggedIn) return;

    // Update local state immediately
    setThemes((prev) =>
      prev.map((theme) =>
        theme.theme_id === themeId ? { ...theme, relevance_threshold: newRelevance } : theme
      )
    );

    try {
      await updatePreference(themeId, { relevance_threshold: newRelevance });
    } catch {
      // Error already handled in updatePreference
    }
  };

  const handleEnableAll = async () => {
    if (!isLoggedIn) return;

    // Optimistic update
    setThemes((prev) => prev.map((theme) => ({ ...theme, is_enabled: true })));

    try {
      await Promise.all(
        themes.map((theme) => updatePreference(theme.theme_id, { is_enabled: true }))
      );
    } catch {
      Alert.alert('Error', 'Failed to enable all themes');
    }
  };

  const handleDisableAll = async () => {
    if (!isLoggedIn) return;

    // Optimistic update
    setThemes((prev) => prev.map((theme) => ({ ...theme, is_enabled: false })));

    try {
      await Promise.all(
        themes.map((theme) => updatePreference(theme.theme_id, { is_enabled: false }))
      );
    } catch {
      Alert.alert('Error', 'Failed to disable all themes');
    }
  };

  if (isLoading) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Auto-Highlights</Text>
        <Text style={styles.loadingText}>Loading highlight preferences...</Text>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>Auto-Highlights</Text>
        <Pressable style={styles.toggleButton} onPress={() => setIsExpanded(!isExpanded)}>
          <Text style={styles.toggleButtonText}>{isExpanded ? 'Hide' : 'Show'}</Text>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={colors.gray700}
          />
        </Pressable>
      </View>

      {isExpanded && (
        <View style={styles.expandedContent}>
          {!isLoggedIn && (
            <View style={styles.loginPrompt}>
              <Text style={styles.loginPromptText}>
                Sign in to customize which AI-generated highlight themes are visible and set
                relevance preferences.
              </Text>
            </View>
          )}

          <View style={styles.description}>
            <Text style={styles.descriptionText}>
              AI-generated highlights help identify key verses, promises, commands, and more
              throughout the Bible.
            </Text>
            {isLoggedIn && (
              <Text style={styles.descriptionText}>
                Customize which themes are visible and set how relevant highlights should be (1 =
                most relevant, 5 = all).
              </Text>
            )}
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}
          {successMessage && <Text style={styles.successText}>{successMessage}</Text>}

          {isLoggedIn && themes.length > 0 && (
            <>
              <View style={styles.actionsRow}>
                <Button
                  title="Enable All"
                  onPress={handleEnableAll}
                  variant="outline"
                  testID="enable-all-themes"
                />
                <Button
                  title="Disable All"
                  onPress={handleDisableAll}
                  variant="outline"
                  testID="disable-all-themes"
                />
              </View>

              <ScrollView style={styles.themeList} nestedScrollEnabled>
                {themes.map((theme) => (
                  <View key={theme.theme_id} style={styles.themeItem}>
                    <View style={styles.themeHeader}>
                      <View style={styles.themeHeaderLeft}>
                        <View
                          style={[
                            styles.colorBadge,
                            { backgroundColor: COLOR_MAP[theme.theme_color] || colors.gray200 },
                          ]}
                        />
                        <Text style={styles.themeName}>{theme.theme_name}</Text>
                      </View>
                      <Switch
                        value={theme.is_enabled}
                        onValueChange={() => handleToggleTheme(theme.theme_id, theme.is_enabled)}
                        trackColor={{ false: colors.gray300, true: colors.gold }}
                        thumbColor={colors.white}
                        testID={`theme-switch-${theme.theme_id}`}
                      />
                    </View>

                    {theme.theme_description && (
                      <Text style={styles.themeDescription}>{theme.theme_description}</Text>
                    )}

                    <View style={styles.relevanceControl}>
                      <Text style={styles.relevanceLabel}>
                        Relevance: {theme.relevance_threshold}
                      </Text>
                      <Slider
                        style={styles.slider}
                        minimumValue={1}
                        maximumValue={5}
                        step={1}
                        value={theme.relevance_threshold}
                        onSlidingComplete={(value) =>
                          handleRelevanceChange(theme.theme_id, Math.round(value))
                        }
                        minimumTrackTintColor={colors.gold}
                        maximumTrackTintColor={colors.gray300}
                        thumbTintColor={colors.gold}
                        disabled={!theme.is_enabled}
                        testID={`theme-slider-${theme.theme_id}`}
                      />
                      <View style={styles.relevanceLabels}>
                        <Text style={styles.relevanceLabelText}>1</Text>
                        <Text style={styles.relevanceLabelText}>2</Text>
                        <Text style={styles.relevanceLabelText}>3</Text>
                        <Text style={styles.relevanceLabelText}>4</Text>
                        <Text style={styles.relevanceLabelText}>5</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </ScrollView>

              <View style={styles.legend}>
                <Text style={styles.legendTitle}>Visual Guide:</Text>
                <View style={styles.legendItems}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendSwatch, styles.userHighlightSwatch]} />
                    <Text style={styles.legendText}>Your highlights (solid background)</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendSwatch, styles.autoHighlightSwatch]} />
                    <Text style={styles.legendText}>
                      Auto-highlights (lighter background + underline)
                    </Text>
                  </View>
                </View>
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionLabel: {
    fontSize: fontSizes.body,
    fontWeight: fontWeights.semibold,
    color: colors.gray900,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: 6,
  },
  toggleButtonText: {
    fontSize: fontSizes.bodySmall,
    color: colors.gray700,
    fontWeight: fontWeights.medium,
  },
  expandedContent: {
    marginTop: spacing.md,
  },
  loadingText: {
    fontSize: fontSizes.body,
    color: colors.gray500,
    padding: spacing.lg,
    textAlign: 'center',
  },
  loginPrompt: {
    padding: spacing.lg,
    backgroundColor: colors.gray50,
    borderRadius: 8,
    marginBottom: spacing.md,
  },
  loginPromptText: {
    fontSize: fontSizes.bodySmall,
    color: colors.gray700,
    lineHeight: 20,
  },
  description: {
    padding: spacing.lg,
    backgroundColor: colors.gray50,
    borderRadius: 8,
    marginBottom: spacing.md,
  },
  descriptionText: {
    fontSize: fontSizes.bodySmall,
    color: colors.gray700,
    lineHeight: 20,
    marginBottom: spacing.xs,
  },
  errorText: {
    fontSize: fontSizes.bodySmall,
    color: colors.error,
    padding: spacing.md,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    marginBottom: spacing.md,
  },
  successText: {
    fontSize: fontSizes.bodySmall,
    color: colors.success,
    padding: spacing.md,
    backgroundColor: '#D1FAE5',
    borderRadius: 8,
    marginBottom: spacing.md,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  themeList: {
    maxHeight: 400,
  },
  themeItem: {
    padding: spacing.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: 8,
    marginBottom: spacing.md,
  },
  themeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  themeHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  colorBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.gray300,
  },
  themeName: {
    fontSize: fontSizes.body,
    fontWeight: fontWeights.medium,
    color: colors.gray900,
    flex: 1,
  },
  themeDescription: {
    fontSize: fontSizes.bodySmall,
    color: colors.gray500,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  relevanceControl: {
    marginTop: spacing.sm,
  },
  relevanceLabel: {
    fontSize: fontSizes.bodySmall,
    color: colors.gray700,
    fontWeight: fontWeights.medium,
    marginBottom: spacing.xs,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  relevanceLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
  },
  relevanceLabelText: {
    fontSize: fontSizes.caption,
    color: colors.gray500,
  },
  legend: {
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.gray50,
    borderRadius: 8,
  },
  legendTitle: {
    fontSize: fontSizes.bodySmall,
    fontWeight: fontWeights.semibold,
    color: colors.gray900,
    marginBottom: spacing.sm,
  },
  legendItems: {
    gap: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  legendSwatch: {
    width: 32,
    height: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.gray300,
  },
  userHighlightSwatch: {
    backgroundColor: '#fef08a',
  },
  autoHighlightSwatch: {
    backgroundColor: '#fef08a40',
    borderBottomWidth: 2,
    borderBottomColor: '#fef08a',
  },
  legendText: {
    fontSize: fontSizes.caption,
    color: colors.gray700,
    flex: 1,
  },
});
