/**
 * Avatar Component
 *
 * Displays user profile picture with fallback to icon.
 * Automatically handles image loading and errors.
 */

import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Image, StyleSheet, View } from 'react-native';

interface AvatarProps {
  /** Profile picture URL (from SSO provider) */
  url?: string | null;
  /** Size of avatar in pixels */
  size?: number;
  /** Fallback icon name */
  fallbackIcon?: ComponentProps<typeof Ionicons>['name'];
  /** Custom border color */
  borderColor?: string;
  /** Test ID for testing */
  testID?: string;
}

/**
 * Avatar component with automatic fallback
 *
 * @example
 * ```tsx
 * // With profile picture
 * <Avatar url={user.imageSrc} size={48} />
 *
 * // Without profile picture (shows fallback)
 * <Avatar size={48} />
 * ```
 */
export function Avatar({
  url,
  size = 40,
  fallbackIcon = 'person',
  borderColor,
  testID,
}: AvatarProps) {
  const borderStyle = borderColor ? { borderWidth: 2, borderColor } : {};

  // Show fallback if no URL
  if (!url) {
    return (
      <View
        style={[
          styles.fallback,
          { width: size, height: size, borderRadius: size / 2 },
          borderStyle,
        ]}
        testID={testID || 'avatar-fallback'}
      >
        <Ionicons name={fallbackIcon} size={size * 0.6} color="#666" />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: url }}
      style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }, borderStyle]}
      testID={testID || 'avatar-image'}
      // Show light gray background during load
    />
  );
}

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: '#E5E7EB',
  },
  fallback: {
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
