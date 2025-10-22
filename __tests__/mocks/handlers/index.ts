/**
 * MSW Handlers Index
 *
 * Combines all MSW handlers for VerseMate API endpoints
 */

import { bibleHandlers } from './bible.handlers';
import { explanationHandlers } from './explanations';
import { verseHandlers } from './verses';

// Combine all handlers
export const handlers = [...verseHandlers, ...explanationHandlers, ...bibleHandlers];

// Export individual handler groups for selective usage
export { verseHandlers, explanationHandlers, bibleHandlers };
