import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Page } from '@playwright/test';
import type { CaptureResult, ScreenshotOptions, ViewportConfig } from '../types';
import { VIEWPORTS } from '../types';

/**
 * Screenshot Capture Utility
 *
 * Handles multi-viewport screenshot capture with configurable options.
 */

/**
 * Capture screenshots for all viewports
 */
export async function captureAllViewports(
  page: Page,
  outputDir: string,
  name: string,
  options: ScreenshotOptions = {}
): Promise<CaptureResult> {
  const screenshots: CaptureResult['screenshots'] = [];
  const viewportNames: ViewportConfig['name'][] = ['desktop', 'tablet', 'mobile'];

  try {
    // Ensure output directory exists
    fs.mkdirSync(outputDir, { recursive: true });

    for (const viewportName of viewportNames) {
      const viewport = VIEWPORTS[viewportName];
      const screenshot = await captureViewport(page, outputDir, name, viewport, options);
      screenshots.push(screenshot);
    }

    return {
      success: true,
      screenshots,
    };
  } catch (error) {
    return {
      success: false,
      screenshots,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Capture screenshot for a specific viewport
 */
export async function captureViewport(
  page: Page,
  outputDir: string,
  name: string,
  viewport: ViewportConfig,
  options: ScreenshotOptions = {}
): Promise<{ viewport: string; path: string }> {
  // Set viewport size
  await page.setViewportSize({
    width: viewport.width,
    height: viewport.height,
  });

  // Wait for any animations or layout shifts
  await page.waitForTimeout(500);

  // Build filename
  const state = options.state || 'default';
  const filename = `${name}_${viewport.name}_${state}.png`;
  const fullPath = path.join(outputDir, filename);

  // Screenshot options
  const screenshotOptions: Parameters<Page['screenshot']>[0] = {
    path: fullPath,
    fullPage: options.fullPage ?? true,
    type: 'png',
  };

  // Handle selector-based screenshot
  if (options.selector) {
    const element = page.locator(options.selector);
    await element.screenshot({ path: fullPath, type: 'png' });
  } else {
    await page.screenshot(screenshotOptions);
  }

  return {
    viewport: viewport.name,
    path: fullPath,
  };
}

/**
 * Capture screenshot with state (hover, focus, etc.)
 */
export async function captureWithState(
  page: Page,
  outputDir: string,
  name: string,
  viewport: ViewportConfig,
  selector: string,
  state: 'hover' | 'focus' | 'active'
): Promise<{ viewport: string; path: string }> {
  // Set viewport
  await page.setViewportSize({
    width: viewport.width,
    height: viewport.height,
  });

  const element = page.locator(selector);

  // Apply state
  switch (state) {
    case 'hover':
      await element.hover();
      break;
    case 'focus':
      await element.focus();
      break;
    case 'active':
      // Active state is tricky, we'll click and hold
      await element.click();
      break;
  }

  // Wait for state to apply
  await page.waitForTimeout(200);

  // Capture
  const filename = `${name}_${viewport.name}_${state}.png`;
  const fullPath = path.join(outputDir, filename);

  await page.screenshot({ path: fullPath, fullPage: true, type: 'png' });

  return {
    viewport: viewport.name,
    path: fullPath,
  };
}

/**
 * Capture element screenshot
 */
export async function captureElement(
  page: Page,
  selector: string,
  outputPath: string
): Promise<void> {
  const element = page.locator(selector);
  await element.screenshot({ path: outputPath, type: 'png' });
}

/**
 * Get screenshot file path
 */
export function getScreenshotPath(
  outputDir: string,
  name: string,
  viewport: ViewportConfig['name'],
  state: string = 'default'
): string {
  return path.join(outputDir, `${name}_${viewport}_${state}.png`);
}
