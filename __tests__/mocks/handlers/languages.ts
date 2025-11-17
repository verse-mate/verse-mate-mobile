/**
 * MSW Handlers for Languages API
 *
 * Mock handlers for Bible languages endpoints
 */

import { HttpResponse, http } from 'msw';

const BASE_URLS = ['http://localhost:4000', 'https://api.verse-mate.apegro.dev'];

export const languagesHandlers = BASE_URLS.flatMap((BASE_URL) => [
  // GET /bible/languages - Get available languages
  http.get(`${BASE_URL}/bible/languages`, () => {
    return HttpResponse.json([
      {
        language_code: 'en',
        name: 'English',
        native_name: 'English',
      },
      {
        language_code: 'es',
        name: 'Spanish',
        native_name: 'Español',
      },
      {
        language_code: 'fr',
        name: 'French',
        native_name: 'Français',
      },
      {
        language_code: 'de',
        name: 'German',
        native_name: 'Deutsch',
      },
      {
        language_code: 'pt',
        name: 'Portuguese',
        native_name: 'Português',
      },
    ]);
  }),
]);
