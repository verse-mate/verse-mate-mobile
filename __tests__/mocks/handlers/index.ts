/**
 * MSW Handlers Index
 *
 * Combines all MSW handlers for VerseMate API endpoints
 */

import { authHandlers } from './auth';
import { bibleHandlers } from './bible.handlers';
import { explanationHandlers } from './explanations';
import { verseHandlers } from './verses';

// Combine all handlers
export const handlers = [
  ...authHandlers,
  ...verseHandlers,
  ...explanationHandlers,
  ...bibleHandlers,
];

// Export individual handler groups for selective usage
export { authHandlers, verseHandlers, explanationHandlers, bibleHandlers };
