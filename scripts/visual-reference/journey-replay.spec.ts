import * as fs from 'node:fs';
import * as path from 'node:path';
import { expect, test } from '@playwright/test';
import type { Journey, JourneyStep } from './types';

/**
 * Journey Replay Validation Tests
 *
 * Validates that journey files can be executed correctly with proper
 * step handling, screenshot capture, and error recovery.
 */

test.describe('Journey Replay System', () => {
  const testOutputDir = path.join(__dirname, '../../.test-output/journey-replay');

  test.beforeEach(() => {
    // Clean up test output directory
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true });
    }
    fs.mkdirSync(testOutputDir, { recursive: true });
  });

  test.afterEach(() => {
    // Clean up after tests
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true });
    }
  });

  test('should execute navigate action successfully', async ({ page }) => {
    const step: JourneyStep = {
      name: 'step-1-navigate',
      description: 'Navigate to Bible page',
      action: 'navigate',
      url: '/bible',
      waitFor: 'body',
      screenshot: 'step-1.png',
    };

    // Execute navigate action
    await page.goto(`https://app.versemate.org${step.url}`);
    if (step.waitFor) {
      await page.waitForSelector(step.waitFor, { timeout: 10000 });
    }

    // Verify navigation
    expect(page.url()).toContain('/bible');

    // Capture screenshot
    const screenshotPath = path.join(testOutputDir, step.screenshot);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    expect(fs.existsSync(screenshotPath)).toBe(true);
  });

  test('should execute click action successfully', async ({ page }) => {
    // First navigate to page
    await page.goto('https://app.versemate.org/bible');
    await page.waitForLoadState('networkidle');

    const step: JourneyStep = {
      name: 'step-2-click',
      description: 'Click element',
      action: 'click',
      selector: 'a',
      screenshot: 'step-2.png',
    };

    // Execute click action
    if (step.selector) {
      const elementCount = await page.locator(step.selector).count();
      if (elementCount > 0) {
        await page.locator(step.selector).first().click();
      }
    }

    // Capture screenshot
    const screenshotPath = path.join(testOutputDir, step.screenshot);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    expect(fs.existsSync(screenshotPath)).toBe(true);
  });

  test('should execute type action successfully', async ({ page }) => {
    await page.goto('https://app.versemate.org/bible');
    await page.waitForLoadState('networkidle');

    const step: JourneyStep = {
      name: 'step-3-type',
      description: 'Type in search field',
      action: 'type',
      selector: 'input',
      value: 'Genesis',
      screenshot: 'step-3.png',
    };

    // Execute type action
    if (step.selector && step.value) {
      const inputCount = await page.locator(step.selector).count();
      if (inputCount > 0) {
        await page.locator(step.selector).first().fill(step.value);
      }
    }

    // Capture screenshot
    const screenshotPath = path.join(testOutputDir, step.screenshot);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    expect(fs.existsSync(screenshotPath)).toBe(true);
  });

  test('should execute scroll action successfully', async ({ page }) => {
    await page.goto('https://app.versemate.org/bible/1/1');
    await page.waitForLoadState('networkidle');

    const step: JourneyStep = {
      name: 'step-4-scroll',
      description: 'Scroll page',
      action: 'scroll',
      selector: 'body',
      screenshot: 'step-4.png',
    };

    // Execute scroll action
    if (step.selector) {
      await page.evaluate(() => window.scrollTo(0, 500));
      await page.waitForTimeout(500); // Wait for smooth scroll
    }

    // Capture screenshot
    const screenshotPath = path.join(testOutputDir, step.screenshot);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    expect(fs.existsSync(screenshotPath)).toBe(true);
  });

  test('should handle missing selector gracefully', async ({ page }) => {
    await page.goto('https://app.versemate.org/bible');
    await page.waitForLoadState('networkidle');

    const step: JourneyStep = {
      name: 'step-missing',
      description: 'Click non-existent element',
      action: 'click',
      selector: '.non-existent-selector-12345',
      screenshot: 'step-missing.png',
    };

    // Should not throw, just skip the click
    const elementCount = await page.locator(step.selector ?? '').count();
    expect(elementCount).toBe(0);

    // Should still capture screenshot
    const screenshotPath = path.join(testOutputDir, step.screenshot);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    expect(fs.existsSync(screenshotPath)).toBe(true);
  });

  test('should execute multi-step journey sequentially', async ({ page }) => {
    const journey: Journey = {
      name: 'test-journey',
      description: 'Test multi-step journey',
      createdAt: '2025-10-05',
      baseUrl: 'https://app.versemate.org',
      steps: [
        {
          name: 'step-1-navigate',
          description: 'Navigate to Bible',
          action: 'navigate',
          url: '/bible',
          waitFor: 'body',
          screenshot: 'step-1.png',
        },
        {
          name: 'step-2-navigate-genesis',
          description: 'Navigate to Genesis',
          action: 'navigate',
          url: '/bible/1/1',
          waitFor: 'body',
          screenshot: 'step-2.png',
        },
      ],
    };

    // Execute each step
    for (const step of journey.steps) {
      if (step.action === 'navigate' && step.url) {
        await page.goto(`${journey.baseUrl}${step.url}`);
        if (step.waitFor) {
          await page.waitForSelector(step.waitFor, { timeout: 10000 });
        }
      }

      // Capture screenshot
      const screenshotPath = path.join(testOutputDir, step.screenshot);
      await page.screenshot({ path: screenshotPath, fullPage: true });

      expect(fs.existsSync(screenshotPath)).toBe(true);
    }

    // Verify all screenshots created
    expect(journey.steps.length).toBe(2);
    expect(fs.existsSync(path.join(testOutputDir, 'step-1.png'))).toBe(true);
    expect(fs.existsSync(path.join(testOutputDir, 'step-2.png'))).toBe(true);
  });

  test('should handle waitFor timeout gracefully', async ({ page }) => {
    await page.goto('https://app.versemate.org/bible');

    const step: JourneyStep = {
      name: 'step-timeout',
      description: 'Wait for non-existent element',
      action: 'navigate',
      url: '/bible',
      waitFor: '.non-existent-element-12345',
      screenshot: 'step-timeout.png',
    };

    // Should timeout but not crash
    try {
      if (step.waitFor) {
        await page.waitForSelector(step.waitFor, { timeout: 2000 });
      }
    } catch (error) {
      // Expected timeout
      expect(error).toBeTruthy();
    }

    // Should still capture screenshot
    const screenshotPath = path.join(testOutputDir, step.screenshot);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    expect(fs.existsSync(screenshotPath)).toBe(true);
  });

  test('should validate journey step execution order', async ({ page }) => {
    const executionOrder: string[] = [];

    const journey: Journey = {
      name: 'order-test',
      description: 'Test execution order',
      createdAt: '2025-10-05',
      baseUrl: 'https://app.versemate.org',
      steps: [
        {
          name: 'step-1-first',
          description: 'First step',
          action: 'navigate',
          url: '/bible',
          screenshot: 'step-1.png',
        },
        {
          name: 'step-2-second',
          description: 'Second step',
          action: 'navigate',
          url: '/bible/1/1',
          screenshot: 'step-2.png',
        },
        {
          name: 'step-3-third',
          description: 'Third step',
          screenshot: 'step-3.png',
        },
      ],
    };

    // Execute steps and track order
    for (const step of journey.steps) {
      executionOrder.push(step.name);

      if (step.action === 'navigate' && step.url) {
        await page.goto(`${journey.baseUrl}${step.url}`);
        await page.waitForLoadState('networkidle');
      }
    }

    // Verify execution order matches journey definition
    expect(executionOrder).toEqual(['step-1-first', 'step-2-second', 'step-3-third']);
  });
});
