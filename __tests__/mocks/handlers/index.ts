/**
 * MSW Handlers Index
 *
 * Combines all MSW handlers for VerseMate API endpoints
 */

import { verseHandlers } from './verses';
import { explanationHandlers } from './explanations';

// Combine all handlers
export const handlers = [...verseHandlers, ...explanationHandlers];

// Export individual handler groups for selective usage
export { verseHandlers, explanationHandlers };
