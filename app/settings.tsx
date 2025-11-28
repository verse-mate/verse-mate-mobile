/**
 * Settings Screen
 *
 * Mobile implementation of the Settings page from web repo.
 * Provides configuration options for Bible version, language preferences,
 * auto-highlights, and user profile management.
 *
 * Features:
 * - Profile Information editing (authenticated users only)
 * - Bible Version selection (available to all users)
 * - Language Preferences (authenticated users only)
 * - Theme Selector (available to all users)
 * - Logout (authenticated users only)
 */

import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { ThemeSelector } from '@/components/settings/ThemeSelector';
import { TextInput } from '@/components/ui/TextInput';
import { fontSizes, fontWeights, type getColors, spacing } from '@/constants/bible-design-tokens';
import type { BibleVersion } from '@/constants/bible-versions';
import { bibleVersions } from '@/constants/bible-versions';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useBibleVersion } from '@/hooks/use-bible-version';
import {
  getBibleLanguages,
  patchUserPreferences,
  putAuthProfile,
} from '@/src/api/generated/sdk.gen';

interface Language {
  code: string;
  name: string;
  nativeName: string;
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated, logout, restoreSession } = useAuth();
  const { colors } = useTheme();
  const { bibleVersion, setBibleVersion } = useBibleVersion();
  const queryClient = useQueryClient();

  // Bible version state
  const selectedVersionData = bibleVersions.find((version) => version.key === bibleVersion);
  const [showVersionPicker, setShowVersionPicker] = useState(false);

  // Language preferences state
  const [selectedLanguage, setSelectedLanguage] = useState(user?.preferred_language || 'automatic');
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [availableLanguages, setAvailableLanguages] = useState<Language[]>([]);

  // Profile form state
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [email, setEmail] = useState(user?.email || '');

  // UI state
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Track if we need to save on blur
  const hasPendingChangesRef = useRef(false);

  // Update form fields when user session changes
  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || '');
      setLastName(user.lastName || '');
      setEmail(user.email || '');
      setSelectedLanguage(user.preferred_language || 'automatic');
    }
  }, [user]);

  // Fetch available languages
  useEffect(() => {
    const fetchLanguages = async () => {
      try {
        const { data, error } = await getBibleLanguages();
        if (error) {
          throw error;
        }
        if (data) {
          const mappedLanguages = (
            data as {
              language_code: string;
              name: string;
              native_name: string;
            }[]
          ).map((lang) => ({
            code: lang.language_code,
            name: lang.name,
            nativeName: lang.native_name,
          }));
          // Sort alphabetically by native name
          const sortedLanguages = mappedLanguages.sort((a, b) =>
            a.nativeName.localeCompare(b.nativeName)
          );
          setAvailableLanguages(sortedLanguages);
        }
      } catch (error) {
        console.error('Failed to fetch available languages:', error);
      }
    };

    if (isAuthenticated) {
      fetchLanguages();
    }
  }, [isAuthenticated]);

  const hasProfileChanges = useCallback(() => {
    return (
      firstName !== (user?.firstName || '') ||
      lastName !== (user?.lastName || '') ||
      email !== (user?.email || '')
    );
  }, [firstName, lastName, email, user]);

  const saveProfile = useCallback(async () => {
    if (!hasProfileChanges()) return;

    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setGlobalError('All fields are required.');
      setSaveStatus('error');
      return;
    }

    setGlobalError(null);
    setSaveStatus('saving');

    try {
      const { error } = await putAuthProfile({
        body: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
        },
      });

      if (error) {
        throw error;
      }

      // Refresh user session to get updated profile data
      await restoreSession();

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error: unknown) {
      let errorMessage = 'An error occurred while saving your changes.';

      const err = error as {
        message?: string;
        data?: { value?: { message?: string } };
        value?: { message?: string } | string;
      };

      // Check for error in data.value.message structure (API error format)
      if (
        err?.data?.value &&
        typeof err.data.value === 'object' &&
        err.data.value.message === 'EMAIL_ALREADY_EXISTS'
      ) {
        errorMessage = 'This email address is already in use by another account.';
      }
      // Check for error in value.message structure (alternative format)
      else if (
        err?.value &&
        typeof err.value === 'object' &&
        err.value.message === 'EMAIL_ALREADY_EXISTS'
      ) {
        errorMessage = 'This email address is already in use by another account.';
      }
      // Check for direct message
      else if (err?.message === 'EMAIL_ALREADY_EXISTS') {
        errorMessage = 'This email address is already in use by another account.';
      }
      // Generic value string
      else if (err?.value && typeof err.value === 'string') {
        errorMessage = err.value;
      }
      // Direct string error
      else if (typeof error === 'string') {
        errorMessage = error;
      }

      setGlobalError(errorMessage);
      setSaveStatus('error');
    }
  }, [firstName, lastName, email, hasProfileChanges, restoreSession]);

  // Track pending changes
  useEffect(() => {
    hasPendingChangesRef.current = hasProfileChanges();
  }, [hasProfileChanges]);

  // Auto-save profile changes
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    // Only save if there are actual changes
    if (!hasProfileChanges()) return;

    const timer = setTimeout(() => {
      saveProfile();
    }, 1000);

    return () => clearTimeout(timer);
  }, [isAuthenticated, user, hasProfileChanges, saveProfile]);

  // Save pending changes when screen loses focus
  useFocusEffect(
    useCallback(() => {
      // Cleanup function runs when screen loses focus
      return () => {
        if (hasPendingChangesRef.current && isAuthenticated) {
          // Save synchronously on blur (don't await to avoid blocking navigation)
          saveProfile();
        }
      };
    }, [isAuthenticated, saveProfile])
  );

  const handleBibleVersionChange = async (version: BibleVersion) => {
    try {
      await setBibleVersion(version.key);
      setShowVersionPicker(false);
    } catch (_error) {
      Alert.alert('Error', 'Failed to save Bible version selection');
    }
  };

  const handleLanguageChange = async (languageCode: string) => {
    try {
      setSelectedLanguage(languageCode);
      setShowLanguagePicker(false);

      const languageToSave = languageCode === 'automatic' ? undefined : languageCode;
      const { error } = await patchUserPreferences({
        body: { preferred_language: languageToSave },
      });

      if (error) {
        throw error;
      }

      // Invalidate topic-related queries to refresh with new language
      queryClient.invalidateQueries({
        predicate: (q) => {
          const k = q.queryKey as unknown as (string | undefined)[];
          return (
            Array.isArray(k) &&
            (k[0] === 'topic-details' ||
              k[0] === 'topic-references' ||
              k[0] === 'topic-details-explanation' ||
              k[0] === 'topic-explanation' ||
              k[0] === 'topics')
          );
        },
      });
    } catch (error) {
      console.error('Failed to save language preference:', error);
      Alert.alert('Error', 'Failed to save language preference');
    }
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.back();
        },
      },
    ]);
  };

  const formatLanguageDisplay = (lang: Language) => {
    if (lang.name === lang.nativeName) {
      return lang.name;
    }
    return `${lang.nativeName} (${lang.name})`;
  };

  /**
   * Handle back button press
   */
  const handleBackPress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Save any pending changes before navigating away
    if (hasProfileChanges()) {
      await saveProfile();
    }

    router.back();
  };

  // Create theme-aware styles
  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      {/* Custom Header */}
      <View
        style={[styles.header, { paddingTop: insets.top + spacing.md, paddingBottom: spacing.md }]}
      >
        <Pressable
          onPress={handleBackPress}
          style={styles.backButton}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          testID="settings-back-button"
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
      >
        {/* Profile Information Section - Authenticated Only */}
        {isAuthenticated && user && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Profile Information</Text>
            <View style={styles.profileHeader}>
              <View style={styles.profileIconWrapper}>
                <Ionicons name="person-circle-outline" size={48} color={colors.gray700} />
              </View>
              <View style={styles.profileInfo}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.profileName}>Profile Details</Text>
                  {saveStatus === 'saving' && (
                    <ActivityIndicator
                      size="small"
                      color={colors.textSecondary}
                      style={{ marginLeft: 8 }}
                    />
                  )}
                  {saveStatus === 'saved' && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={colors.success}
                      style={{ marginLeft: 8 }}
                    />
                  )}
                  {saveStatus === 'error' && (
                    <Ionicons
                      name="alert-circle"
                      size={20}
                      color={colors.error}
                      style={{ marginLeft: 8 }}
                    />
                  )}
                </View>
                <Text style={styles.profileSubtext}>Update your personal information</Text>
              </View>
            </View>

            <View style={styles.form}>
              <TextInput
                label="First Name"
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Enter your first name"
                testID="settings-first-name-input"
              />

              <TextInput
                label="Last Name"
                value={lastName}
                onChangeText={setLastName}
                placeholder="Enter your last name"
                testID="settings-last-name-input"
              />

              <TextInput
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="Enter your email"
                keyboardType="email-address"
                autoCapitalize="none"
                testID="settings-email-input"
              />
            </View>

            {globalError && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{globalError}</Text>
              </View>
            )}
          </View>
        )}

        {/* Bible Version Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Bible Version</Text>
          <Pressable
            style={styles.selectButton}
            onPress={() => setShowVersionPicker(!showVersionPicker)}
          >
            <Text style={styles.selectButtonText}>
              {selectedVersionData?.value || 'Select Version'}
            </Text>
            <Ionicons
              name={showVersionPicker ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.textSecondary}
            />
          </Pressable>

          {showVersionPicker && (
            <View style={styles.pickerContainer}>
              {bibleVersions.map((version) => (
                <Pressable
                  key={version.key}
                  style={[
                    styles.pickerItem,
                    version.key === bibleVersion && styles.pickerItemSelected,
                  ]}
                  onPress={() => handleBibleVersionChange(version)}
                >
                  <Text
                    style={[
                      styles.pickerItemText,
                      version.key === bibleVersion && styles.pickerItemTextSelected,
                    ]}
                  >
                    {version.value}
                  </Text>
                  {version.key === bibleVersion && (
                    <Ionicons name="checkmark" size={20} color={colors.gold} />
                  )}
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Language Preferences Section - Authenticated Only */}
        {isAuthenticated && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Language Preferences</Text>
            <Pressable
              style={styles.selectButton}
              onPress={() => setShowLanguagePicker(!showLanguagePicker)}
            >
              <Text style={styles.selectButtonText}>
                {selectedLanguage === 'automatic'
                  ? 'Automatic (Based on Bible Version)'
                  : (() => {
                      const selectedLang = availableLanguages.find(
                        (lang) => lang.code === selectedLanguage
                      );
                      return selectedLang ? formatLanguageDisplay(selectedLang) : 'Select Language';
                    })()}
              </Text>
              <Ionicons
                name={showLanguagePicker ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={colors.textSecondary}
              />
            </Pressable>

            {showLanguagePicker && (
              <View style={styles.pickerContainer}>
                <ScrollView style={styles.pickerScrollView}>
                  <Pressable
                    style={[
                      styles.pickerItem,
                      selectedLanguage === 'automatic' && styles.pickerItemSelected,
                    ]}
                    onPress={() => handleLanguageChange('automatic')}
                  >
                    <Text
                      style={[
                        styles.pickerItemText,
                        selectedLanguage === 'automatic' && styles.pickerItemTextSelected,
                      ]}
                    >
                      Automatic (Based on Bible Version)
                    </Text>
                    {selectedLanguage === 'automatic' && (
                      <Ionicons name="checkmark" size={20} color={colors.gold} />
                    )}
                  </Pressable>
                  {availableLanguages.map((language) => (
                    <Pressable
                      key={language.code}
                      style={[
                        styles.pickerItem,
                        language.code === selectedLanguage && styles.pickerItemSelected,
                      ]}
                      onPress={() => handleLanguageChange(language.code)}
                    >
                      <Text
                        style={[
                          styles.pickerItemText,
                          language.code === selectedLanguage && styles.pickerItemTextSelected,
                        ]}
                      >
                        {formatLanguageDisplay(language)}
                      </Text>
                      {language.code === selectedLanguage && (
                        <Ionicons name="checkmark" size={20} color={colors.gold} />
                      )}
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        )}

        {/* Theme Selector Section */}
        <ThemeSelector />

        {/* Account Actions Section - Authenticated Only */}
        {isAuthenticated && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Account Actions</Text>
            <Button
              title="Logout"
              onPress={handleLogout}
              variant="outline"
              fullWidth
              testID="settings-logout-button"
            />
          </View>
        )}

        {/* Not Authenticated Message */}
        {!isAuthenticated && (
          <View style={styles.notAuthenticatedContainer}>
            <Ionicons name="person-outline" size={64} color={colors.textTertiary} />
            <Text style={styles.notAuthenticatedText}>
              Sign in to access language preferences, auto-highlights, and profile settings.
            </Text>
            <Button
              title="Sign In"
              onPress={() => router.push('/auth/login')}
              variant="primary"
              testID="settings-sign-in-button"
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof getColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    backButton: {
      padding: spacing.xs,
      marginRight: spacing.sm,
    },
    headerTitle: {
      flex: 1,
      fontSize: fontSizes.displayMedium,
      fontWeight: fontWeights.bold,
      color: colors.textPrimary,
    },
    headerSpacer: {
      width: 32, // Same width as back button for centering
    },
    scrollView: {
      flex: 1,
    },
    contentContainer: {
      padding: spacing.lg,
    },
    section: {
      marginBottom: spacing.xl,
    },
    sectionLabel: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.semibold,
      color: colors.textPrimary,
      marginBottom: spacing.md,
    },
    selectButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      backgroundColor: colors.backgroundElevated,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
    },
    selectButtonText: {
      flex: 1,
      fontSize: fontSizes.body,
      color: colors.textPrimary,
    },
    pickerContainer: {
      marginTop: spacing.sm,
      backgroundColor: colors.backgroundElevated,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      maxHeight: 300,
    },
    pickerScrollView: {
      maxHeight: 300,
    },
    pickerItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    pickerItemSelected: {
      backgroundColor: colors.backgroundOverlay,
    },
    pickerItemText: {
      flex: 1,
      fontSize: fontSizes.body,
      color: colors.textSecondary,
    },
    pickerItemTextSelected: {
      color: colors.gold,
      fontWeight: fontWeights.semibold,
    },
    profileHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.lg,
      paddingVertical: spacing.md,
    },
    profileIconWrapper: {
      marginRight: spacing.md,
    },
    profileInfo: {
      flex: 1,
    },
    profileName: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.semibold,
      color: colors.textPrimary,
      marginBottom: spacing.xs / 2,
    },
    profileSubtext: {
      fontSize: fontSizes.caption,
      color: colors.textSecondary,
    },
    form: {
      marginBottom: spacing.lg,
    },
    errorContainer: {
      marginBottom: spacing.md,
      padding: spacing.md,
      backgroundColor: `${colors.error}20`, // 20% opacity
      borderRadius: 8,
    },
    errorText: {
      fontSize: fontSizes.caption,
      color: colors.error,
    },
    changeIndicator: {
      fontSize: fontSizes.caption,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: spacing.sm,
    },
    notAuthenticatedContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.xxl,
      paddingHorizontal: spacing.xl,
    },
    notAuthenticatedText: {
      fontSize: fontSizes.body,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: spacing.lg,
      marginBottom: spacing.xl,
      lineHeight: 24,
    },
  });
