/**
 * Split View Edge Tab Tests
 *
 * Tests edge tab visibility and click-to-restore-split interaction.
 */

import { expect, test } from '@playwright/test';
import {
  getElementWidth,
  navigateToBibleSplitView,
  skipOnboarding,
} from './helpers';

test.describe('Split view edge tabs', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await skipOnboarding(page);
    await navigateToBibleSplitView(page);
  });

  test('should show left edge tab in right-full mode and restore split', async ({
    page,
  }) => {
    // Drag divider to far left to trigger right-full mode
    const divider = page.getByTestId('split-view-divider');
    const box = await divider.boundingBox();
    expect(box).not.toBeNull();

    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(50, box!.y + box!.height / 2, { steps: 20 });
    await page.mouse.up();
    await page.waitForTimeout(500);

    // Verify right-full mode (left panel collapsed)
    const leftWidth = await getElementWidth(page, 'split-view-left-panel');
    expect(leftWidth).toBe(0);

    // Left edge tab should be visible
    const leftEdgeTab = page.getByTestId('split-view-left-edge-tab');
    await expect(leftEdgeTab).toBeVisible();

    // Click left edge tab to restore split mode
    await leftEdgeTab.click();
    await page.waitForTimeout(500);

    // Both panels should now have non-zero width
    const newLeftWidth = await getElementWidth(page, 'split-view-left-panel');
    const newRightWidth = await getElementWidth(
      page,
      'split-view-right-panel'
    );
    expect(newLeftWidth).toBeGreaterThan(0);
    expect(newRightWidth).toBeGreaterThan(0);
  });

  test('should show right edge tab in left-full mode and restore split', async ({
    page,
  }) => {
    // Drag divider to far right to trigger left-full mode
    const divider = page.getByTestId('split-view-divider');
    const box = await divider.boundingBox();
    expect(box).not.toBeNull();

    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(1250, box!.y + box!.height / 2, { steps: 20 });
    await page.mouse.up();
    await page.waitForTimeout(500);

    // Verify left-full mode (right panel collapsed)
    const rightWidth = await getElementWidth(page, 'split-view-right-panel');
    expect(rightWidth).toBe(0);

    // Right edge tab should be visible
    const rightEdgeTab = page.getByTestId('split-view-right-edge-tab');
    await expect(rightEdgeTab).toBeVisible();

    // Click right edge tab to restore split mode
    await rightEdgeTab.click();
    await page.waitForTimeout(500);

    // Both panels should now have non-zero width
    const newLeftWidth = await getElementWidth(page, 'split-view-left-panel');
    const newRightWidth = await getElementWidth(
      page,
      'split-view-right-panel'
    );
    expect(newLeftWidth).toBeGreaterThan(0);
    expect(newRightWidth).toBeGreaterThan(0);
  });
});
