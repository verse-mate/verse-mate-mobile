/**
 * Jesus tab navigator.
 *
 * Headers are supplied per screen so each can title itself from data it has
 * already loaded (the category's own label, the event's title) rather than a
 * static string that would be wrong for four of the five routes.
 */
import { Stack } from 'expo-router';

export default function JesusLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
