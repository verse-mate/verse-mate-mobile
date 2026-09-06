/**
 * Push notifications on web: deliberately nothing.
 *
 * The native hook (`use-push-notifications.ts`) calls
 * `Notifications.useLastNotificationResponse()`, which expo-notifications does
 * not implement on web. It does not return a null there, it throws
 * `ERR_UNAVAILABLE`, and because the hook is mounted high in the root layout
 * that throw unmounted the entire tree: mobile.versemate.org served a blank
 * white page from 2026-07-20 until this file existed.
 *
 * A `Platform.OS === 'web'` branch inside the native hook cannot fix it,
 * because the fix has to skip a hook call and this project builds with the
 * React Compiler and lints hook rules as errors. The platform extension is the
 * mechanism the codebase already uses for exactly this, so Metro hands the web
 * bundle this file and never resolves expo-notifications' web shim at all.
 *
 * Nothing here is a stub waiting to be filled in. Web has no push token, no
 * notification tray and no cold-start notification tap, so there is no
 * behaviour to implement: the three things the native hook does (set the
 * foreground presentation handler, register a device token on login, route a
 * notification tap) have no web counterpart.
 *
 * @see hooks/use-push-notifications.ts for the real implementation
 */

export function usePushNotifications(): void {
  // Intentionally empty. See the module comment.
}
