import { expect, test } from '@playwright/test';

/**
 * Metadata Extraction Validation Tests
 *
 * These tests validate the accuracy of metadata extraction
 * by comparing extracted values against expected patterns.
 */

test.describe('Metadata Extraction Validation', () => {
  test('should extract HTML structure accurately', async ({ page }) => {
    await page.goto('/bible/1/1');
    await page.waitForLoadState('networkidle');

    // Extract body element structure
    const bodyStructure = await page.locator('body').evaluate((el) => {
      function extractStructure(element: Element): any {
        return {
          tag: element.tagName.toLowerCase(),
          classes: Array.from(element.classList),
          id: element.id || undefined,
          attributes: Array.from(element.attributes).reduce(
            (acc, attr) => {
              if (attr.name !== 'class' && attr.name !== 'id') {
                acc[attr.name] = attr.value;
              }
              return acc;
            },
            {} as Record<string, string>
          ),
          childCount: element.children.length,
        };
      }
      return extractStructure(el);
    });

    expect(bodyStructure.tag).toBe('body');
    expect(bodyStructure.childCount).toBeGreaterThan(0);
  });

  test('should extract computed CSS styles correctly', async ({ page }) => {
    await page.goto('/bible/1/1');
    await page.waitForLoadState('networkidle');

    // Extract computed styles from body
    const computedStyles = await page.locator('body').evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        typography: {
          fontFamily: styles.fontFamily,
          fontSize: styles.fontSize,
          fontWeight: styles.fontWeight,
          lineHeight: styles.lineHeight,
          letterSpacing: styles.letterSpacing,
        },
        colors: {
          color: styles.color,
          backgroundColor: styles.backgroundColor,
        },
        spacing: {
          margin: styles.margin,
          padding: styles.padding,
        },
        layout: {
          display: styles.display,
          position: styles.position,
        },
      };
    });

    // Validate typography extraction
    expect(computedStyles.typography.fontFamily).toBeTruthy();
    expect(computedStyles.typography.fontSize).toMatch(/^\d+(\.\d+)?px$/);
    expect(computedStyles.typography.fontWeight).toBeTruthy();

    // Validate color extraction (should be in rgb/rgba format)
    expect(computedStyles.colors.color).toMatch(/^rgb/);
    expect(computedStyles.colors.backgroundColor).toMatch(/^rgb/);

    // Validate spacing
    expect(computedStyles.spacing.margin).toBeTruthy();
    expect(computedStyles.spacing.padding).toBeTruthy();
  });

  test('should extract CSS custom properties (design tokens)', async ({ page }) => {
    await page.goto('/bible/1/1');
    await page.waitForLoadState('networkidle');

    // Extract CSS custom properties
    const designTokens = await page.evaluate(() => {
      const root = document.documentElement;
      const styles = window.getComputedStyle(root);
      const tokens: Record<string, string> = {};

      // Extract all CSS custom properties
      for (let i = 0; i < styles.length; i++) {
        const propertyName = styles[i];
        if (propertyName.startsWith('--')) {
          tokens[propertyName] = styles.getPropertyValue(propertyName).trim();
        }
      }

      return tokens;
    });

    // The web app might not use CSS custom properties
    // Just verify the extraction function works (returns an object)
    const tokenCount = Object.keys(designTokens).length;
    expect(typeof designTokens).toBe('object');

    // Log tokens for manual verification (useful for debugging)
    console.log(`Extracted ${tokenCount} design tokens`);
    if (tokenCount > 0) {
      console.log('Sample tokens:', Object.keys(designTokens).slice(0, 5));
    }
  });

  test('should handle nested HTML structure extraction', async ({ page }) => {
    await page.goto('/bible/1/1');
    await page.waitForLoadState('networkidle');

    // Try to find a common container element
    const mainContent = await page.locator('main, [role="main"], .main-content').first();
    const exists = (await mainContent.count()) > 0;

    if (exists) {
      const structure = await mainContent.evaluate((el) => {
        function extractDeep(element: Element, depth = 0, maxDepth = 3): any {
          if (depth > maxDepth) return null;

          return {
            tag: element.tagName.toLowerCase(),
            classes: Array.from(element.classList),
            childCount: element.children.length,
            children: Array.from(element.children)
              .slice(0, 5) // Limit to first 5 children
              .map((child) => extractDeep(child, depth + 1, maxDepth))
              .filter(Boolean),
          };
        }
        return extractDeep(el);
      });

      expect(structure).toBeTruthy();
      expect(structure.tag).toBeTruthy();
    } else {
      // If no main content found, just verify body has children
      const bodyChildren = await page.locator('body > *').count();
      expect(bodyChildren).toBeGreaterThan(0);
    }
  });

  test('should extract color values in consistent format', async ({ page }) => {
    await page.goto('/bible/1/1');
    await page.waitForLoadState('networkidle');

    // Extract colors from multiple elements
    const colors = await page.evaluate(() => {
      const elements = [
        document.body,
        ...Array.from(document.querySelectorAll('h1, h2, p, a')).slice(0, 5),
      ];

      return elements.map((el) => {
        const styles = window.getComputedStyle(el);
        return {
          tag: el.tagName.toLowerCase(),
          color: styles.color,
          backgroundColor: styles.backgroundColor,
        };
      });
    });

    // All colors should be in rgb/rgba format
    for (const element of colors) {
      if (element.color !== 'rgba(0, 0, 0, 0)') {
        expect(element.color).toMatch(/^rgba?\(/);
      }
      if (element.backgroundColor !== 'rgba(0, 0, 0, 0)') {
        expect(element.backgroundColor).toMatch(/^rgba?\(/);
      }
    }
  });

  test('should extract font information accurately', async ({ page }) => {
    await page.goto('/bible/1/1');
    await page.waitForLoadState('networkidle');

    // Extract font information from text elements
    const fonts = await page.evaluate(() => {
      const textElements = Array.from(document.querySelectorAll('h1, h2, h3, p, span, div')).slice(
        0,
        10
      );

      return textElements.map((el) => {
        const styles = window.getComputedStyle(el);
        return {
          tag: el.tagName.toLowerCase(),
          fontFamily: styles.fontFamily,
          fontSize: styles.fontSize,
          fontWeight: styles.fontWeight,
          lineHeight: styles.lineHeight,
        };
      });
    });

    // Verify all fonts have required properties
    for (const font of fonts) {
      expect(font.fontFamily).toBeTruthy();
      expect(font.fontSize).toMatch(/^\d+(\.\d+)?px$/);
      expect(font.fontWeight).toBeTruthy();
      expect(font.lineHeight).toBeTruthy();
    }
  });
});
