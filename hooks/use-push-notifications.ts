/**
 * Push notifications wiring (GH-281). Mount once, high in the tree.
 *
 * - Sets the foreground presentation handler.
 * - Registers the device token on login (no prompt — only when opted-in +
 *   permission already granted; the prompt lives in Settings).
 * - Routes notification taps to the reader, covering the cold-start case via
 *   `useLastNotificationResponse()` (fires for the launch tap too).
 */
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { analytics } from '@/lib/analytics';
import { AnalyticsEvent } from '@/lib/analytics/types';
import {
  NOTIFICATION_FALLBACK_ROUTE,
  resolveNotificationRoute,
} from '@/lib/notifications/notification-routing';
import { maybeRegisterOnLogin } from '@/lib/notifications/push-registration';

// Foreground presentation (SDK 52+ keys). Show the daily verse even when the
// app is open; badges are not used.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function usePushNotifications(): void {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const lastResponse = Notifications.useLastNotificationResponse();
  const handledIdRef = useRef<string | null>(null);
  const registeredForUserRef = useRef<string | null>(null);

  // Register once per login (see maybeRegisterOnLogin for the opt-in gate).
  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (userId) {
      if (registeredForUserRef.current !== userId) {
        registeredForUserRef.current = userId;
        void maybeRegisterOnLogin();
      }
    } else {
      registeredForUserRef.current = null;
    }
  }, [userId]);

  // Route a notification tap (also fires for the app-was-killed launch tap).
  useEffect(() => {
    if (!lastResponse) return;
    if (lastResponse.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
      return;
    }
    const id = lastResponse.notification.request.identifier;
    if (handledIdRef.current === id) return;
    handledIdRef.current = id;

    const data = lastResponse.notification.request.content.data as {
      deepLink?: unknown;
      type?: unknown;
    };
    const deepLink = typeof data?.deepLink === 'string' ? data.deepLink : null;
    const resolved = deepLink ? resolveNotificationRoute(deepLink) : null;

    if (resolved) {
      analytics.track(AnalyticsEvent.NOTIFICATION_TAPPED, {
        bookId: resolved.bookId,
        chapterNumber: resolved.chapterNumber,
        verseStart: resolved.verseStart,
        verseEnd: resolved.verseEnd,
        type: typeof data?.type === 'string' ? data.type : 'unknown',
      });
      router.replace(resolved.route);
    } else {
      router.replace(NOTIFICATION_FALLBACK_ROUTE);
    }

    Notifications.clearLastNotificationResponse();
  }, [lastResponse]);
}
