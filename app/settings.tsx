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
 * - Language Preferences (available to all users, synced to backend when authenticated)
 * - Theme Selector (available to all users)
 * - Logout (authenticated users only)
 */

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react'; // NOTE: useCallback is still used for useFocusEffect which requires it
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DeleteAccountFinalModal } from '@/components/account/DeleteAccountFinalModal';
import { DeleteAccountPasswordModal } from '@/components/account/DeleteAccountPasswordModal';
import { DeleteAccountWarningModal } from '@/components/account/DeleteAccountWarningModal';
import { Button } from '@/components/Button';
import { FontSizeSelector } from '@/components/settings/FontSizeSelector';
import { ThemeSelector } from '@/components/settings/ThemeSelector';
import { Avatar } from '@/components/ui/Avatar';
import { TextInput } from '@/components/ui/TextInput';
import type { BibleVersion } from '@/constants/bible-versions';
import { bibleVersionGroups, bibleVersions } from '@/constants/bible-versions';
import { useAuth } from '@/contexts/AuthContext';
import { useOfflineContext } from '@/contexts/OfflineContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useBibleVersion } from '@/hooks/use-bible-version';
import { notifyLanguageChanged } from '@/hooks/use-preferred-language';
import { useDeleteAccount } from '@/hooks/useDeleteAccount';
import {
  getBibleLanguages,
  patchUserPreferences,
  putAuthProfile,
} from '@/src/api/generated/sdk.gen';
import { type getColors, spacing } from '@/theme/tokens';

interface Language {
  code: string;
  name: string;
  nativeName: string;
}

// Fallback language code → display name mapping for offline use
const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  ro: 'Romanian',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  ru: 'Russian',
  uk: 'Ukrainian',
  nl: 'Dutch',
  pl: 'Polish',
  ko: 'Korean',
  ja: 'Japanese',
  zh: 'Chinese',
  ar: 'Arabic',
  hi: 'Hindi',
  sv: 'Swedish',
  no: 'Norwegian',
  da: 'Danish',
  fi: 'Finnish',
  hu: 'Hungarian',
  cs: 'Czech',
  el: 'Greek',
  he: 'Hebrew',
  tr: 'Turkish',
  th: 'Thai',
  vi: 'Vietnamese',
  id: 'Indonesian',
};

// Native (endonym) display name per base ISO code, region stripped — the
// language dropdown shows "Native (English)" (e.g. "Español (Spanish)") with
// the region carried only by the underlying code (es-MX), not the label.
const LANGUAGE_NATIVE_NAMES: Record<string, string> = {
  en: 'English',
  ro: 'Română',
  es: 'Español',
  pt: 'Português',
  ru: 'Русский',
  uk: 'Українська',
  fr: 'Français',
  de: 'Deutsch',
  it: 'Italiano',
  hi: 'हिन्दी',
};

// Drop region qualifiers from a free-form language name — a trailing
// "(Region)" or " de Region" — for languages not in the curated maps above.
const stripRegionQualifier = (s: string): string =>
  s
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+de\s+.+$/i, '')
    .trim();

export default function SettingsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated, logout, restoreSession } = useAuth();
  const { colors } = useTheme();
  const { bibleVersion, setBibleVersion } = useBibleVersion();
  const {
    commentaryInfo,
    topicsInfo,
    downloadedCommentaryLanguages,
    downloadedTopicLanguages,
    isOnline,
  } = useOfflineContext();
  const isDeviceOffline = !isOnline;
  const queryClient = useQueryClient();

  // Bible version state
  const selectedVersionData = bibleVersions.find((version) => version.key === bibleVersion);
  const [showVersionPicker, setShowVersionPicker] = useState(false);

  // Language preferences state
  const [selectedLanguage, setSelectedLanguage] = useState(user?.preferred_language || 'en-US');
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [availableLanguages, setAvailableLanguages] = useState<Language[]>([]);

  // Profile form state
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [email, setEmail] = useState(user?.email || '');

  // UI state
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [globalError, setGlobalError] = useState<string | null>(null);
  const errorClearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track if we need to save on blur
  const hasPendingChangesRef = useRef(false);

  // Delete account state
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showFinalModal, setShowFinalModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState<string | undefined>();
  const { deleteAccount, isDeleting, error: deleteError, clearError } = useDeleteAccount();

  // Update form fields when user session changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: isOffline intentionally included to re-run effect when connectivity changes
  useEffect(() => {
    const loadPersistedLanguage = async () => {
      // Always try AsyncStorage first (works for both offline and logged-out users)
      try {
        const storedLang = await AsyncStorage.getItem('@versemate:preferred_language');
        if (storedLang) {
          setSelectedLanguage(storedLang);
          // Still update profile fields if user is logged in
          if (user) {
            setFirstName(user.firstName || '');
            setLastName(user.lastName || '');
            setEmail(user.email || '');
          }
          return;
        }
      } catch (error) {
        if (__DEV__) console.warn('Failed to load persisted language:', error);
      }

      // Fall back to user's preferred language from session
      if (user) {
        setFirstName(user.firstName || '');
        setLastName(user.lastName || '');
        setEmail(user.email || '');
        setSelectedLanguage(user.preferred_language || 'en-US');
      }
    };

    loadPersistedLanguage();
  }, [user, isDeviceOffline]);

  // Build offline fallback languages from downloaded commentary/topic data
  const getOfflineLanguages = useCallback((): Language[] => {
    const langMap = new Map<string, Language>();

    // First try: use commentaryInfo/topicsInfo which have full names (requires manifest)
    if (commentaryInfo) {
      for (const info of commentaryInfo) {
        if (info.status === 'downloaded' || info.status === 'update_available') {
          langMap.set(info.key, { code: info.key, name: info.name, nativeName: info.name });
        }
      }
    }
    if (topicsInfo) {
      for (const info of topicsInfo) {
        if (
          (info.status === 'downloaded' || info.status === 'update_available') &&
          !langMap.has(info.key)
        ) {
          langMap.set(info.key, { code: info.key, name: info.name, nativeName: info.name });
        }
      }
    }

    // Second try: use downloaded language code arrays (always available from local DB)
    // These work even without a manifest/network
    if (downloadedCommentaryLanguages) {
      for (const code of downloadedCommentaryLanguages) {
        if (!langMap.has(code)) {
          const shortCode = code.split('-')[0].toLowerCase();
          const displayName =
            LANGUAGE_NAMES[code] || LANGUAGE_NAMES[shortCode] || code.toUpperCase();
          langMap.set(code, { code, name: displayName, nativeName: displayName });
        }
      }
    }
    if (downloadedTopicLanguages) {
      for (const code of downloadedTopicLanguages) {
        if (!langMap.has(code)) {
          const shortCode = code.split('-')[0].toLowerCase();
          const displayName =
            LANGUAGE_NAMES[code] || LANGUAGE_NAMES[shortCode] || code.toUpperCase();
          langMap.set(code, { code, name: displayName, nativeName: displayName });
        }
      }
    }

    return Array.from(langMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [commentaryInfo, topicsInfo, downloadedCommentaryLanguages, downloadedTopicLanguages]);

  // Fetch available languages, cache them, and restore from cache when offline
  // biome-ignore lint/correctness/useExhaustiveDependencies: isAuthenticated intentionally included to re-run effect on auth state change
  useEffect(() => {
    const LANGUAGES_CACHE_KEY = 'versemate:languages_cache';

    const parseLanguages = (
      raw: { language_code: string; name: string; native_name: string }[]
    ): Language[] =>
      raw
        .map((lang) => ({
          code: lang.language_code,
          name: lang.name,
          nativeName: lang.native_name,
        }))
        .sort((a, b) => a.nativeName.localeCompare(b.nativeName));

    const fetchLanguages = async () => {
      // 1. Try fetching from the API
      try {
        const { data, error } = await getBibleLanguages();
        if (error) throw error;
        if (data) {
          const languages = parseLanguages(
            data as { language_code: string; name: string; native_name: string }[]
          );
          setAvailableLanguages(languages);
          // Cache for offline use
          AsyncStorage.setItem(LANGUAGES_CACHE_KEY, JSON.stringify(data)).catch((e) => {
            if (__DEV__) console.warn('Failed to cache languages:', e);
          });
          return;
        }
      } catch (error) {
        if (__DEV__) console.error('Failed to fetch available languages:', error);
      }

      // 2. Try restoring from cache (filtered to downloaded languages when offline)
      try {
        const cached = await AsyncStorage.getItem(LANGUAGES_CACHE_KEY);
        if (cached) {
          const allLanguages = parseLanguages(JSON.parse(cached));
          if (allLanguages.length > 0) {
            if (isDeviceOffline) {
              // Filter to only downloaded languages, using cached names for display
              const downloadedCodes = new Set([
                ...downloadedCommentaryLanguages,
                ...downloadedTopicLanguages,
              ]);
              // Also build a set of short codes (e.g., 'en' from 'en-US')
              const downloadedShortCodes = new Set(
                [...downloadedCodes].map((c) => c.split('-')[0].toLowerCase())
              );
              const filtered = allLanguages.filter((lang) => {
                const shortCode = lang.code.split('-')[0].toLowerCase();
                return downloadedCodes.has(lang.code) || downloadedShortCodes.has(shortCode);
              });
              if (filtered.length > 0) {
                setAvailableLanguages(filtered);
                return;
              }
            } else {
              setAvailableLanguages(allLanguages);
              return;
            }
          }
        }
      } catch (cacheError) {
        if (__DEV__) console.warn('Failed to read languages cache:', cacheError);
      }

      // 3. Last resort: build from downloaded language codes
      const offlineLangs = getOfflineLanguages();
      if (offlineLangs.length > 0) {
        setAvailableLanguages(offlineLangs);
      }
    };

    fetchLanguages();
  }, [
    isAuthenticated,
    getOfflineLanguages,
    isDeviceOffline,
    downloadedCommentaryLanguages,
    downloadedTopicLanguages,
  ]);

  // Sync offline-stored language to backend when coming back online
  useEffect(() => {
    const syncOfflineLanguage = async () => {
      if (!isDeviceOffline && isAuthenticated) {
        try {
          const storedLang = await AsyncStorage.getItem('@versemate:preferred_language');
          // If there's a stored language and it's different from the user's current preference, sync it
          if (storedLang && storedLang !== user?.preferred_language) {
            const { error } = await patchUserPreferences({
              body: { preferred_language: storedLang },
            });

            if (!error) {
              // Clear the offline storage after successful sync
              await AsyncStorage.removeItem('@versemate:preferred_language');
              // No token refresh needed per D-005 — restoreSession() picks up new claims.
              await restoreSession();
            }
          }
        } catch (error) {
          if (__DEV__) console.warn('Failed to sync offline language preference:', error);
        }
      }
    };

    syncOfflineLanguage();
  }, [isDeviceOffline, isAuthenticated, user?.preferred_language, restoreSession]);

  const hasProfileChanges = () => {
    return (
      firstName !== (user?.firstName || '') ||
      lastName !== (user?.lastName || '') ||
      email !== (user?.email || '')
    );
  };

  const saveProfile = async () => {
    // Check for changes inline to avoid dependency on hasProfileChanges
    const hasChanges =
      firstName !== (user?.firstName || '') ||
      lastName !== (user?.lastName || '') ||
      email !== (user?.email || '');

    if (!hasChanges) return;

    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setGlobalError('All fields are required.');
      setSaveStatus('error');
      if (errorClearTimeoutRef.current) clearTimeout(errorClearTimeoutRef.current);
      errorClearTimeoutRef.current = setTimeout(() => {
        setSaveStatus('idle');
        setGlobalError(null);
      }, 5000);
      return;
    }

    setGlobalError(null);
    setSaveStatus('saving');
    if (errorClearTimeoutRef.current) clearTimeout(errorClearTimeoutRef.current);

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
      if (errorClearTimeoutRef.current) clearTimeout(errorClearTimeoutRef.current);
      errorClearTimeoutRef.current = setTimeout(() => {
        setSaveStatus('idle');
        setGlobalError(null);
      }, 5000);
    }
  };

  // Track pending changes
  // Note: hasProfileChanges is auto-memoized by React Compiler
  useEffect(() => {
    hasPendingChangesRef.current = hasProfileChanges();
    // biome-ignore lint/correctness/useExhaustiveDependencies: React Compiler handles memoization
  }, [hasProfileChanges]);

  // Store latest saveProfile in a ref to avoid re-running effect when it changes
  const saveProfileRef = useRef(saveProfile);
  useEffect(() => {
    saveProfileRef.current = saveProfile;
    // biome-ignore lint/correctness/useExhaustiveDependencies: React Compiler handles memoization
  }, [saveProfile]);

  // Auto-save profile changes
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    // Check if there are actual changes
    const hasChanges =
      firstName !== (user?.firstName || '') ||
      lastName !== (user?.lastName || '') ||
      email !== (user?.email || '');

    if (!hasChanges) return;

    const timer = setTimeout(() => {
      saveProfileRef.current();
    }, 1000);

    return () => clearTimeout(timer);
  }, [isAuthenticated, user, firstName, lastName, email]);

  // Save pending changes when screen loses focus
  // Note: saveProfile is auto-memoized by React Compiler
  useFocusEffect(
    useCallback(() => {
      // Cleanup function runs when screen loses focus
      return () => {
        if (hasPendingChangesRef.current && isAuthenticated) {
          // Save synchronously on blur (don't await to avoid blocking navigation)
          saveProfile();
        }
      };
      // biome-ignore lint/correctness/useExhaustiveDependencies: React Compiler handles memoization
    }, [isAuthenticated, saveProfile])
  );

  const handleBibleVersionChange = async (version: BibleVersion) => {
    try {
      await setBibleVersion(version.key);
      setShowVersionPicker(false);
    } catch (_error) {
      Alert.alert(t('common.error_title'), t('settings.errors.save_bible_version'));
    }
  };

  const handleLanguageChange = async (languageCode: string) => {
    try {
      setSelectedLanguage(languageCode);
      setShowLanguagePicker(false);

      // Invalidate queries to refresh content in new language
      queryClient.invalidateQueries({
        predicate: (q) => {
          const k = q.queryKey as unknown as (string | undefined)[];
          return (
            Array.isArray(k) &&
            (k[0] === 'topic-details' ||
              k[0] === 'topic-references' ||
              k[0] === 'topic-details-explanation' ||
              k[0] === 'topic-explanation' ||
              k[0] === 'topics' ||
              k[0] === 'bible-explanation' ||
              k[0] === 'getBibleBookExplanationByBookIdByChapterNumber')
          );
        },
      });

      // Always persist to AsyncStorage (for offline, logged-out, and as cache)
      await AsyncStorage.setItem('@versemate:preferred_language', languageCode);
      notifyLanguageChanged();

      // When authenticated and online, also sync to backend
      if (isAuthenticated && !isDeviceOffline) {
        const { error } = await patchUserPreferences({
          body: { preferred_language: languageCode },
        });

        if (error) {
          throw error;
        }

        // Per D-005, no token refresh — restoreSession() pulls fresh claims (e.g. language).
        // Small delay to ensure backend DB consistency before re-fetching.
        await new Promise((resolve) => setTimeout(resolve, 500));
        await restoreSession();
      }
    } catch (error) {
      console.error('Failed to save language preference:', error);
      Alert.alert(t('common.error_title'), t('settings.errors.save_language'));
    }
  };

  const handleLogout = async () => {
    Alert.alert(t('settings.logout_confirm_title'), t('settings.logout_confirm_message'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.logout'),
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.back();
        },
      },
    ]);
  };

  const handleDeleteAccountPress = () => {
    setShowWarningModal(true);
  };

  const handleWarningContinue = () => {
    setShowWarningModal(false);
    // Check if user has a password (email/password account vs SSO-only)
    // Use authoritative flag from backend, default to true for safety
    const requiresPassword = user?.hasPassword ?? true;

    if (requiresPassword) {
      // Email/password account - show password modal
      setShowPasswordModal(true);
    } else {
      // SSO-only account - skip password modal
      setShowFinalModal(true);
    }
  };

  const handlePasswordConfirm = async (password: string) => {
    // Store password and close password modal
    setDeletePassword(password);
    setShowPasswordModal(false);
    setShowFinalModal(true);
  };

  const handleFinalConfirm = async () => {
    // Call delete account with password (if available)
    const success = await deleteAccount(deletePassword);
    if (success) {
      setShowFinalModal(false);
      setDeletePassword(undefined);
    }
  };

  const handleCancelDelete = () => {
    setShowWarningModal(false);
    setShowPasswordModal(false);
    setShowFinalModal(false);
    setDeletePassword(undefined);
    clearError();
  };

  // "Native (English)" with the region stripped from both — e.g.
  // "Español (Spanish)", not "Español de México (Mexican Spanish)". Prefer the
  // curated maps (clean endonym/English per base ISO), falling back to a
  // region-stripped form of the DB names for any language not in them. The
  // region is preserved in `lang.code` (es-MX), just not shown.
  const formatLanguageDisplay = (lang: Language) => {
    const base = lang.code.toLowerCase().split('-')[0];
    const english = LANGUAGE_NAMES[base] ?? stripRegionQualifier(lang.name);
    const native = LANGUAGE_NATIVE_NAMES[base] ?? stripRegionQualifier(lang.nativeName);
    if (native === english) {
      return english;
    }
    return `${native} (${english})`;
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
          accessibilityLabel={t('settings.go_back')}
          accessibilityRole="button"
          testID="settings-back-button"
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('settings.title')}</Text>
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
            <Text style={styles.sectionLabel}>{t('settings.profile_information')}</Text>
            <View style={styles.profileHeader}>
              <View style={styles.profileIconWrapper}>
                <Avatar url={user.imageSrc} size={48} />
              </View>
              <View style={styles.profileInfo}>
                <View style={styles.profileNameRow}>
                  <Text style={styles.profileName}>{t('settings.profile_details')}</Text>
                  {saveStatus === 'saving' && (
                    <ActivityIndicator
                      size="small"
                      color={colors.textSecondary}
                      style={styles.profileStatusIcon}
                    />
                  )}
                  {saveStatus === 'saved' && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={colors.success}
                      style={styles.profileStatusIcon}
                    />
                  )}
                  {saveStatus === 'error' && (
                    <Ionicons
                      name="alert-circle"
                      size={20}
                      color={colors.error}
                      style={styles.profileStatusIcon}
                    />
                  )}
                </View>
                {saveStatus === 'error' && globalError ? (
                  <Text style={styles.profileErrorText}>{globalError}</Text>
                ) : (
                  <Text style={styles.profileSubtext}>{t('settings.profile_subtext')}</Text>
                )}
              </View>
            </View>

            <View style={styles.form}>
              <TextInput
                label={t('settings.first_name')}
                value={firstName}
                onChangeText={setFirstName}
                placeholder={t('settings.first_name_placeholder')}
                testID="settings-first-name-input"
              />

              <TextInput
                label={t('settings.last_name')}
                value={lastName}
                onChangeText={setLastName}
                placeholder={t('settings.last_name_placeholder')}
                testID="settings-last-name-input"
              />

              <TextInput
                label={t('settings.email')}
                value={email}
                onChangeText={setEmail}
                placeholder={t('settings.email_placeholder')}
                keyboardType="email-address"
                autoCapitalize="none"
                testID="settings-email-input"
              />
            </View>
          </View>
        )}

        {/* Bible Version Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('settings.bible_version')}</Text>
          <Pressable
            style={styles.selectButton}
            onPress={() => setShowVersionPicker(!showVersionPicker)}
          >
            <Text style={styles.selectButtonText}>
              {selectedVersionData?.value || t('settings.select_version')}
            </Text>
            <Ionicons
              name={showVersionPicker ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.textSecondary}
            />
          </Pressable>

          {showVersionPicker && (
            <View style={styles.pickerContainer}>
              {/* Versions are grouped by language with a small header per
                  group — mirrors web's settings picker so the two surfaces
                  stay aligned. English appears first (most users' default);
                  the rest follow alphabetically by English language name.
                  nestedScrollEnabled lets Android route the vertical drag
                  to this inner ScrollView instead of the outer settings
                  page so the picker is reachable past the 300px cap. */}
              <ScrollView style={styles.pickerScrollView} nestedScrollEnabled>
                {bibleVersionGroups().map((group) => (
                  <View key={group.code}>
                    <Text style={styles.pickerGroupHeader} testID={`version-group-${group.code}`}>
                      {group.label}
                    </Text>
                    {group.versions.map((version) => (
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
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Language Preferences Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('settings.language_preferences')}</Text>
          <Pressable
            style={styles.selectButton}
            onPress={() => setShowLanguagePicker(!showLanguagePicker)}
          >
            <Text style={styles.selectButtonText}>
              {(() => {
                const selectedLang = availableLanguages.find(
                  (lang) => lang.code === selectedLanguage
                );
                return selectedLang
                  ? formatLanguageDisplay(selectedLang)
                  : t('settings.select_language');
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
              <ScrollView style={styles.pickerScrollView} nestedScrollEnabled>
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

        {/* Font Size Section */}
        <FontSizeSelector />

        {/* Theme Selector Section */}
        <ThemeSelector />

        {/* Home Screen Widget — mobile only (GH-265) */}
        {Platform.OS !== 'web' && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Home Screen Widget</Text>
            <Pressable
              style={[styles.selectButton, styles.manageDownloadsButton]}
              onPress={() => router.push('/widget-info')}
              accessibilityLabel="Set up the verse of the day home screen widget"
              accessibilityRole="button"
            >
              <Ionicons
                name="calendar-outline"
                size={20}
                color={colors.textPrimary}
                style={styles.manageDownloadsIcon}
              />
              <View style={styles.manageDownloadsTextContainer}>
                <Text
                  style={[styles.selectButtonText, styles.manageDownloadsTitle]}
                  numberOfLines={1}
                >
                  Verse of the Day widget
                </Text>
                <Text style={styles.manageDownloadsSubtitle}>
                  Add the verse of the day to your home screen
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>
        )}

        {/* Downloads & Offline — hidden on web (online-only) */}
        {Platform.OS !== 'web' && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('settings.downloads_offline')}</Text>
            <Pressable
              style={[styles.selectButton, styles.manageDownloadsButton]}
              onPress={() => router.push('/manage-downloads')}
              accessibilityLabel={t('settings.manage_downloads_a11y')}
              accessibilityRole="button"
            >
              <Ionicons
                name="cloud-download-outline"
                size={20}
                color={colors.textPrimary}
                style={styles.manageDownloadsIcon}
              />
              <View style={styles.manageDownloadsTextContainer}>
                <Text
                  style={[styles.selectButtonText, styles.manageDownloadsTitle]}
                  numberOfLines={1}
                >
                  {t('settings.manage_downloads')}
                </Text>
                <Text style={styles.manageDownloadsSubtitle}>
                  {t('settings.manage_downloads_subtitle')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>
        )}

        {/* Logout Button - Authenticated Only */}
        {isAuthenticated && (
          <View style={styles.section}>
            <Button
              title={t('settings.logout')}
              onPress={handleLogout}
              variant="outlineGold"
              fullWidth
              testID="settings-logout-button"
            />
          </View>
        )}

        {/* Delete Account Section - Authenticated Only */}
        {isAuthenticated && (
          <View style={[styles.section, styles.dangerSection]}>
            <Pressable
              style={styles.deleteAccountButton}
              onPress={handleDeleteAccountPress}
              accessibilityLabel={t('settings.delete_account_a11y')}
              accessibilityRole="button"
              accessibilityHint={t('settings.delete_account_hint')}
            >
              <Ionicons name="trash-outline" size={20} color="#dc2626" />
              <Text style={styles.deleteAccountText}>{t('settings.delete_account')}</Text>
            </Pressable>
          </View>
        )}

        {/* Not Authenticated Message */}
        {!isAuthenticated && (
          <View style={styles.notAuthenticatedContainer}>
            <Ionicons name="person-outline" size={64} color={colors.textTertiary} />
            <Text style={styles.notAuthenticatedText}>{t('settings.sign_in_message')}</Text>
            <Button
              title={t('auth.login.title')}
              onPress={() => router.push('/auth/login')}
              variant="primary"
              testID="settings-sign-in-button"
            />
          </View>
        )}
      </ScrollView>

      {/* Delete Account Modals */}
      <DeleteAccountWarningModal
        visible={showWarningModal}
        onCancel={handleCancelDelete}
        onContinue={handleWarningContinue}
      />

      <DeleteAccountPasswordModal
        visible={showPasswordModal}
        onCancel={handleCancelDelete}
        onConfirm={handlePasswordConfirm}
        isLoading={isDeleting}
        error={deleteError || undefined}
      />

      <DeleteAccountFinalModal
        visible={showFinalModal}
        onCancel={handleCancelDelete}
        onConfirm={handleFinalConfirm}
        isLoading={isDeleting}
      />
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof getColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.backgroundSecondary,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      // No border/bg
    },
    backButton: {
      padding: spacing.xs,
      width: 40,
      alignItems: 'flex-start',
    },
    headerTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: '300', // Light weight
      color: colors.textPrimary,
      textAlign: 'center',
    },
    headerSpacer: {
      width: 40,
    },
    scrollView: {
      flex: 1,
    },
    contentContainer: {
      paddingVertical: spacing.lg,
      paddingHorizontal: 0, // Sections will have internal horizontal padding
    },
    section: {
      marginBottom: 24,
      paddingHorizontal: 16,
    },
    sectionLabel: {
      fontSize: 14,
      fontWeight: '400',
      color: colors.textSecondary,
      marginBottom: 12,
      marginLeft: 4,
    },
    selectButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: colors.backgroundElevated,
      borderWidth: 1,
      borderColor: colors.borderSecondary,
      borderRadius: 12,
      height: 48,
    },
    selectButtonText: {
      flex: 1,
      fontSize: 16,
      fontWeight: '400',
      color: colors.textPrimary,
    },
    pickerContainer: {
      marginTop: 8,
      backgroundColor: colors.backgroundElevated,
      borderWidth: 1,
      borderColor: colors.borderSecondary,
      borderRadius: 12,
      maxHeight: 300,
      overflow: 'hidden',
    },
    pickerScrollView: {
      maxHeight: 300,
    },
    pickerGroupHeader: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 4,
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: colors.textSecondary,
      backgroundColor: colors.background,
    },
    pickerItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSecondary,
    },
    pickerItemSelected: {
      backgroundColor: 'rgba(255,255,255,0.05)',
    },
    pickerItemText: {
      flex: 1,
      fontSize: 16,
      color: colors.textSecondary,
    },
    pickerItemTextSelected: {
      color: colors.gold,
      fontWeight: '500',
    },
    profileHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.backgroundElevated,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.borderSecondary,
      padding: 16,
      marginBottom: 16,
    },
    profileIconWrapper: {
      marginRight: 16,
    },
    profileInfo: {
      flex: 1,
    },
    profileName: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.textPrimary,
      marginBottom: 2,
    },
    profileSubtext: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    profileErrorText: {
      fontSize: 12,
      color: colors.error,
    },
    form: {
      marginBottom: 8,
    },
    errorContainer: {
      marginBottom: 16,
      padding: 12,
      backgroundColor: 'rgba(176, 58, 66, 0.1)',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(176, 58, 66, 0.2)',
    },
    errorText: {
      fontSize: 12,
      color: '#B03A42',
    },
    changeIndicator: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 8,
    },
    notAuthenticatedContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 48,
      paddingHorizontal: 24,
      marginHorizontal: 16,
      backgroundColor: colors.backgroundElevated,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.borderSecondary,
    },
    notAuthenticatedText: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 16,
      marginBottom: 24,
      lineHeight: 24,
    },
    dangerSection: {
      marginTop: 24,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 24,
    },
    deleteAccountButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: '#dc2626',
      borderRadius: 8,
      gap: 8,
    },
    deleteAccountText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#dc2626',
    },
    manageDownloadsButton: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 'auto',
      paddingVertical: 14,
    },
    manageDownloadsIcon: {
      marginRight: 12,
    },
    profileNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    profileStatusIcon: {
      marginLeft: 8,
    },
    manageDownloadsTextContainer: {
      flex: 1,
    },
    manageDownloadsTitle: {
      flex: undefined,
      fontWeight: '500',
    },
    manageDownloadsSubtitle: {
      fontSize: 12,
      marginTop: 2,
      color: colors.textSecondary,
    },
  });
