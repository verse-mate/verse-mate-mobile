/**
 * HamburgerMenu Component
 *
 * Slide-in menu drawer from right side with menu items for app features.
 * Bookmarks, Notes, and Highlights navigation are fully wired and functional.
 *
 * Features:
 * - Slides in from right (300ms animation)
 * - White background, full height
 * - Menu items with icons: Bookmarks, Favorites, Notes, Highlights, Settings
 * - Close button (X) in header
 * - Tap backdrop or X to close
 * - Bookmarks item navigates to /bookmarks screen
 * - Notes item navigates to /notes screen
 * - Highlights item navigates to /highlights screen
 * - Haptic feedback on menu item press
 * - Temporary: Login/Signup buttons for auth testing
 *
 * @see Spec lines 52-55, 476-500 (Hamburger menu)
 * @see Task Group 7: Hamburger Menu & Route Configuration
 *
 * @example
 * <HamburgerMenu visible={isOpen} onClose={() => setIsOpen(false)} />
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInRight, SlideOutRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fontSizes, fontWeights, type getColors, spacing } from '@/constants/bible-design-tokens';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

interface HamburgerMenuProps {
  /** Whether menu is visible */
  visible: boolean;
  /** Callback when menu should be closed */
  onClose: () => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  action?: 'auth' | 'logout' | 'bookmarks' | 'notes' | 'highlights' | 'settings';
}

const authMenuItems: MenuItem[] = [
  { id: 'login', label: 'Login', icon: 'log-in-outline', action: 'auth' },
  { id: 'signup', label: 'Sign Up', icon: 'person-add-outline', action: 'auth' },
];

const regularMenuItems: MenuItem[] = [
  { id: 'bookmarks', label: 'Bookmarks', icon: 'bookmark-outline', action: 'bookmarks' },
  { id: 'favorites', label: 'Favorites', icon: 'heart-outline' },
  { id: 'notes', label: 'Notes', icon: 'document-text-outline', action: 'notes' },
  { id: 'highlights', label: 'Highlights', icon: 'color-wand-outline', action: 'highlights' },
  { id: 'settings', label: 'Settings', icon: 'settings-outline', action: 'settings' },
];

const logoutMenuItem: MenuItem = {
  id: 'logout',
  label: 'Logout',
  icon: 'log-out-outline',
  action: 'logout',
};

export function HamburgerMenu({ visible, onClose }: HamburgerMenuProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated, logout } = useAuth();

  /**
   * Handle menu item tap
   * Routes to auth screens, bookmarks screen, notes screen, highlights screen, or shows "Coming soon" alert
   */
  const handleItemPress = async (item: MenuItem) => {
    // Trigger haptic feedback first
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (item.action === 'auth') {
      onClose();
      if (item.id === 'login') {
        router.push('/auth/login');
      } else if (item.id === 'signup') {
        router.push('/auth/signup');
      }
    } else if (item.action === 'logout') {
      await logout();
      Alert.alert('Logged Out', 'You have been logged out successfully.');
      onClose();
    } else if (item.action === 'bookmarks') {
      // Navigate to bookmarks screen
      onClose();
      router.push('/bookmarks');
    } else if (item.action === 'notes') {
      // Navigate to notes screen
      onClose();
      router.push('/notes');
    } else if (item.action === 'highlights') {
      // Navigate to highlights screen
      onClose();
      router.push('/highlights');
    } else if (item.action === 'settings') {
      // Navigate to settings screen
      onClose();
      router.push('/settings');
    } else {
      // Other features show "Coming soon" alert
      Alert.alert('Coming Soon', `${item.label} feature is coming soon!`);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none" // Use Reanimated for custom animations
      onRequestClose={onClose}
      testID="hamburger-menu-modal"
    >
      {/* Backdrop with fade animation */}
      <Animated.View
        style={styles.backdrop}
        entering={FadeIn.duration(300)}
        exiting={FadeOut.duration(300)}
      >
        {/* Backdrop touchable area */}
        <Pressable style={styles.backdropTouchable} onPress={onClose} testID="menu-backdrop" />

        {/* Menu container with slide animation */}
        <Animated.View
          style={styles.menuContainer}
          entering={SlideInRight.duration(300)}
          exiting={SlideOutRight.duration(300)}
          testID="hamburger-menu"
        >
          {/* Header with close button */}
          <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
            <Text style={styles.headerTitle}>Menu</Text>
            <Pressable
              onPress={onClose}
              style={styles.closeButton}
              accessibilityLabel="Close menu"
              accessibilityRole="button"
              testID="menu-close-button"
            >
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </Pressable>
          </View>

          {/* User Info Section (if authenticated) */}
          {isAuthenticated && user && (
            <View style={styles.userSection}>
              <View style={styles.userInfo}>
                <Ionicons name="person-circle-outline" size={48} color={colors.textSecondary} />
                <View style={styles.userDetails}>
                  <Text style={styles.userName}>
                    {user.firstName} {user.lastName}
                  </Text>
                  <Text style={styles.userEmail}>{user.email}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Auth buttons (if not authenticated) */}
          {!isAuthenticated && (
            <View style={styles.authSection}>
              <Text style={styles.authSectionTitle}>Account</Text>
              {authMenuItems.map((item) => (
                <Pressable
                  key={item.id}
                  style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
                  onPress={() => handleItemPress(item)}
                  accessibilityLabel={item.label}
                  accessibilityRole="button"
                  testID={`menu-item-${item.id}`}
                >
                  <Ionicons name={item.icon} size={24} color={colors.textSecondary} />
                  <Text style={styles.menuItemText}>{item.label}</Text>
                </Pressable>
              ))}
              <View style={styles.divider} />
            </View>
          )}

          {/* Regular menu items */}
          <View style={styles.menuItems}>
            {regularMenuItems.map((item) => (
              <Pressable
                key={item.id}
                style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
                onPress={() => handleItemPress(item)}
                accessibilityLabel={item.label}
                accessibilityRole="button"
                testID={`menu-item-${item.id}`}
              >
                <Ionicons name={item.icon} size={24} color={colors.textSecondary} />
                <Text style={styles.menuItemText}>{item.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Logout button (if authenticated) */}
          {isAuthenticated && (
            <View style={styles.logoutSection}>
              <View style={styles.divider} />
              <Pressable
                style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
                onPress={() => handleItemPress(logoutMenuItem)}
                accessibilityLabel={logoutMenuItem.label}
                accessibilityRole="button"
                testID={`menu-item-${logoutMenuItem.id}`}
              >
                <Ionicons name={logoutMenuItem.icon} size={24} color={colors.error} />
                <Text style={[styles.menuItemText, { color: colors.error }]}>
                  {logoutMenuItem.label}
                </Text>
              </Pressable>
            </View>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const createStyles = (colors: ReturnType<typeof getColors>) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.backdrop,
      justifyContent: 'flex-end',
      flexDirection: 'row',
    },
    backdropTouchable: {
      flex: 1,
    },
    menuContainer: {
      width: '75%', // 75% of screen width
      height: '100%',
      backgroundColor: colors.backgroundElevated,
      shadowColor: colors.shadow,
      shadowOffset: { width: -2, height: 0 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 8, // Android shadow
    },
    header: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: fontSizes.heading3,
      fontWeight: fontWeights.semibold,
      color: colors.textPrimary,
    },
    closeButton: {
      padding: spacing.xs,
      justifyContent: 'center',
      alignItems: 'center',
    },
    userSection: {
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.xl,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    userInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    userDetails: {
      flex: 1,
    },
    userName: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.semibold,
      color: colors.textPrimary,
      marginBottom: spacing.xs / 2,
    },
    userEmail: {
      fontSize: fontSizes.caption,
      color: colors.textTertiary,
    },
    authSection: {
      paddingTop: spacing.lg,
    },
    authSectionTitle: {
      fontSize: fontSizes.caption,
      fontWeight: fontWeights.semibold,
      color: colors.textTertiary,
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.sm,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    divider: {
      height: 1,
      backgroundColor: colors.divider,
      marginVertical: spacing.lg,
    },
    menuItems: {
      paddingTop: spacing.lg,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.xl,
      gap: spacing.lg,
    },
    menuItemPressed: {
      backgroundColor: colors.background,
    },
    menuItemText: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.regular,
      color: colors.textPrimary,
    },
    logoutSection: {
      marginTop: spacing.lg,
    },
  });
