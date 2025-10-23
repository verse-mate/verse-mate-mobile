/**
 * HamburgerMenu Component
 *
 * Slide-in menu drawer from right side with placeholder menu items.
 * All menu items show "Coming soon" alert when tapped.
 *
 * Features:
 * - Slides in from right (300ms animation)
 * - White background, full height
 * - Five menu items with icons: Bookmarks, Favorites, Notes, Highlights, Settings
 * - Close button (X) in header
 * - Tap backdrop or X to close
 * - Each item shows "This feature is coming soon!" alert
 *
 * @see Spec lines 52-55, 476-500 (Hamburger menu)
 * @see Task Group 8.5
 *
 * @example
 * <HamburgerMenu visible={isOpen} onClose={() => setIsOpen(false)} />
 */

import { Ionicons } from '@expo/vector-icons';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInRight, SlideOutRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontSizes, fontWeights, spacing } from '@/constants/bible-design-tokens';

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
}

const menuItems: MenuItem[] = [
  { id: 'bookmarks', label: 'Bookmarks', icon: 'bookmark-outline' },
  { id: 'favorites', label: 'Favorites', icon: 'heart-outline' },
  { id: 'notes', label: 'Notes', icon: 'document-text-outline' },
  { id: 'highlights', label: 'Highlights', icon: 'color-wand-outline' },
  { id: 'settings', label: 'Settings', icon: 'settings-outline' },
];

export function HamburgerMenu({ visible, onClose }: HamburgerMenuProps) {
  const insets = useSafeAreaInsets();

  /**
   * Handle menu item tap
   * Shows "Coming soon" alert for all items
   */
  const handleItemPress = (label: string) => {
    Alert.alert('Coming Soon', `${label} feature is coming soon!`);
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
              <Ionicons name="close" size={24} color={colors.black} />
            </Pressable>
          </View>

          {/* Menu items */}
          <View style={styles.menuItems}>
            {menuItems.map((item) => (
              <Pressable
                key={item.id}
                style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
                onPress={() => handleItemPress(item.label)}
                accessibilityLabel={item.label}
                accessibilityRole="button"
                testID={`menu-item-${item.id}`}
              >
                <Ionicons name={item.icon} size={24} color={colors.gray700} />
                <Text style={styles.menuItemText}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: colors.white,
    shadowColor: colors.black,
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
    borderBottomColor: colors.gray200,
  },
  headerTitle: {
    fontSize: fontSizes.heading3,
    fontWeight: fontWeights.semibold,
    color: colors.black,
  },
  closeButton: {
    padding: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
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
    backgroundColor: colors.gray50,
  },
  menuItemText: {
    fontSize: fontSizes.body,
    fontWeight: fontWeights.regular,
    color: colors.gray900,
  },
});
