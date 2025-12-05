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
import { authSsoHandlers } from './auth-sso';
import { autoHighlightsHandlers } from './auto-highlights';
import { bibleHandlers } from './bible.handlers';
import { bookmarkHandlers } from './bookmarks.handlers';
import { explanationHandlers } from './explanations';
import { highlightHandlers } from './highlights.handlers';
import { languagesHandlers } from './languages';
import { notesHandlers } from './notes.handlers';
import { recentlyViewedBooksHandlers } from './recently-viewed-books.handlers';
import { userPreferencesHandlers } from './user-preferences';
import { verseHandlers } from './verses';

// Combine all handlers
// IMPORTANT: Bookmark, highlights, and notes handlers must come BEFORE bible handlers to prevent
// /bible/book/:bookId/:chapterNumber from matching /bible/book/bookmarks/:user_id, /bible/highlights/:user_id, or /bible/book/notes/:user_id
export const handlers = [
  ...authHandlers,
  ...authSsoHandlers,
  ...verseHandlers,
  ...explanationHandlers,
  ...bookmarkHandlers, // Must come before bibleHandlers
  ...highlightHandlers, // Must come before bibleHandlers
  ...autoHighlightsHandlers, // Must come before bibleHandlers
  ...notesHandlers, // Must come before bibleHandlers
  ...recentlyViewedBooksHandlers, // User-level handlers
  ...languagesHandlers, // Languages API handlers
  ...userPreferencesHandlers, // User preferences handlers
  ...bibleHandlers,
];

// Export individual handler groups for selective usage
export {
  authHandlers,
  authSsoHandlers,
  autoHighlightsHandlers,
  verseHandlers,
  explanationHandlers,
  bibleHandlers,
  bookmarkHandlers,
  highlightHandlers,
  languagesHandlers,
  notesHandlers,
  recentlyViewedBooksHandlers,
  userPreferencesHandlers,
};
