import type { Page } from '@playwright/test';
import type {
  ColorStyles,
  ComputedStyles,
  DesignToken,
  HTMLStructure,
  LayoutStyles,
  PageMetadata,
  SpacingStyles,
  TypographyStyles,
} from '../types';

/**
 * Metadata Extraction Utility
 *
 * Extracts HTML structure, CSS styles, and design tokens from web pages.
 */

/**
 * Extract complete page metadata
 */
export async function extractPageMetadata(page: Page, url: string): Promise<PageMetadata> {
  const [htmlStructure, computedStyles, designTokens] = await Promise.all([
    extractHTMLStructure(page),
    extractComputedStyles(page),
    extractDesignTokens(page),
  ]);

  return {
    url,
    capturedAt: new Date().toISOString(),
    htmlStructure,
    computedStyles,
    designTokens,
  };
}

/**
 * Extract HTML structure recursively
 */
export async function extractHTMLStructure(
  page: Page,
  selector: string = 'body'
): Promise<HTMLStructure> {
  const structure = await page.locator(selector).evaluate((el) => {
    function extractElement(element: Element, depth = 0, maxDepth = 5): HTMLStructure {
      const structure: HTMLStructure = {
        tag: element.tagName.toLowerCase(),
        classes: Array.from(element.classList),
        id: element.id || undefined,
        attributes: {},
        children: [],
      };

      // Extract attributes (excluding class and id which are already captured)
      for (const attr of Array.from(element.attributes)) {
        if (attr.name !== 'class' && attr.name !== 'id') {
          structure.attributes[attr.name] = attr.value;
        }
      }

      // Extract text content for leaf nodes
      if (element.children.length === 0) {
        const text = element.textContent?.trim();
        if (text && text.length > 0 && text.length < 100) {
          structure.textContent = text;
        }
      }

      // Recursively extract children (with depth limit)
      if (depth < maxDepth) {
        structure.children = Array.from(element.children).map((child) =>
          extractElement(child, depth + 1, maxDepth)
        );
      }

      return structure;
    }

    return extractElement(el);
  });

  return structure;
}

/**
 * Extract computed styles from key elements
 */
export async function extractComputedStyles(page: Page): Promise<ComputedStyles[]> {
  const styles = await page.evaluate(() => {
    // Select key elements to extract styles from
    const selectors = [
      'body',
      'h1',
      'h2',
      'h3',
      'p',
      'a',
      'button',
      '.main',
      '[role="main"]',
      'main',
    ];

    const results: {
      selector: string;
      styles: {
        typography: TypographyStyles;
        colors: ColorStyles;
        spacing: SpacingStyles;
        layout: LayoutStyles;
      };
    }[] = [];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (!element) continue;

      const computed = window.getComputedStyle(element);

      results.push({
        selector,
        styles: {
          typography: {
            fontFamily: computed.fontFamily,
            fontSize: computed.fontSize,
            fontWeight: computed.fontWeight,
            lineHeight: computed.lineHeight,
            letterSpacing: computed.letterSpacing,
          },
          colors: {
            color: computed.color,
            backgroundColor: computed.backgroundColor,
            borderColor: computed.borderColor,
          },
          spacing: {
            margin: computed.margin,
            padding: computed.padding,
          },
          layout: {
            display: computed.display,
            position: computed.position,
            width: computed.width,
            height: computed.height,
          },
        },
      });
    }

    return results;
  });

  return styles;
}

/**
 * Extract CSS custom properties (design tokens)
 */
export async function extractDesignTokens(page: Page): Promise<DesignToken[]> {
  const tokens = await page.evaluate(() => {
    const root = document.documentElement;
    const styles = window.getComputedStyle(root);
    const tokens: { name: string; value: string; category: string }[] = [];

    // Extract all CSS custom properties
    for (let i = 0; i < styles.length; i++) {
      const propertyName = styles[i];
      if (propertyName.startsWith('--')) {
        const value = styles.getPropertyValue(propertyName).trim();

        // Categorize token based on name patterns
        let category: DesignToken['category'] = 'color';
        if (
          propertyName.includes('font') ||
          propertyName.includes('text') ||
          propertyName.includes('letter') ||
          propertyName.includes('line')
        ) {
          category = 'typography';
        } else if (
          propertyName.includes('space') ||
          propertyName.includes('gap') ||
          propertyName.includes('margin') ||
          propertyName.includes('padding')
        ) {
          category = 'spacing';
        } else if (propertyName.includes('border') || propertyName.includes('radius')) {
          category = 'border';
        } else if (propertyName.includes('shadow')) {
          category = 'shadow';
        }

        tokens.push({
          name: propertyName,
          value,
          category,
        });
      }
    }

    return tokens;
  });

  return tokens;
}

/**
 * Extract specific element styles
 */
export async function extractElementStyles(
  page: Page,
  selector: string
): Promise<ComputedStyles | null> {
  const element = page.locator(selector).first();
  const count = await element.count();

  if (count === 0) {
    return null;
  }

  const styles = await element.evaluate((el) => {
    const computed = window.getComputedStyle(el);
    return {
      selector,
      styles: {
        typography: {
          fontFamily: computed.fontFamily,
          fontSize: computed.fontSize,
          fontWeight: computed.fontWeight,
          lineHeight: computed.lineHeight,
          letterSpacing: computed.letterSpacing,
        },
        colors: {
          color: computed.color,
          backgroundColor: computed.backgroundColor,
          borderColor: computed.borderColor,
        },
        spacing: {
          margin: computed.margin,
          padding: computed.padding,
        },
        layout: {
          display: computed.display,
          position: computed.position,
          width: computed.width,
          height: computed.height,
        },
      },
    };
  });

  return styles;
}

/**
 * Convert RGB color to hex
 */
export function rgbToHex(rgb: string): string {
  const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!match) return rgb;

  const r = Number.parseInt(match[1]).toString(16).padStart(2, '0');
  const g = Number.parseInt(match[2]).toString(16).padStart(2, '0');
  const b = Number.parseInt(match[3]).toString(16).padStart(2, '0');

  return `#${r}${g}${b}`;
}
