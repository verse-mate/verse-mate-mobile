import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Journey } from '../types';

/**
 * Journey File Generator
 *
 * Generates TypeScript journey definition files from journey data.
 */

/**
 * Generate journey TypeScript file
 */
export function generateJourneyFile(journey: Journey, outputPath: string): void {
  const content = buildJourneyFileContent(journey);
  fs.writeFileSync(outputPath, content, 'utf-8');
}

/**
 * Build journey file content
 */
function buildJourneyFileContent(journey: Journey): string {
  const lines: string[] = [];

  // Import statement
  lines.push("import type { Journey } from '../../visual-reference/types';");
  lines.push('');

  // Journey export
  const varName = toCamelCase(journey.name);
  lines.push(`export const ${varName}: Journey = {`);
  lines.push(`  name: '${journey.name}',`);
  lines.push(`  description: '${escapeString(journey.description)}',`);
  lines.push(`  createdAt: '${journey.createdAt}',`);
  lines.push(`  baseUrl: '${journey.baseUrl}',`);
  lines.push('  steps: [');

  // Steps
  for (let i = 0; i < journey.steps.length; i++) {
    const step = journey.steps[i];
    const isLast = i === journey.steps.length - 1;

    lines.push('    {');
    lines.push(`      name: '${step.name}',`);
    lines.push(`      description: '${escapeString(step.description)}',`);

    if (step.action) {
      lines.push(`      action: '${step.action}',`);
    }
    if (step.url) {
      lines.push(`      url: '${step.url}',`);
    }
    if (step.selector) {
      lines.push(`      selector: '${escapeString(step.selector)}',`);
    }
    if (step.value) {
      lines.push(`      value: '${escapeString(step.value)}',`);
    }
    if (step.waitFor) {
      lines.push(`      waitFor: '${escapeString(step.waitFor)}',`);
    }
    lines.push(`      screenshot: '${step.screenshot}',`);

    lines.push(isLast ? '    }' : '    },');
  }

  lines.push('  ],');
  lines.push('};');
  lines.push('');

  return lines.join('\n');
}

/**
 * Convert kebab-case to camelCase
 */
function toCamelCase(str: string): string {
  return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Escape string for TypeScript
 */
function escapeString(str: string): string {
  return str.replace(/'/g, "\\'").replace(/\n/g, '\\n');
}

/**
 * Create journey directory structure
 */
export function createJourneyDirectory(
  journeyName: string,
  baseDir: string = '.agent-os/references/journeys'
): string {
  const journeyDir = path.join(baseDir, journeyName);
  const screenshotsDir = path.join(journeyDir, 'screenshots');

  fs.mkdirSync(journeyDir, { recursive: true });
  fs.mkdirSync(screenshotsDir, { recursive: true });

  return journeyDir;
}

/**
 * Generate journey reference markdown
 */
export function generateJourneyReference(journey: Journey, outputDir: string): void {
  const lines: string[] = [];

  lines.push(`# Journey: ${formatName(journey.name)}`);
  lines.push('');
  lines.push(`> Created: ${journey.createdAt}`);
  lines.push(`> Base URL: ${journey.baseUrl}`);
  lines.push('');
  lines.push(`## Description`);
  lines.push('');
  lines.push(journey.description);
  lines.push('');
  lines.push(`## Steps`);
  lines.push('');

  for (let i = 0; i < journey.steps.length; i++) {
    const step = journey.steps[i];
    const stepNum = i + 1;

    lines.push(`### Step ${stepNum}: ${step.description}`);
    lines.push('');

    if (step.action) {
      lines.push(`**Action**: ${step.action}`);
      lines.push('');
    }

    if (step.url) {
      lines.push(`**URL**: ${step.url}`);
      lines.push('');
    }

    if (step.selector) {
      lines.push(`**Selector**: \`${step.selector}\``);
      lines.push('');
    }

    if (step.value) {
      lines.push(`**Value**: ${step.value}`);
      lines.push('');
    }

    if (step.waitFor) {
      lines.push(`**Wait For**: \`${step.waitFor}\``);
      lines.push('');
    }

    lines.push(`**Screenshot**: ![${step.name}](./screenshots/${step.screenshot})`);
    lines.push('');
  }

  const referencePath = path.join(outputDir, 'reference.md');
  fs.writeFileSync(referencePath, lines.join('\n'), 'utf-8');
}

/**
 * Format journey name for display
 */
function formatName(name: string): string {
  return name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
