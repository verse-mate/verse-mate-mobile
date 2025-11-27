/**
 * Auto-Highlight Settings Component
 *
 * Mobile implementation of auto-highlight theme preferences.
 * Allows users to toggle themes on/off and bulk enable/disable.
 * Relevance thresholds are managed by admins only.
 */

import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { fontSizes, fontWeights, type getColors, spacing } from '@/constants/bible-design-tokens';
import { useTheme } from '@/contexts/ThemeContext';
import { getUserThemePreferences, updateUserThemePreference } from '@/lib/api/auto-highlights';

interface HighlightTheme {
  theme_id: number;
  theme_name: string;
  theme_color: string;
  theme_description: string | null;
  is_enabled: boolean;
  custom_color: string | null;
  relevance_threshold: number;
  default_relevance_threshold: number;
  admin_override: boolean;
}

interface AutoHighlightSettingsProps {
  isLoggedIn: boolean;
  /** If true, settings are always expanded and cannot be collapsed */
  alwaysExpanded?: boolean;
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

export function AutoHighlightSettings({
  isLoggedIn,
  alwaysExpanded = false,
}: AutoHighlightSettingsProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const [themes, setThemes] = useState<HighlightTheme[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(alwaysExpanded);

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

  const handleToggleAll = async (enable: boolean) => {
    if (!isLoggedIn) return;

    // Optimistic update
    setThemes((prev) => prev.map((theme) => ({ ...theme, is_enabled: enable })));

    try {
      await Promise.all(
        themes.map((theme) => updatePreference(theme.theme_id, { is_enabled: enable }))
      );
    } catch {
      Alert.alert('Error', `Failed to ${enable ? 'enable' : 'disable'} all themes`);
      // Revert on error
      setThemes((prev) => prev.map((theme) => ({ ...theme, is_enabled: !enable })));
    }
  };

  // Check if all themes are enabled
  const allEnabled = themes.length > 0 && themes.every((theme) => theme.is_enabled);

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
      {!alwaysExpanded && (
        <View style={styles.headerRow}>
          <Text style={styles.sectionLabel}>Auto-Highlights</Text>
          <Pressable style={styles.toggleButton} onPress={() => setIsExpanded(!isExpanded)}>
            <Text style={styles.toggleButtonText}>{isExpanded ? 'Hide' : 'Show'}</Text>
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.textSecondary}
            />
          </Pressable>
        </View>
      )}

      {(isExpanded || alwaysExpanded) && (
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
                Toggle themes on or off to customize which highlights you see.
              </Text>
            )}
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}

          {isLoggedIn && themes.length > 0 && (
            <>
              {/* Master toggle for all auto-highlights */}
              <View style={styles.masterToggleContainer}>
                <View style={styles.masterToggleContent}>
                  <View>
                    <Text style={styles.masterToggleLabel}>Enable All Auto-Highlights</Text>
                    <Text style={styles.masterToggleSubtext}>
                      Turn all AI-generated highlights on or off
                    </Text>
                  </View>
                  <Switch
                    value={allEnabled}
                    onValueChange={handleToggleAll}
                    trackColor={{ false: colors.border, true: colors.gold }}
                    thumbColor={colors.background}
                    testID="toggle-all-auto-highlights"
                  />
                </View>
              </View>

              <View>
                {themes.map((theme) => (
                  <View key={theme.theme_id} style={styles.themeItem}>
                    <View style={styles.themeHeader}>
                      <View style={styles.themeHeaderLeft}>
                        <View
                          style={[
                            styles.colorBadge,
                            { backgroundColor: COLOR_MAP[theme.theme_color] || colors.border },
                          ]}
                        />
                        <Text style={styles.themeName}>{theme.theme_name}</Text>
                      </View>
                      <Switch
                        value={theme.is_enabled}
                        onValueChange={() => handleToggleTheme(theme.theme_id, theme.is_enabled)}
                        trackColor={{ false: colors.border, true: colors.gold }}
                        thumbColor={colors.background}
                        testID={`theme-switch-${theme.theme_id}`}
                      />
                    </View>

                    {theme.theme_description && (
                      <Text style={styles.themeDescription}>{theme.theme_description}</Text>
                    )}
                  </View>
                ))}
              </View>

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

const createStyles = (colors: ReturnType<typeof getColors>) =>
  StyleSheet.create({
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
      color: colors.textPrimary,
    },
    toggleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 6,
    },
    toggleButtonText: {
      fontSize: fontSizes.bodySmall,
      color: colors.textSecondary,
      fontWeight: fontWeights.medium,
    },
    expandedContent: {
      marginTop: spacing.md,
    },
    loadingText: {
      fontSize: fontSizes.body,
      color: colors.textTertiary,
      padding: spacing.lg,
      textAlign: 'center',
    },
    loginPrompt: {
      padding: spacing.lg,
      backgroundColor: colors.backgroundElevated,
      borderRadius: 8,
      marginBottom: spacing.md,
    },
    loginPromptText: {
      fontSize: fontSizes.bodySmall,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    description: {
      padding: spacing.lg,
      backgroundColor: colors.backgroundElevated,
      borderRadius: 8,
      marginBottom: spacing.md,
    },
    descriptionText: {
      fontSize: fontSizes.bodySmall,
      color: colors.textSecondary,
      lineHeight: 20,
      marginBottom: spacing.xs,
    },
    errorText: {
      fontSize: fontSizes.bodySmall,
      color: colors.error,
      padding: spacing.md,
      backgroundColor: colors.backgroundElevated,
      borderRadius: 8,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.error,
    },
    masterToggleContainer: {
      marginBottom: spacing.lg,
      padding: spacing.lg,
      backgroundColor: colors.backgroundElevated,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: `${colors.gold}40`, // 40 = 25% opacity
    },
    masterToggleContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    masterToggleLabel: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.semibold,
      color: colors.textPrimary,
      marginBottom: spacing.xs / 2,
    },
    masterToggleSubtext: {
      fontSize: fontSizes.bodySmall,
      color: colors.textTertiary,
      lineHeight: 18,
    },
    themeItem: {
      padding: spacing.md,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
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
      borderColor: colors.border,
    },
    themeName: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.medium,
      color: colors.textPrimary,
      flex: 1,
    },
    themeDescription: {
      fontSize: fontSizes.bodySmall,
      color: colors.textTertiary,
      lineHeight: 18,
    },
    legend: {
      marginTop: spacing.lg,
      padding: spacing.md,
      backgroundColor: colors.backgroundElevated,
      borderRadius: 8,
    },
    legendTitle: {
      fontSize: fontSizes.bodySmall,
      fontWeight: fontWeights.semibold,
      color: colors.textPrimary,
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
      borderColor: colors.border,
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
      color: colors.textSecondary,
      flex: 1,
    },
  });
