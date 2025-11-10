/**
 * BottomLogo Component
 *
 * Displays the VerseMate logo at the bottom of content pages.
 * Used in both Bible chapter and topics pages for branding.
 * Positioned with equal spacing above and below within the bottom padding area.
 */

import { Image, StyleSheet, View } from 'react-native';

export function BottomLogo() {
  return (
    <View style={styles.container}>
      <Image
        source={require('@/assets/images/logo/regular-logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />
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
    width: 200, // Scaled down from 297px for mobile
    height: 54, // Maintains aspect ratio (297:80 ≈ 3.7:1)
    opacity: 0.6, // Subtle appearance
  },
});
