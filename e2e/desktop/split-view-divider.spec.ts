/**
 * Split View Divider Drag Tests
 *
 * Tests mouse-based divider drag interaction — panel resizing and edge-snap.
 */

import { expect, test } from '@playwright/test';
import {
  getElementWidth,
  navigateToBibleSplitView,
  skipOnboarding,
} from './helpers';

test.describe('Split view divider', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await skipOnboarding(page);
    await navigateToBibleSplitView(page);
  });

  test('should resize panels when dragging divider right', async ({
    page,
  }) => {
    const divider = page.getByTestId('split-view-divider');
    const box = await divider.boundingBox();
    expect(box).not.toBeNull();

    const initialLeftWidth = await getElementWidth(
      page,
      'split-view-left-panel'
    );

    // Drag divider 100px to the right
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box!.x + box!.width / 2 + 100,
      box!.y + box!.height / 2,
      { steps: 10 }
    );
    await page.mouse.up();

    // Wait for transition
    await page.waitForTimeout(500);

    const newLeftWidth = await getElementWidth(page, 'split-view-left-panel');
    expect(newLeftWidth).toBeGreaterThan(initialLeftWidth);
  });

  test('should resize panels when dragging divider left', async ({ page }) => {
    const divider = page.getByTestId('split-view-divider');
    const box = await divider.boundingBox();
    expect(box).not.toBeNull();

    const initialLeftWidth = await getElementWidth(
      page,
      'split-view-left-panel'
    );

    // Drag divider 100px to the left
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box!.x + box!.width / 2 - 100,
      box!.y + box!.height / 2,
      { steps: 10 }
    );
    await page.mouse.up();

    await page.waitForTimeout(500);

    const newLeftWidth = await getElementWidth(page, 'split-view-left-panel');
    expect(newLeftWidth).toBeLessThan(initialLeftWidth);
  });

  test('should snap to right-full when dragged to far left', async ({
    page,
  }) => {
    const divider = page.getByTestId('split-view-divider');
    const box = await divider.boundingBox();
    expect(box).not.toBeNull();

    // Drag divider all the way to the left edge (< 120px = edge snap)
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(50, box!.y + box!.height / 2, { steps: 20 });
    await page.mouse.up();

    // Wait for transition
    await page.waitForTimeout(500);

    // Left panel should be collapsed (width 0), right panel fills container
    const leftWidth = await getElementWidth(page, 'split-view-left-panel');
    expect(leftWidth).toBe(0);

    const rightWidth = await getElementWidth(page, 'split-view-right-panel');
    expect(rightWidth).toBeGreaterThan(1000);
  });

  test('should snap to left-full when dragged to far right', async ({
    page,
  }) => {
    const divider = page.getByTestId('split-view-divider');
    const box = await divider.boundingBox();
    expect(box).not.toBeNull();

    // Drag divider all the way to the right edge
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(1250, box!.y + box!.height / 2, { steps: 20 });
    await page.mouse.up();

    await page.waitForTimeout(500);

    // Right panel should be collapsed (width 0), left panel fills
    const rightWidth = await getElementWidth(page, 'split-view-right-panel');
    expect(rightWidth).toBe(0);

    const leftWidth = await getElementWidth(page, 'split-view-left-panel');
    expect(leftWidth).toBeGreaterThan(1000);
  });
});
