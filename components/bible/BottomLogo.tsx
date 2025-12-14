/**
 * BottomLogo Component
 *
 * Displays the VerseMate logo at the bottom of content pages.
 * Used in both Bible chapter and topics pages for branding.
 * Positioned with equal spacing above and below within the bottom padding area.
 *
 * Theme-aware: Uses dark text logo for light mode, white text logo for dark mode.
 */

import { Image, StyleSheet, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

// Pre-require both logos for fast switching
const regularLogo = require('@/assets/images/logo/regular-logo.png');
const whiteLogo = require('@/assets/images/logo/white-regular-logo.png');

export function BottomLogo() {
  const { mode } = useTheme();

  // Use white logo on dark backgrounds, regular (dark) logo on light backgrounds
  const logoSource = mode === 'dark' ? whiteLogo : regularLogo;

  return (
    <View style={styles.container}>
      <Image source={logoSource} style={styles.logo} resizeMode="contain" testID="bottom-logo" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    // Equal padding top and bottom to center the logo in the bottom area
    // Total height: ~72px (18px padding top + 54px logo + space to FABs)
    paddingTop: 0,
    paddingBottom: 0, // No bottom padding - uses the ScrollView's paddingBottom
  },
  logo: {
    width: 200 * 0.82, // ~18% smaller
    height: 54 * 0.82, // maintain aspect ratio
    opacity: 0.6, // Subtle appearance
  },
});
