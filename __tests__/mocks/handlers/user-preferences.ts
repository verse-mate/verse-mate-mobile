/**
 * MSW Handlers for User Preferences API
 *
 * Mock handlers for user preferences endpoints
 */

import { HttpResponse, http } from 'msw';

const BASE_URLS = ['http://localhost:4000', 'https://api.verse-mate.apegro.dev'];

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
