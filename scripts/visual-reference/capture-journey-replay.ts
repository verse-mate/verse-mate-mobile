#!/usr/bin/env bun
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Page } from '@playwright/test';
import { chromium } from '@playwright/test';
import type { Journey, JourneyStep } from './types';
import { extractPageMetadata } from './utils/extract-metadata';
import { generateJourneyReference } from './utils/generate-journey';
import { generateReferenceMarkdown, saveMetadataJSON } from './utils/generate-reference';
import { captureAllViewports } from './utils/screenshot-capture';

/**
 * Journey Replay and Capture Script
 *
 * Replays a journey definition file and captures screenshots and metadata
 * for each step across all viewports.
 *
 * Usage:
 *   bun run capture:journey -- --journey=bible-reading-flow
 */

interface ReplayOptions {
  journey: string;
  outputDir?: string;
}

/**
 * Parse command line arguments
 */
function parseArgs(): ReplayOptions {
  const args = process.argv.slice(2);
  const options: ReplayOptions = {
    journey: '',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith('--journey=')) {
      options.journey = arg.split('=')[1];
    } else if (arg === '--journey') {
      options.journey = args[++i];
    } else if (arg.startsWith('--output=')) {
      options.outputDir = arg.split('=')[1];
    } else if (arg === '--output') {
      options.outputDir = args[++i];
    }
  }

  return options;
}

/**
 * Execute a single journey step
 */
async function executeStep(page: Page, step: JourneyStep, baseUrl: string): Promise<void> {
  console.log(`  Executing: ${step.name} - ${step.description}`);

  try {
    // Execute action
    switch (step.action) {
      case 'navigate':
        if (step.url) {
          await page.goto(`${baseUrl}${step.url}`);
          console.log(`    ✓ Navigated to ${step.url}`);
        }
        break;

      case 'click':
        if (step.selector) {
          const elementCount = await page.locator(step.selector).count();
          if (elementCount > 0) {
            await page.locator(step.selector).first().click();
            console.log(`    ✓ Clicked ${step.selector}`);
          } else {
            console.log(`    ⚠ Selector not found: ${step.selector}`);
          }
        }
        break;

      case 'type':
        if (step.selector && step.value) {
          const elementCount = await page.locator(step.selector).count();
          if (elementCount > 0) {
            await page.locator(step.selector).first().fill(step.value);
            console.log(`    ✓ Typed "${step.value}" into ${step.selector}`);
          } else {
            console.log(`    ⚠ Selector not found: ${step.selector}`);
          }
        }
        break;

      case 'scroll':
        await page.evaluate(() => window.scrollTo(0, 500));
        await page.waitForTimeout(500);
        console.log(`    ✓ Scrolled page`);
        break;
    }

    // Wait for element if specified
    if (step.waitFor) {
      try {
        await page.waitForSelector(step.waitFor, { timeout: 10000 });
        console.log(`    ✓ Waited for ${step.waitFor}`);
      } catch (error) {
        console.log(`    ⚠ Timeout waiting for ${step.waitFor}`);
      }
    }

    // Small delay for UI stability
    await page.waitForTimeout(500);
  } catch (error) {
    console.error(`    ✗ Error executing step: ${error}`);
    throw error;
  }
}

/**
 * Capture step screenshots and metadata
 */
async function captureStep(page: Page, step: JourneyStep, outputDir: string): Promise<void> {
  console.log(`  Capturing screenshots for ${step.name}...`);

  const stepDir = path.join(outputDir, 'screenshots');
  fs.mkdirSync(stepDir, { recursive: true });

  // Capture all viewports for this step (page already navigated)
  const result = await captureAllViewports(page, stepDir, step.name);

  if (result.success) {
    console.log(`    ✓ Captured ${result.screenshots.length} viewports`);
  } else {
    console.error(`    ✗ Failed to capture screenshots: ${result.error}`);
  }
}

/**
 * Replay journey and capture screenshots
 */
async function replayJourney(journey: Journey, outputDir: string): Promise<void> {
  console.log(`\nReplaying journey: ${journey.name}`);
  console.log(`Description: ${journey.description}`);
  console.log(`Steps: ${journey.steps.length}\n`);

  const browser = await chromium.launch({ headless: true });

  try {
    // Create context with desktop viewport for execution
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
    });
    const page = await context.newPage();

    // Execute each step
    for (let i = 0; i < journey.steps.length; i++) {
      const step = journey.steps[i];
      console.log(`\nStep ${i + 1}/${journey.steps.length}:`);

      // Execute the step
      await executeStep(page, step, journey.baseUrl);

      // Capture screenshots for this step (using the same page)
      await captureStep(page, step, outputDir);

      // Extract metadata for first and last steps
      if (i === 0 || i === journey.steps.length - 1) {
        console.log(`  Extracting metadata...`);
        const currentUrl = page.url();
        const metadata = await extractPageMetadata(page, currentUrl);
        const metadataDir = path.join(outputDir, 'metadata', step.name);
        fs.mkdirSync(metadataDir, { recursive: true });
        saveMetadataJSON(metadata, metadataDir);
        console.log(`    ✓ Metadata saved`);
      }
    }

    await context.close();
  } finally {
    await browser.close();
  }

  // Generate journey reference markdown
  console.log('\nGenerating journey reference...');
  generateJourneyReference(journey, outputDir);
  console.log('  ✓ Journey reference generated');

  console.log(`\n✓ Journey replay complete!`);
  console.log(`  Output: ${outputDir}`);
}

/**
 * Load journey definition file
 */
async function loadJourney(journeyName: string): Promise<Journey> {
  const journeyPath = path.join(
    process.cwd(),
    '.agent-os/references/journeys',
    journeyName,
    `${journeyName}.ts`
  );

  if (!fs.existsSync(journeyPath)) {
    throw new Error(`Journey file not found: ${journeyPath}`);
  }

  console.log(`Loading journey from: ${journeyPath}`);

  // Import the journey file
  const journeyModule = await import(journeyPath);

  // Find the exported journey (could be any export name)
  const journey = Object.values(journeyModule).find(
    (exp): exp is Journey =>
      typeof exp === 'object' && exp !== null && 'name' in exp && 'steps' in exp
  );

  if (!journey) {
    throw new Error(`No journey definition found in ${journeyPath}`);
  }

  return journey;
}

/**
 * Main execution
 */
async function main() {
  try {
    const options = parseArgs();

    if (!options.journey) {
      console.error('Error: --journey parameter is required');
      console.log('\nUsage:');
      console.log('  bun run capture:journey -- --journey=bible-reading-flow');
      console.log(
        '  bun run capture:journey -- --journey=bible-reading-flow --output=./custom-output'
      );
      process.exit(1);
    }

    // Load journey definition
    const journey = await loadJourney(options.journey);

    // Set output directory
    const outputDir =
      options.outputDir ||
      path.join(process.cwd(), '.agent-os/references/journeys', options.journey);

    // Create output directory
    fs.mkdirSync(outputDir, { recursive: true });

    // Replay journey
    await replayJourney(journey, outputDir);
  } catch (error) {
    console.error(`\n✗ Error: ${error}`);
    process.exit(1);
  }
}

main();
