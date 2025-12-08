/**
 * TextSelectionMenu Component
 *
 * Floating action menu that appears above selected text.
 * Provides quick actions: Copy, Share, and a three-dots menu for more options.
 *
 * Features:
 * - Positioned above selection (or below if near top of screen)
 * - Horizontal button layout matching Android Chrome style
 * - Theme-aware styling (light/dark mode)
 * - Haptic feedback on button press
 * - Auto-dismisses when tapping outside
 *
 * @example
 * ```tsx
 * <TextSelectionMenu
 *   visible={showMenu}
 *   position={{ x: 100, y: 200 }}
 *   selectedText="love"
 *   onCopy={() => copyToClipboard("love")}
 *   onShare={() => shareText("love")}
 *   onMoreOptions={() => openHighlightSheet()}
 *   onClose={() => setShowMenu(false)}
 * />
 * ```
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fontSizes, fontWeights, type getColors, spacing } from '@/constants/bible-design-tokens';
import { useTheme } from '@/contexts/ThemeContext';

const MENU_HEIGHT = 44;
const MENU_PADDING = 8;
const ARROW_SIZE = 8;

export interface TextSelectionMenuProps {
  /** Whether the menu is visible */
  visible: boolean;
  /** Position of the menu (center X, top Y of selection) */
  position: { x: number; y: number };
  /** The selected text */
  selectedText: string;
  /** Whether the selection spans multiple words (hides Define button) */
  isMultiWord?: boolean;
  /** Callback when Define button is pressed */
  onDefine?: () => void;
  /** Callback when Copy button is pressed */
  onCopy?: () => void;
  /** Callback when Share button is pressed */
  onShare?: () => void;
  /** Callback when Select Verse button is pressed */
  onSelectVerse?: () => void;
  /** Callback when three-dots menu button is pressed (opens highlight sheet) */
  onMoreOptions?: () => void;
  /** Callback when menu is closed */
  onClose: () => void;
}

/**
 * TextSelectionMenu Component
 *
 * Floating action menu for text selection actions.
 */
export function TextSelectionMenu({
  visible,
  position,
  selectedText: _selectedText,
  isMultiWord = false,
  onDefine,
  onCopy,
  onShare,
  onSelectVerse,
  onMoreOptions,
  onClose,
}: TextSelectionMenuProps) {
  const { colors, mode } = useTheme();
  const styles = useMemo(() => createStyles(colors, mode), [colors, mode]);
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Menu dimensions state
  const [menuWidth, setMenuWidth] = useState(200);
  const [showAbove, setShowAbove] = useState(true);

  // Calculate menu position
  const screenWidth = Dimensions.get('window').width;
  const minX = MENU_PADDING + insets.left;
  const maxX = screenWidth - menuWidth - MENU_PADDING - insets.right;

  // Center menu on selection, constrain to screen bounds
  let menuX = position.x - menuWidth / 2;
  menuX = Math.max(minX, Math.min(maxX, menuX));

  // Determine if menu should be above or below selection
  const spaceAbove = position.y - insets.top;
  const menuTotalHeight = MENU_HEIGHT + ARROW_SIZE + MENU_PADDING;

  useEffect(() => {
    setShowAbove(spaceAbove >= menuTotalHeight);
  }, [spaceAbove, menuTotalHeight]);

  // Calculate Y position
  const menuY = showAbove
    ? position.y - MENU_HEIGHT - ARROW_SIZE - MENU_PADDING
    : position.y + MENU_PADDING + ARROW_SIZE;

  // Animate in/out
  useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, fadeAnim]);

  /**
   * Handle button press with haptic feedback
   */
  const handlePress = useCallback(
    async (action: () => void) => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      action();
      onClose();
    },
    [onClose]
  );

  /**
   * Handle backdrop press
   */
  const handleBackdropPress = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  }, [onClose]);

  /**
   * Measure menu width on layout
   */
  const handleMenuLayout = useCallback((event: { nativeEvent: { layout: { width: number } } }) => {
    setMenuWidth(event.nativeEvent.layout.width);
  }, []);

  if (!visible) return null;

  // Calculate arrow position (centered on selection X, constrained to menu bounds)
  const arrowX = Math.max(
    MENU_PADDING,
    Math.min(menuWidth - MENU_PADDING - ARROW_SIZE * 2, position.x - menuX - ARROW_SIZE)
  );

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      {/* Backdrop - tap to dismiss (rendered first, at bottom layer) */}
      <Pressable style={styles.backdrop} onPress={handleBackdropPress} testID="menu-backdrop" />

      {/* Menu container */}
      <Animated.View
        style={[
          styles.menuContainer,
          {
            left: menuX,
            top: menuY,
            opacity: fadeAnim,
            transform: [
              {
                scale: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.95, 1],
                }),
              },
            ],
          },
        ]}
        onLayout={handleMenuLayout}
      >
        {/* Arrow pointing to selection */}
        <View
          style={[styles.arrow, showAbove ? styles.arrowDown : styles.arrowUp, { left: arrowX }]}
        />

        {/* Menu buttons */}
        <View style={styles.menuContent}>
          {/* Only show Define for single word selections */}
          {onDefine && !isMultiWord && (
            <Pressable
              style={styles.menuButton}
              onPress={() => handlePress(onDefine)}
              testID="menu-define"
            >
              <Ionicons name="book-outline" size={18} color={colors.textPrimary} />
              <Text style={styles.menuButtonText}>Define</Text>
            </Pressable>
          )}

          {onCopy && (
            <Pressable
              style={styles.menuButton}
              onPress={() => handlePress(onCopy)}
              testID="menu-copy"
            >
              <Ionicons name="copy-outline" size={18} color={colors.textPrimary} />
              <Text style={styles.menuButtonText}>Copy</Text>
            </Pressable>
          )}

          {onShare && (
            <Pressable
              style={styles.menuButton}
              onPress={() => handlePress(onShare)}
              testID="menu-share"
            >
              <Ionicons name="share-outline" size={18} color={colors.textPrimary} />
              <Text style={styles.menuButtonText}>Share</Text>
            </Pressable>
          )}

          {onSelectVerse && (
            <Pressable
              style={styles.menuButton}
              onPress={async () => {
                // Don't close menu - just update selection to full verse
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onSelectVerse();
              }}
              testID="menu-select-verse"
            >
              <Ionicons name="scan-outline" size={18} color={colors.textPrimary} />
              <Text style={styles.menuButtonText}>Select Verse</Text>
            </Pressable>
          )}

          {onMoreOptions && (
            <Pressable
              style={styles.moreOptionsButton}
              onPress={() => handlePress(onMoreOptions)}
              testID="menu-more-options"
            >
              <Ionicons name="ellipsis-vertical" size={20} color={colors.textPrimary} />
            </Pressable>
          )}
        </View>
      </Animated.View>
    </Modal>
  );
}

const createStyles = (colors: ReturnType<typeof getColors>, mode: string) => {
  const isDark = mode === 'dark';

  return StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'transparent',
    },
    menuContainer: {
      position: 'absolute',
      backgroundColor: isDark ? colors.gray100 : colors.background,
      borderRadius: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.4 : 0.15,
      shadowRadius: 12,
      elevation: 8,
    },
    arrow: {
      position: 'absolute',
      width: 0,
      height: 0,
      borderLeftWidth: ARROW_SIZE,
      borderRightWidth: ARROW_SIZE,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
    },
    arrowUp: {
      top: -ARROW_SIZE,
      borderBottomWidth: ARROW_SIZE,
      borderBottomColor: isDark ? colors.gray100 : colors.background,
    },
    arrowDown: {
      bottom: -ARROW_SIZE,
      borderTopWidth: ARROW_SIZE,
      borderTopColor: isDark ? colors.gray100 : colors.background,
    },
    menuContent: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.xs,
      paddingVertical: spacing.xs,
      gap: 2,
    },
    menuButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: 8,
      gap: 4,
    },
    menuButtonText: {
      fontSize: fontSizes.bodySmall,
      fontWeight: fontWeights.medium,
      color: colors.textPrimary,
    },
    moreOptionsButton: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xs,
      paddingVertical: spacing.xs,
      borderRadius: 8,
    },
  });
};
