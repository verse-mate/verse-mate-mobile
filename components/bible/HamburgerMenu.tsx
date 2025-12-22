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
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
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
  const menuWidth = Math.min(windowWidth * 0.85, 340); // Slightly wider to match Figma feel
  const styles = useMemo(() => createStyles(colors, menuWidth), [colors, menuWidth]);
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated, logout } = useAuth();

  // Message Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [modalContent, setModalContent] = useState({ title: '', message: '' });

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
      showMessage(
        'About VerseMate',
        'VerseMate v1.0.0\n\nYour companion for Bible study and spiritual growth.'
      );
    } else if (item.action === 'giving') {
      onClose();
      showMessage('Giving', 'Support VerseMate with your contribution (Coming Soon).');
    } else if (item.action === 'help') {
      onClose();
      showMessage('Help', 'Help & Support documentation is coming soon!');
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
      Alert.alert('Coming Soon', `${item.label} feature is coming soon!`);
    }
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
                style={[styles.menuContainer, animatedStyle, { paddingTop: insets.top }]}
                entering={SlideInRight.duration(300)}
                exiting={SlideOutRight.duration(300)}
                testID="hamburger-menu"
              >
                {/* Header Mobile */}
                <View style={styles.header}>
                  <View style={styles.headerControls}>
                    <Text style={styles.headerTitle}>Menu</Text>
                    <Pressable
                      onPress={onClose}
                      style={styles.closeButton}
                      accessibilityLabel="Close menu"
                      accessibilityRole="button"
                      testID="menu-close-button"
                    >
                      {/* Using X icon logic from Figma (custom or Ionicons as fallback if not in set, here using simple SVG path or ionicon for now as strictly specified new icons dont have X) */}
                      {/* Actually, looking at imports, we don't have an IconClose. I'll stick to a simple text X or existing icon but styled to match Figma which is a simple cross inside a box often */}
                      <View style={styles.closeIconContainer}>
                        {/* Figma uses a simple vector X. I'll use a styled text or vector icon. */}
                        <Text style={{ fontSize: 24, lineHeight: 24, color: colors.textPrimary }}>
                          ×
                        </Text>
                      </View>
                    </Pressable>
                  </View>

                  {/* User Profile Section */}
                  <View style={styles.userSection}>
                    <View style={styles.avatarContainer}>
                      {/* Placeholder for user avatar - Figma uses a circle user icon */}
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
                  </View>
                </View>

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
                        Alert.alert('Logged Out', 'You have been logged out successfully.');
                        onClose();
                      } else {
                        onClose();
                        router.push('/auth/login');
                      }
                    }}
                  >
                    <View style={styles.menuIconContainer}>
                      {/* Using Profile icon for auth action as well, or similar */}
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
    </>
  );
}

const createStyles = (colors: ReturnType<typeof getColors>, menuWidth: number) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)', // Slightly darker backdrop
      justifyContent: 'flex-end',
      flexDirection: 'row',
    },
    backdropTouchable: {
      flex: 1,
    },
    menuContainer: {
      width: menuWidth,
      height: '100%',
      backgroundColor: colors.background, // Should be white or surface color
      shadowColor: '#000',
      shadowOffset: { width: -4, height: 0 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 5,
      paddingHorizontal: 16, // Figma uses padding
    },
    header: {
      marginBottom: 24,
      backgroundColor: colors.backgroundElevated, // Light grey background for header area in Figma
      borderRadius: 16,
      padding: 16,
      marginTop: 16,
    },
    headerControls: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 24,
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
    },
    avatarContainer: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.backgroundElevated,
      borderRadius: 20, // Circular
    },
    userInfo: {
      flex: 1,
    },
    userName: {
      fontSize: 15,
      fontWeight: '400',
      color: colors.textPrimary, // Should be that brownish gold if exact match, but textPrimary is safer
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
      paddingHorizontal: 8, // Less horizontal padding as container has padding
      borderRadius: 12,
    },
    menuItemPressed: {
      backgroundColor: colors.backgroundElevated, // Highlight state
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
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 16,
    },
  });
