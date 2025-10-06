/**
 * MSW Handlers Index
 *
 * Combines all MSW handlers for VerseMate API endpoints
 */

import { verseHandlers } from './verses';
import { explanationHandlers } from './explanations';
import { bibleHandlers } from './bible.handlers';

// Combine all handlers
export const handlers = [...verseHandlers, ...explanationHandlers, ...bibleHandlers];

// Export individual handler groups for selective usage
export { verseHandlers, explanationHandlers, bibleHandlers };
