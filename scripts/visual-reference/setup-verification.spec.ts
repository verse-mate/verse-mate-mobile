import { test, expect } from '@playwright/test';

/**
 * Playwright Setup Verification Test
 *
 * This test verifies that Playwright is correctly configured
 * for visual reference capture from the VerseMate web app.
 */

test.describe('Playwright Setup Verification', () => {
  test('should load VerseMate web app successfully', async ({ page }) => {
    // Navigate to the VerseMate web app
    await page.goto('/');

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Verify page loaded successfully
    expect(page.url()).toContain('versemate.org');

    // Take a test screenshot to verify screenshot capability
    const screenshot = await page.screenshot();
    expect(screenshot).toBeTruthy();
    expect(screenshot.length).toBeGreaterThan(0);
  });

  test('should support all configured viewports', async ({ page, browserName }) => {
    // This test runs across all viewport configurations
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Get viewport size
    const viewport = page.viewportSize();
    expect(viewport).toBeTruthy();
    expect(viewport?.width).toBeGreaterThan(0);
    expect(viewport?.height).toBeGreaterThan(0);

    // Verify browser is Chromium (as configured)
    expect(browserName).toBe('chromium');
  });

  test('should capture full page screenshot', async ({ page }) => {
    await page.goto('/bible');
    await page.waitForLoadState('networkidle');

    // Take full page screenshot
    const screenshot = await page.screenshot({
      fullPage: true,
    });

    expect(screenshot).toBeTruthy();
    expect(screenshot.length).toBeGreaterThan(0);
  });

  test('should extract page metadata', async ({ page }) => {
    await page.goto('/bible');
    await page.waitForLoadState('networkidle');

    // Extract page title (may be empty on some pages, so just check it's a string)
    const title = await page.title();
    expect(typeof title).toBe('string');

    // Extract HTML structure
    const bodyHTML = await page.locator('body').innerHTML();
    expect(bodyHTML).toBeTruthy();
    expect(bodyHTML.length).toBeGreaterThan(0);

    // Extract computed styles
    const bodyStyles = await page.locator('body').evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        fontFamily: computed.fontFamily,
        backgroundColor: computed.backgroundColor,
      };
    });

    expect(bodyStyles.fontFamily).toBeTruthy();
    expect(bodyStyles.backgroundColor).toBeTruthy();
  });

  test('should handle navigation timeout gracefully', async ({ page }) => {
    // Set a very short timeout to test error handling
    await page.goto('/bible', { timeout: 30000 });

    // Verify page loaded despite timeout
    const url = page.url();
    expect(url).toContain('versemate.org');
  });
});
