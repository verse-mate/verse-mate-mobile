/**
 * MSW Handlers for Languages API
 *
 * Mock handlers for Bible languages endpoints
 */

import { HttpResponse, http } from 'msw';
import { resolveApiBaseUrl } from '@/lib/api/base-url';

const BASE_URLS = [resolveApiBaseUrl()];

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
