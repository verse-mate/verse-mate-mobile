/**
 * MSW Handlers Index
 *
 * Combines all MSW handlers for VerseMate API endpoints
 *
 * IMPORTANT: Handler order matters! More specific routes must come before
 * generic parameterized routes to avoid path collisions.
 * For example, /bible/book/bookmarks/:user_id must come before /bible/book/:bookId/:chapterNumber
 */

import { authHandlers } from './auth';
import { bibleHandlers } from './bible.handlers';
import { bookmarkHandlers } from './bookmarks.handlers';
import { explanationHandlers } from './explanations';
import { verseHandlers } from './verses';

// Combine all handlers
// IMPORTANT: Bookmark handlers must come BEFORE bible handlers to prevent
// /bible/book/:bookId/:chapterNumber from matching /bible/book/bookmarks/:user_id
export const handlers = [
  ...authHandlers,
  ...verseHandlers,
  ...explanationHandlers,
  ...bookmarkHandlers, // Must come before bibleHandlers
  ...bibleHandlers,
];

// Export individual handler groups for selective usage
export { authHandlers, verseHandlers, explanationHandlers, bibleHandlers, bookmarkHandlers };
