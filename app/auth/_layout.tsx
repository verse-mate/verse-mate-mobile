/**
 * Auth Modal Stack Layout
 *
 * Modal stack for authentication screens (signup and login).
 * Presented as a modal, not part of main tab navigation.
 *
 * @see Task Group 6.2: Create auth modal stack layout
 */

import { Stack } from 'expo-router';

/**
 * Auth Layout Component
 *
 * Configures modal stack navigation between signup and login screens.
 * Modal presentation style allows dismissing to return to previous screen.
 */
export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        presentation: 'modal',
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen
        name="signup"
        options={{
          title: 'Create Account',
        }}
      />
      <Stack.Screen
        name="login"
        options={{
          title: 'Login',
        }}
      />
    </Stack>
  );
}
