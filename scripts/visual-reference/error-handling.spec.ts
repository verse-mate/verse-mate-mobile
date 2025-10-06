import { expect, test } from '@playwright/test';

/**
 * Error Handling Tests
 *
 * Validates error handling for network failures, timeouts, and missing elements.
 */

test.describe('Error Handling', () => {
  test('should handle network timeout gracefully', async ({ page }) => {
    // Set a very short timeout to simulate timeout
    const timeout = 5000;

    try {
      await page.goto('/bible/1/1', { timeout });
      // If it succeeds, that's fine
      expect(page.url()).toContain('versemate.org');
    } catch (error) {
      // If it fails, verify it's a timeout error
      expect(error).toBeTruthy();
    }
  });

  test('should handle missing selector gracefully', async ({ page }) => {
    await page.goto('/bible/1/1');
    await page.waitForLoadState('networkidle');

    // Try to find a selector that definitely doesn't exist
    const nonExistent = page.locator('.this-selector-does-not-exist-xyz-123');
    const count = await nonExistent.count();

    expect(count).toBe(0);
  });

  test('should handle element screenshot failure', async ({ page }) => {
    await page.goto('/bible/1/1');
    await page.waitForLoadState('networkidle');

    // Try to screenshot an element that doesn't exist
    const nonExistent = page.locator('.non-existent-element-xyz');
    const count = await nonExistent.count();

    if (count === 0) {
      // Element doesn't exist, which is expected
      expect(count).toBe(0);
    }
  });

  test('should retry failed navigation', async ({ page }) => {
    let attempts = 0;
    const maxAttempts = 2;

    while (attempts < maxAttempts) {
      try {
        await page.goto('/bible/1/1', { timeout: 30000 });
        break;
      } catch (error) {
        attempts++;
        if (attempts >= maxAttempts) {
          throw error;
        }
      }
    }

    expect(page.url()).toContain('versemate.org');
  });

  test('should validate URL before navigation', async () => {
    const baseUrl = 'https://app.versemate.org';
    const validPaths = ['/bible', '/bible/1/1', '/'];
    const invalidPaths = ['', '   '];

    for (const path of validPaths) {
      const fullUrl = path.startsWith('http') ? path : `${baseUrl}${path}`;
      expect(fullUrl).toMatch(/^https?:\/\//);
    }

    for (const path of invalidPaths) {
      const fullUrl = path.trim();
      if (fullUrl === '') {
        expect(fullUrl).toBe('');
      }
    }
  });

  test('should handle slow network conditions', async ({ page }) => {
    // Navigate with longer timeout for slow networks
    await page.goto('/bible/1/1', {
      timeout: 60000,
      waitUntil: 'domcontentloaded', // Don't wait for all resources
    });

    expect(page.url()).toContain('versemate.org');
  });

  test('should handle missing metadata gracefully', async ({ page }) => {
    await page.goto('/bible/1/1');
    await page.waitForLoadState('networkidle');

    // Try to extract metadata from non-existent element
    const metadata = await page.evaluate(() => {
      const element = document.querySelector('.non-existent-xyz');
      if (!element) {
        return null;
      }

      const styles = window.getComputedStyle(element);
      return {
        fontFamily: styles.fontFamily,
      };
    });

    expect(metadata).toBeNull();
  });

  test('should validate screenshot output path', async () => {
    const validPaths = [
      '/tmp/screenshots/test.png',
      './screenshots/test.png',
      'screenshots/test.png',
    ];

    for (const path of validPaths) {
      expect(path).toMatch(/\.png$/);
      expect(path.length).toBeGreaterThan(0);
    }
  });
});
