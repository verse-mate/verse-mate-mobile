/**
 * Split View Edge Tab Tests
 *
 * Tests edge tab visibility in full-screen modes.
 * Uses drag-to-edge-snap (proven working) to enter full modes.
 */

import { expect, test } from '@playwright/test';
import { getElementWidth, navigateToBibleSplitView, skipOnboarding } from './helpers';

test.describe('Split view edge tabs', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await skipOnboarding(page);
    await navigateToBibleSplitView(page);
  });

  test('left edge tab is present in right-full mode', async ({ page }) => {
    // Drag divider to far left → right-full mode
    const divider = page.getByTestId('split-view-divider');
    const box = await divider.boundingBox();
    expect(box).not.toBeNull();

    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(50, box!.y + box!.height / 2, { steps: 20 });
    await page.mouse.up();
    await page.waitForTimeout(500);

    // Confirm right-full mode
    const leftWidth = await getElementWidth(page, 'split-view-left-panel');
    expect(leftWidth).toBe(0);

    // Left edge tab should be in the DOM
    const leftEdgeTab = page.getByTestId('split-view-left-edge-tab');
    await expect(leftEdgeTab).toBeAttached();
  });

  test('right edge tab is present in left-full mode', async ({ page }) => {
    // Drag divider to far right → left-full mode
    const divider = page.getByTestId('split-view-divider');
    const box = await divider.boundingBox();
    expect(box).not.toBeNull();

    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(1250, box!.y + box!.height / 2, { steps: 20 });
    await page.mouse.up();
    await page.waitForTimeout(500);

    // Confirm left-full mode
    const rightWidth = await getElementWidth(page, 'split-view-right-panel');
    expect(rightWidth).toBe(0);

    // Right edge tab should be in the DOM
    const rightEdgeTab = page.getByTestId('split-view-right-edge-tab');
    await expect(rightEdgeTab).toBeAttached();
  });
});
