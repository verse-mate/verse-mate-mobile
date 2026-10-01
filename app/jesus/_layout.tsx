/**
 * Jesus tab navigator.
 *
 * Headers are supplied per screen so each can title itself from data it has
 * already loaded (the category's own label, the event's title) rather than a
 * static string that would be wrong for four of the five routes.
 */
import { Stack } from 'expo-router';

/**
 * The hub is ALWAYS the bottom of this stack, however the section is entered.
 *
 * Without it, opening an event straight from the reader's dropdown (its Jesus
 * tab, or a search there) produced a one-screen stack, so "back" left the
 * feature altogether. The operator's rule: "if you searched for that specific
 * entry … back should take you directly to the Jesus feature". With the hub
 * underneath, there is always a Jesus page to return to — see useJesusBack.
 */
export const unstable_settings = {
  initialRouteName: 'index',
};

export default function JesusLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
