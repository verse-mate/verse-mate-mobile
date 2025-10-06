import type { Page } from '@playwright/test';

/**
 * Selector Finder Utility
 *
 * AI-assisted CSS selector identification from element descriptions.
 */

/**
 * Find CSS selector based on element description
 *
 * This function attempts to find the best CSS selector for an element
 * based on a natural language description.
 */
export async function findSelector(page: Page, description: string): Promise<string | null> {
  // Common patterns for different element types
  const patterns = [
    // Buttons
    {
      keywords: ['button', 'btn', 'click'],
      selectors: ['button', '[role="button"]', '.btn', '[type="button"]'],
    },
    // Links
    {
      keywords: ['link', 'anchor'],
      selectors: ['a', '[role="link"]'],
    },
    // Inputs
    {
      keywords: ['input', 'field', 'textbox'],
      selectors: ['input', '[role="textbox"]', 'textarea'],
    },
    // Tabs
    {
      keywords: ['tab'],
      selectors: ['[role="tab"]', '.tab', '[data-tab]'],
    },
    // Navigation
    {
      keywords: ['nav', 'navigation', 'menu'],
      selectors: ['nav', '[role="navigation"]', '.nav', '.menu'],
    },
  ];

  const lowerDesc = description.toLowerCase();

  // Try to find matching pattern
  for (const pattern of patterns) {
    if (pattern.keywords.some((keyword) => lowerDesc.includes(keyword))) {
      for (const selector of pattern.selectors) {
        const elements = await page.locator(selector).all();
        if (elements.length > 0) {
          // If there's text in the description, try to match it
          const textMatch = await findByText(page, selector, description);
          if (textMatch) return textMatch;

          // Otherwise return the first matching selector
          return selector;
        }
      }
    }
  }

  // Try to find by text content
  const byText = await findByTextContent(page, description);
  if (byText) return byText;

  // Try to find by data attributes
  const byData = await findByDataAttribute(page, description);
  if (byData) return byData;

  return null;
}

/**
 * Find element by matching text content
 */
async function findByText(page: Page, baseSelector: string, text: string): Promise<string | null> {
  const elements = await page.locator(baseSelector).all();

  for (let i = 0; i < elements.length; i++) {
    const elementText = await elements[i].textContent();
    if (elementText?.toLowerCase().includes(text.toLowerCase())) {
      // Build more specific selector
      const nth = i === 0 ? '' : `.nth(${i})`;
      return `${baseSelector}${nth}`;
    }
  }

  return null;
}

/**
 * Find element by text content anywhere
 */
async function findByTextContent(page: Page, text: string): Promise<string | null> {
  // Extract potential text from description
  const words = text.split(' ').filter((w) => w.length > 2);

  for (const word of words) {
    const selector = `text=${word}`;
    const count = await page.locator(selector).count();
    if (count > 0) {
      return selector;
    }
  }

  return null;
}

/**
 * Find element by data attribute
 */
async function findByDataAttribute(page: Page, description: string): Promise<string | null> {
  const lowerDesc = description.toLowerCase();

  // Common data attribute patterns
  const dataAttributes = ['testament', 'book', 'chapter', 'verse', 'tab', 'testid', 'test-id'];

  for (const attr of dataAttributes) {
    if (lowerDesc.includes(attr)) {
      const selector = `[data-${attr}]`;
      const count = await page.locator(selector).count();
      if (count > 0) {
        return selector;
      }
    }
  }

  return null;
}

/**
 * Validate selector exists on page
 */
export async function validateSelector(page: Page, selector: string): Promise<boolean> {
  try {
    const count = await page.locator(selector).count();
    return count > 0;
  } catch {
    return false;
  }
}

/**
 * Get selector suggestions for an element description
 */
export async function getSelectorSuggestions(page: Page, description: string): Promise<string[]> {
  const suggestions: string[] = [];

  // Try findSelector
  const primary = await findSelector(page, description);
  if (primary) {
    suggestions.push(primary);
  }

  // Add common fallbacks
  const lowerDesc = description.toLowerCase();

  if (lowerDesc.includes('button')) {
    suggestions.push('button', '[role="button"]');
  }
  if (lowerDesc.includes('link')) {
    suggestions.push('a', '[role="link"]');
  }
  if (lowerDesc.includes('input') || lowerDesc.includes('field')) {
    suggestions.push('input', 'textarea');
  }

  // Remove duplicates
  return [...new Set(suggestions)];
}
