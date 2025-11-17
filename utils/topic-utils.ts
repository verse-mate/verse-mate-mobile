/**
 * Topic Category Utilities
 *
 * Helper functions for mapping between frontend and backend topic category names.
 * Frontend uses plural forms (EVENTS, PROPHECIES, PARABLES, THEMES) for display,
 * while backend uses singular forms (EVENT, PROPHECY, PARABLE, THEME).
 */

import type { TopicCategory, TopicCategoryDisplay } from '@/types/topics';

/**
 * Map frontend category names to backend category names
 *
 * @param frontendCategory - Frontend category name (plural form for UI)
 * @returns Backend category name (singular form)
 *
 * @example
 * mapCategoryToBackend('EVENTS') // => 'EVENT'
 * mapCategoryToBackend('THEMES') // => 'THEME'
 */
export function mapCategoryToBackend(frontendCategory: TopicCategoryDisplay): TopicCategory {
  switch (frontendCategory) {
    case 'EVENTS':
      return 'EVENT';
    case 'PROPHECIES':
      return 'PROPHECY';
    case 'PARABLES':
      return 'PARABLE';
    case 'THEMES':
      return 'THEME';
    default:
      // Fallback: try to cast as-is (shouldn't happen with proper typing)
      return frontendCategory as TopicCategory;
  }
}

/**
 * Map backend category names to frontend category names
 *
 * @param backendCategory - Backend category name (singular form)
 * @returns Frontend category name (plural form for UI)
 *
 * @example
 * mapCategoryToFrontend('EVENT') // => 'EVENTS'
 * mapCategoryToFrontend('THEME') // => 'THEMES'
 */
export function mapCategoryToFrontend(backendCategory: TopicCategory): TopicCategoryDisplay {
  switch (backendCategory) {
    case 'EVENT':
      return 'EVENTS';
    case 'PROPHECY':
      return 'PROPHECIES';
    case 'PARABLE':
      return 'PARABLES';
    case 'THEME':
      return 'THEMES';
    default:
      // Fallback: try to cast as-is (shouldn't happen with proper typing)
      return backendCategory as TopicCategoryDisplay;
  }
}

/**
 * Convert frontend category to display label
 *
 * @param category - Frontend category name
 * @returns Capitalized display label
 *
 * @example
 * toDisplayLabel('EVENTS') // => 'Events'
 * toDisplayLabel('THEMES') // => 'Themes'
 */
export function toDisplayLabel(category: TopicCategoryDisplay): string {
  // Convert to title case (capitalize first letter, lowercase rest)
  return category.charAt(0) + category.slice(1).toLowerCase();
}
