#!/usr/bin/env node

import * as fs from 'node:fs';
import * as path from 'node:path';
import { chromium } from '@playwright/test';
import { extractPageMetadata } from './utils/extract-metadata';
import { generateReferenceMarkdown, saveMetadataJSON } from './utils/generate-reference';
import { captureAllViewports } from './utils/screenshot-capture';

/**
 * Page Capture Script
 *
 * Captures screenshots and metadata from a single web page.
 *
 * Usage:
 *   bun run scripts/visual-reference/capture-page.ts --url=/bible/1/1 --name=genesis-1
 */

interface CaptureOptions {
  url: string;
  name: string;
  baseUrl?: string;
  outputDir?: string;
}

async function capturePage(options: CaptureOptions): Promise<void> {
  const {
    url,
    name,
    baseUrl = 'https://app.versemate.org',
    outputDir = 'agent-os/references',
  } = options;

  console.log(`📸 Capturing page: ${url}`);
  console.log(`📝 Name: ${name}`);

  // Create output directories
  const captureDir = path.join(outputDir, name);
  const screenshotsDir = path.join(captureDir, 'screenshots');

  fs.mkdirSync(screenshotsDir, { recursive: true });

  // Launch browser
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to page
    const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
    console.log(`🌐 Navigating to ${fullUrl}...`);

    await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 60000 });
    console.log('✅ Page loaded');

    // Capture screenshots for all viewports
    console.log('📷 Capturing screenshots...');
    const result = await captureAllViewports(page, screenshotsDir, name);

    if (!result.success) {
      throw new Error(`Screenshot capture failed: ${result.error}`);
    }

    console.log(`✅ Captured ${result.screenshots.length} screenshots`);

    // Extract metadata
    console.log('🔍 Extracting metadata...');
    const metadata = await extractPageMetadata(page, fullUrl);
    console.log('✅ Metadata extracted');

    // Save metadata as JSON
    console.log('💾 Saving metadata...');
    await saveMetadataJSON(metadata, captureDir);
    console.log('✅ Metadata saved');

    // Generate reference markdown
    console.log('📝 Generating reference documentation...');
    await generateReferenceMarkdown(metadata, result.screenshots, captureDir, name);
    console.log('✅ Reference documentation generated');

    console.log('');
    console.log('✨ Capture complete!');
    console.log('📂 Output directory:', path.resolve(captureDir));
    console.log('');
    console.log('Generated files:');
    console.log(`  - ${result.screenshots.length} screenshots in screenshots/`);
    console.log('  - reference.md (main documentation)');
    console.log('  - metadata/ (JSON and markdown metadata)');
  } catch (error) {
    console.error('❌ Error during capture:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

// Parse command line arguments
function parseArgs(): CaptureOptions {
  const args = process.argv.slice(2);
  const options: Partial<CaptureOptions> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith('--url=')) {
      options.url = arg.split('=')[1];
    } else if (arg === '--url' && i + 1 < args.length) {
      options.url = args[++i];
    } else if (arg.startsWith('--name=')) {
      options.name = arg.split('=')[1];
    } else if (arg === '--name' && i + 1 < args.length) {
      options.name = args[++i];
    } else if (arg.startsWith('--base-url=')) {
      options.baseUrl = arg.split('=')[1];
    } else if (arg === '--base-url' && i + 1 < args.length) {
      options.baseUrl = args[++i];
    } else if (arg.startsWith('--output=')) {
      options.outputDir = arg.split('=')[1];
    } else if (arg === '--output' && i + 1 < args.length) {
      options.outputDir = args[++i];
    }
  }

  // Validate required options
  if (!options.url) {
    console.error('❌ Error: --url is required');
    console.log('');
    console.log('Usage:');
    console.log(
      '  bun run scripts/visual-reference/capture-page.ts --url=/bible/1/1 --name=genesis-1'
    );
    console.log('');
    console.log('Options:');
    console.log('  --url         URL path to capture (required)');
    console.log('  --name        Name for the capture (required)');
    console.log('  --base-url    Base URL (default: https://app.versemate.org)');
    console.log('  --output      Output directory (default: agent-os/references)');
    process.exit(1);
  }

  if (!options.name) {
    console.error('❌ Error: --name is required');
    process.exit(1);
  }

  return options as CaptureOptions;
}

// Main execution
if (require.main === module) {
  const options = parseArgs();
  capturePage(options).catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export { capturePage };
