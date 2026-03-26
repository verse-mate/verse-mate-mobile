/**
 * Split View Breakpoint Tests
 *
 * Tests the 1024px viewport boundary where split view activates/deactivates.
 * These tests require precise viewport control — impossible with Maestro.
 */

import { expect, test } from '@playwright/test';
import { getElementWidth, skipOnboarding } from './helpers';

const BASE_URL = 'http://localhost:8081';

test.describe('Split view breakpoint', () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
  });

  test('should NOT show split view at 1023px width', async ({ page }) => {
    await page.setViewportSize({ width: 1023, height: 800 });
    await page.goto(`${BASE_URL}/bible/1/1`);

    // Wait for the page to load
    await page.waitForSelector('[data-testid="chapter-selector-button"]', {
      timeout: 30000,
    });

    // Split view should NOT be in the DOM
    const splitView = page.getByTestId('split-view');
    await expect(splitView).not.toBeVisible();

    // Single-column chapter selector should be visible
    const chapterSelector = page.getByTestId('chapter-selector-button');
    await expect(chapterSelector).toBeVisible();
  });

  test('should show split view at 1024px width', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    await page.goto(`${BASE_URL}/bible/1/1`);

    // Wait for split view to appear
    await page.waitForSelector('[data-testid="split-view"]', {
      timeout: 30000,
    });

    const splitView = page.getByTestId('split-view');
    await expect(splitView).toBeVisible();

    // Both panels should be present
    const leftPanel = page.getByTestId('split-view-left-panel');
    const rightPanel = page.getByTestId('split-view-right-panel');
    await expect(leftPanel).toBeVisible();
    await expect(rightPanel).toBeVisible();

    // Panels should have non-zero width
    const leftWidth = await getElementWidth(page, 'split-view-left-panel');
    const rightWidth = await getElementWidth(page, 'split-view-right-panel');
    expect(leftWidth).toBeGreaterThan(0);
    expect(rightWidth).toBeGreaterThan(0);
  });

  test('should switch layout dynamically on resize', async ({ page }) => {
    // Start at desktop width — split view
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${BASE_URL}/bible/1/1`);

    await page.waitForSelector('[data-testid="split-view"]', {
      timeout: 30000,
    });
    await expect(page.getByTestId('split-view')).toBeVisible();

    // Resize below threshold — single column
    await page.setViewportSize({ width: 800, height: 800 });
    await page.waitForTimeout(1000); // Allow React to re-render

    await expect(page.getByTestId('split-view')).not.toBeVisible();
    await expect(page.getByTestId('chapter-selector-button')).toBeVisible();

    // Resize back above threshold — split view returns
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(1000);

    await page.waitForSelector('[data-testid="split-view"]', {
      timeout: 10000,
    });
    await expect(page.getByTestId('split-view')).toBeVisible();
  });
});
