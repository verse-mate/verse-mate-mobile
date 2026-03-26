/**
 * Split View Divider Tests
 *
 * Tests divider drag edge-snap interactions and divider visibility.
 */

import { expect, test } from '@playwright/test';
import { getElementWidth, navigateToBibleSplitView, skipOnboarding } from './helpers';

test.describe('Split view divider', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await skipOnboarding(page);
    await navigateToBibleSplitView(page);
  });

  test('divider should be visible in split mode', async ({ page }) => {
    const divider = page.getByTestId('split-view-divider');
    await expect(divider).toBeVisible();

    const box = await divider.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThan(100);
  });

  test('panels should have correct initial widths', async ({ page }) => {
    const leftWidth = await getElementWidth(page, 'split-view-left-panel');
    const rightWidth = await getElementWidth(page, 'split-view-right-panel');

    // Default ratio is 0.536, so left ~ 686px, right ~ 594px at 1280px
    expect(leftWidth).toBeGreaterThan(600);
    expect(leftWidth).toBeLessThan(800);
    expect(rightWidth).toBeGreaterThan(400);
    expect(rightWidth).toBeLessThan(700);
    expect(leftWidth + rightWidth).toBeGreaterThan(1200); // ~1280 minus divider margins
  });

  test('should snap to right-full when dragged to far left', async ({ page }) => {
    const divider = page.getByTestId('split-view-divider');
    const box = await divider.boundingBox();
    expect(box).not.toBeNull();

    // Drag divider all the way to the left edge (< 120px = edge snap)
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(50, box!.y + box!.height / 2, { steps: 20 });
    await page.mouse.up();
    await page.waitForTimeout(500);

    // Left panel should be collapsed
    const leftWidth = await getElementWidth(page, 'split-view-left-panel');
    expect(leftWidth).toBe(0);

    const rightWidth = await getElementWidth(page, 'split-view-right-panel');
    expect(rightWidth).toBeGreaterThan(1000);
  });

  test('should snap to left-full when dragged to far right', async ({ page }) => {
    const divider = page.getByTestId('split-view-divider');
    const box = await divider.boundingBox();
    expect(box).not.toBeNull();

    // Drag divider all the way to the right edge
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(1250, box!.y + box!.height / 2, { steps: 20 });
    await page.mouse.up();
    await page.waitForTimeout(500);

    // Right panel should be collapsed
    const rightWidth = await getElementWidth(page, 'split-view-right-panel');
    expect(rightWidth).toBe(0);

    const leftWidth = await getElementWidth(page, 'split-view-left-panel');
    expect(leftWidth).toBeGreaterThan(1000);
  });
});
