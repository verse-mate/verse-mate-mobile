/**
 * Shared Playwright helpers for desktop E2E tests.
 */

import type { Page } from '@playwright/test';

const BASE_URL = 'http://localhost:8081';

/**
 * Navigate to the app and skip onboarding if shown.
 */
export async function skipOnboarding(page: Page): Promise<void> {
  await page.goto(BASE_URL);

  // Set onboarding flag to skip it
  await page.evaluate(() => {
    localStorage.setItem('HAS_SEEN_ONBOARDING', 'true');
  });

  // Reload to apply
  await page.goto(BASE_URL);
}

/**
 * Navigate to a Bible chapter and wait for split view to render.
 * Assumes onboarding is already skipped.
 */
export async function navigateToBibleSplitView(
  page: Page,
  bookId = 1,
  chapter = 1
): Promise<void> {
  await page.goto(`${BASE_URL}/bible/${bookId}/${chapter}`);
  await waitForSplitView(page);
}

/**
 * Wait for the split-view container to appear.
 */
export async function waitForSplitView(page: Page): Promise<void> {
  await page.waitForSelector('[data-testid="split-view"]', { timeout: 30000 });
}

/**
 * Wait for single-column layout (no split view).
 */
export async function waitForSingleColumn(page: Page): Promise<void> {
  await page.waitForSelector('[data-testid="chapter-selector-button"]', {
    timeout: 30000,
  });
}

/**
 * Get the bounding box width of an element by testID.
 */
export async function getElementWidth(
  page: Page,
  testId: string
): Promise<number> {
  const el = page.getByTestId(testId);
  const box = await el.boundingBox();
  return box?.width ?? 0;
}
