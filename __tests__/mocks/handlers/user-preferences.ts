/**
 * MSW Handlers for User Preferences API
 *
 * Mock handlers for user preferences endpoints
 */

import { HttpResponse, http } from 'msw';
import { resolveApiBaseUrl } from '@/lib/api/base-url';

const BASE_URLS = [resolveApiBaseUrl()];

export const userPreferencesHandlers = BASE_URLS.flatMap((BASE_URL) => [
  // PATCH /user/preferences - Update user preferences
  http.patch(`${BASE_URL}/user/preferences`, async ({ request }) => {
    const body = await request.json();

    return HttpResponse.json({
      success: true,
      preferences: body,
    });
  }),
]);
