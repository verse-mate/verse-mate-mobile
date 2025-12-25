/**
 * HamburgerMenu Component
 *
 * Slide-in menu drawer from right side with menu items for app features.
 * Bookmarks, Notes, and Highlights navigation are fully wired and functional.
 *
 * Features:
 * - Slides in from right (300ms animation)
 * - White background, full height
 * - Menu items with icons: Bookmarks, Notes, Highlights, Settings
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

import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, Share, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeOut,
  runOnJS,
  SlideInRight,
  SlideOutRight,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SvgProps } from 'react-native-svg';
import {
  IconBookmarkFilled,
  IconDocument,
  IconHeart,
  IconHelp,
  IconHighlight,
  IconInfo,
  IconProfile,
  IconSettings,
  IconShare,
} from '@/components/ui/icons';
import type { getColors } from '@/constants/bible-design-tokens';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { MessageModal } from './MessageModal';
import { SuccessModal } from './SuccessModal';

interface HamburgerMenuProps {
  /** Whether menu is visible */
  visible: boolean;
  /** Callback when menu should be closed */
  onClose: () => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.FC<SvgProps>;
  action?:
    | 'auth'
    | 'logout'
    | 'bookmarks'
    | 'notes'
    | 'highlights'
    | 'settings'
    | 'share'
    | 'about'
    | 'giving'
    | 'help';
}

const regularMenuItems: MenuItem[] = [
  { id: 'bookmarks', label: 'Bookmarks', icon: IconBookmarkFilled, action: 'bookmarks' },
  { id: 'notes', label: 'Notes', icon: IconDocument, action: 'notes' },
  { id: 'highlights', label: 'Highlights', icon: IconHighlight, action: 'highlights' },
  { id: 'settings', label: 'Settings', icon: IconSettings, action: 'settings' },
  { id: 'share', label: 'Share VerseMate', icon: IconShare, action: 'share' },
  { id: 'about', label: 'About', icon: IconInfo, action: 'about' },
  { id: 'giving', label: 'Giving', icon: IconHeart, action: 'giving' },
  { id: 'help', label: 'Help', icon: IconHelp, action: 'help' },
];

export function HamburgerMenu({ visible, onClose }: HamburgerMenuProps) {
  const { colors } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const menuWidth = Math.min(windowWidth * 0.85, 340);
  const insets = useSafeAreaInsets();
  const styles = useMemo(
    () => createStyles(colors, menuWidth, insets),
    [colors, menuWidth, insets]
  );
  const { user, isAuthenticated, logout } = useAuth();

  // Message Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [modalContent, setModalContent] = useState({ title: '', message: '' });

  // Success Modal State
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [successModalContent, setSuccessModalContent] = useState({ title: '', message: '' });

  // Shared value for swipe translation
  const translateX = useSharedValue(0);

  // Reset translation when menu closes (prepares for next open)
  useEffect(() => {
    if (!visible) {
      translateX.value = 0;
    }
  }, [visible, translateX]);

  // Animated style for menu container
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const showMessage = (title: string, message: string) => {
    setModalContent({ title, message });
    setModalVisible(true);
  };

  const showSuccess = (title: string, message: string) => {
    setSuccessModalContent({ title, message });
    setSuccessModalVisible(true);
  };

  /**
   * Handle menu item tap
   */
  const handleItemPress = async (item: MenuItem) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (item.action === 'bookmarks') {
      onClose();
      router.push('/bookmarks');
    } else if (item.action === 'notes') {
      onClose();
      router.push('/notes');
    } else if (item.action === 'highlights') {
      onClose();
      // biome-ignore lint/suspicious/noExplicitAny: Typed routes might be stale
      router.push('/highlights' as any);
    } else if (item.action === 'settings') {
      onClose();
      router.push('/settings' as never);
    } else if (item.action === 'about') {
      onClose();
      router.push('/about');
    } else if (item.action === 'giving') {
      onClose();
      router.push('/giving');
    } else if (item.action === 'help') {
      onClose();
      router.push('/help');
    } else if (item.action === 'share') {
      try {
        const result = await Share.share({
          message: 'Check out VerseMate! Read the Bible with ease.',
          title: 'Share VerseMate',
          // url: 'https://versemate.app', // TODO: Add actual URL when deployed
        });

        if (result.action === Share.sharedAction) {
          // Shared successfully
        } else if (result.action === Share.dismissedAction) {
          // Dismissed
        }
      } catch (_error) {
        showMessage('Share Error', 'Could not open share dialog.');
      }
    } else {
      showMessage('Coming Soon', `${item.label} feature is coming soon!`);
    }
  };

  const handleProfilePress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
    router.push('/settings' as never);
  };

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onUpdate((event) => {
          translateX.value = Math.max(0, event.translationX);
        })
        .onEnd((event) => {
          const SWIPE_THRESHOLD_DISTANCE = menuWidth * 0.3;
          const SWIPE_THRESHOLD_VELOCITY = 300;

          if (
            event.translationX > SWIPE_THRESHOLD_DISTANCE ||
            event.velocityX > SWIPE_THRESHOLD_VELOCITY
          ) {
            translateX.value = withTiming(menuWidth, { duration: 200 }, () => {
              runOnJS(onClose)();
            });
          } else {
            translateX.value = withSpring(0);
          }
        }),
    [menuWidth, onClose, translateX]
  );

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="none"
        onRequestClose={onClose}
        testID="hamburger-menu-modal"
      >
        <StatusBar style="light" />
        <GestureHandlerRootView style={{ flex: 1 }}>
          <GestureDetector gesture={panGesture}>
            <Animated.View
              style={styles.backdrop}
              entering={FadeIn.duration(300)}
              exiting={FadeOut.duration(300)}
            >
              <Pressable
                style={styles.backdropTouchable}
                onPress={onClose}
                testID="menu-backdrop"
              />

              <Animated.View
                style={[styles.menuContainer, animatedStyle]}
                entering={SlideInRight.duration(300)}
                exiting={SlideOutRight.duration(300)}
                testID="hamburger-menu"
              >
                {/* Header Controls (Menu + Close) */}
                <View style={styles.headerControls}>
                  <Text style={styles.headerTitle}>Menu</Text>
                  <Pressable
                    onPress={onClose}
                    style={styles.closeButton}
                    accessibilityLabel="Close menu"
                    accessibilityRole="button"
                    testID="menu-close-button"
                  >
                    <View style={styles.closeIconContainer}>
                      <Text style={{ fontSize: 24, lineHeight: 24, color: colors.textPrimary }}>
                        ×
                      </Text>
                    </View>
                  </Pressable>
                </View>

                {/* User Profile Section (Button) */}
                <Pressable
                  onPress={handleProfilePress}
                  style={({ pressed }) => [styles.userSection, pressed && styles.menuItemPressed]}
                >
                  <View style={styles.avatarContainer}>
                    <IconProfile width={24} height={24} color={colors.textPrimary} />
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>
                      {isAuthenticated && user
                        ? `${user.firstName} ${user.lastName}`
                        : 'Guest User'}
                    </Text>
                    <Text style={styles.userEmail}>
                      {isAuthenticated && user ? user.email : 'Sign in to sync your data'}
                    </Text>
                  </View>
                </Pressable>

                {/* Menu Items */}
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
                      <View style={styles.menuIconContainer}>
                        <item.icon width={24} height={24} color={colors.textPrimary} />
                      </View>
                      <Text style={styles.menuItemText}>{item.label}</Text>
                    </Pressable>
                  ))}
                </View>

                {/* Authentication Action (Login/Logout) */}
                <View style={styles.footer}>
                  <Pressable
                    style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
                    onPress={async () => {
                      if (isAuthenticated) {
                        await logout();
                        showSuccess('Logged Out', 'You have been logged out successfully.');
                        onClose();
                      } else {
                        onClose();
                        router.push('/auth/login');
                      }
                    }}
                  >
                    <View style={styles.menuIconContainer}>
                      <IconProfile
                        width={24}
                        height={24}
                        color={isAuthenticated ? colors.error : colors.gold}
                      />
                    </View>
                    <Text
                      style={[
                        styles.menuItemText,
                        { color: isAuthenticated ? colors.error : colors.gold },
                      ]}
                    >
                      {isAuthenticated ? 'Log Out' : 'Log In'}
                    </Text>
                  </Pressable>
                </View>
              </Animated.View>
            </Animated.View>
          </GestureDetector>
        </GestureHandlerRootView>
      </Modal>

      <MessageModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title={modalContent.title}
        message={modalContent.message}
      />

      <SuccessModal
        visible={successModalVisible}
        onClose={() => setSuccessModalVisible(false)}
        title={successModalContent.title}
        message={successModalContent.message}
      />
    </>
  );
}

const createStyles = (
  colors: ReturnType<typeof getColors>,
  menuWidth: number,
  insets: ReturnType<typeof useSafeAreaInsets>
) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)', // Slightly darker backdrop
      justifyContent: 'flex-end',
      flexDirection: 'row',
      paddingTop: insets.top,
    },
    backdropTouchable: {
      flex: 1,
    },
    menuContainer: {
      width: menuWidth,
      height: '100%',
      backgroundColor: colors.backgroundSecondary, // Using specialized menu background
      shadowColor: '#000',
      shadowOffset: { width: -4, height: 0 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 5,
      paddingHorizontal: 16, // Figma uses padding
      borderTopLeftRadius: 24,
    },
    headerControls: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
      marginTop: 16,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '300', // Light font weight per Figma
      color: colors.textPrimary,
      fontFamily: 'Roboto', // If available, otherwise system font
    },
    closeButton: {
      width: 24,
      height: 24,
      justifyContent: 'center',
      alignItems: 'center',
    },
    closeIconContainer: {
      width: 24,
      height: 24,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.backgroundElevated,
      borderRadius: 4,
    },
    userSection: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      backgroundColor: colors.backgroundElevated,
      borderRadius: 16,
      padding: 16,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: colors.borderSecondary,
    },
    avatarContainer: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background, // Inner background slightly distinct or same
      borderRadius: 20, // Circular
    },
    userInfo: {
      flex: 1,
    },
    userName: {
      fontSize: 15,
      fontWeight: '400',
      color: colors.gold, // Using the brownish gold from Figma
      marginBottom: 2,
    },
    userEmail: {
      fontSize: 13,
      color: colors.textSecondary,
    },

    menuItems: {
      gap: 8,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      backgroundColor: colors.backgroundElevated,
      borderWidth: 1,
      borderColor: colors.borderSecondary,
    },
    menuItemPressed: {
      opacity: 0.7, // Visual feedback
    },
    menuIconContainer: {
      width: 24,
      height: 24,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
    },
    menuItemText: {
      fontSize: 14,
      fontWeight: '300', // Light weight
      color: colors.textPrimary,
    },
    footer: {
      marginTop: 'auto', // Push to bottom
      marginBottom: 32,
      paddingTop: 16,
    },
  });
