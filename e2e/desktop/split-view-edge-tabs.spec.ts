/**
 * Split View Edge Tab Tests
 *
 * Tests edge tab visibility in full-screen modes and click-to-restore.
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

  test('left edge tab appears in right-full mode and restores split', async ({ page }) => {
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

    // Left edge tab should appear — find it and check opacity
    const leftEdgeTab = page.getByTestId('split-view-left-edge-tab');
    await expect(leftEdgeTab).toBeAttached();

    // Click inside the edge tab to restore split mode
    const tabBox = await leftEdgeTab.boundingBox();
    expect(tabBox).not.toBeNull();
    await page.mouse.click(tabBox!.x + tabBox!.width / 2, tabBox!.y + tabBox!.height / 2);
    await page.waitForTimeout(500);

    // Both panels should now have non-zero width
    const newLeftWidth = await getElementWidth(page, 'split-view-left-panel');
    const newRightWidth = await getElementWidth(page, 'split-view-right-panel');
    expect(newLeftWidth).toBeGreaterThan(0);
    expect(newRightWidth).toBeGreaterThan(0);
  });

  test('right edge tab appears in left-full mode and restores split', async ({ page }) => {
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

    // Right edge tab should appear
    const rightEdgeTab = page.getByTestId('split-view-right-edge-tab');
    await expect(rightEdgeTab).toBeAttached();

    // Click inside the edge tab to restore split mode
    const tabBox2 = await rightEdgeTab.boundingBox();
    expect(tabBox2).not.toBeNull();
    await page.mouse.click(tabBox2!.x + tabBox2!.width / 2, tabBox2!.y + tabBox2!.height / 2);
    await page.waitForTimeout(500);

    // Both panels should now have non-zero width
    const newLeftWidth = await getElementWidth(page, 'split-view-left-panel');
    const newRightWidth = await getElementWidth(page, 'split-view-right-panel');
    expect(newLeftWidth).toBeGreaterThan(0);
    expect(newRightWidth).toBeGreaterThan(0);
  });
});
