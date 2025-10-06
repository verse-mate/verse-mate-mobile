import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ComputedStyles, DesignToken, HTMLStructure, PageMetadata } from '../types';
import { rgbToHex } from './extract-metadata';

/**
 * Reference Documentation Generator
 *
 * Generates markdown documentation and JSON files from captured metadata.
 */

/**
 * Generate complete reference documentation
 */
export async function generateReferenceMarkdown(
  metadata: PageMetadata,
  screenshotPaths: { viewport: string; path: string }[],
  outputDir: string,
  name: string
): Promise<void> {
  const markdown = buildReferenceMarkdown(metadata, screenshotPaths, name);
  const markdownPath = path.join(outputDir, 'reference.md');

  fs.writeFileSync(markdownPath, markdown, 'utf-8');
}

/**
 * Build reference markdown content
 */
function buildReferenceMarkdown(
  metadata: PageMetadata,
  screenshotPaths: { viewport: string; path: string }[],
  name: string
): string {
  const sections: string[] = [];

  // Header
  sections.push(`# Visual Reference: ${formatName(name)}`);
  sections.push('');
  sections.push(`> Captured: ${new Date(metadata.capturedAt).toLocaleString()}`);
  sections.push(`> Source: ${metadata.url}`);
  sections.push('');

  // Screenshots
  sections.push('## Screenshots');
  sections.push('');

  for (const screenshot of screenshotPaths) {
    const relativePath = `./screenshots/${path.basename(screenshot.path)}`;
    sections.push(`### ${capitalize(screenshot.viewport)}`);
    sections.push(`![${capitalize(screenshot.viewport)} view](${relativePath})`);
    sections.push('');
  }

  // Design Tokens
  if (metadata.designTokens.length > 0) {
    sections.push('## Design Tokens');
    sections.push('');
    sections.push(generateDesignTokensTable(metadata.designTokens));
    sections.push('');
  }

  // Typography System
  const typographyStyles = metadata.computedStyles.filter((s) =>
    ['body', 'h1', 'h2', 'h3', 'p'].includes(s.selector)
  );

  if (typographyStyles.length > 0) {
    sections.push('## Typography System');
    sections.push('');
    for (const style of typographyStyles) {
      const typo = style.styles.typography;
      sections.push(
        `- **${style.selector}**: ${typo.fontFamily}, ${typo.fontSize}, ${typo.fontWeight}`
      );
    }
    sections.push('');
  }

  // Component Structure
  sections.push('## Component Structure');
  sections.push('');
  sections.push('```');
  sections.push(generateHTMLTree(metadata.htmlStructure));
  sections.push('```');
  sections.push('');

  // Key Styles
  sections.push('## Key Styles');
  sections.push('');
  sections.push(generateStylesMarkdown(metadata.computedStyles.slice(0, 5)));
  sections.push('');

  return sections.join('\n');
}

/**
 * Generate design tokens table
 */
function generateDesignTokensTable(tokens: DesignToken[]): string {
  const lines: string[] = [];

  lines.push('| Token | Value | Category |');
  lines.push('|-------|-------|----------|');

  // Group by category and limit to most relevant
  const byCategory = groupByCategory(tokens);

  for (const [category, categoryTokens] of Object.entries(byCategory)) {
    for (const token of categoryTokens.slice(0, 10)) {
      // Limit per category
      const displayValue =
        token.category === 'color' && token.value.startsWith('rgb')
          ? `${token.value} (${rgbToHex(token.value)})`
          : token.value;
      lines.push(`| \`${token.name}\` | ${displayValue} | ${category} |`);
    }
  }

  return lines.join('\n');
}

/**
 * Group tokens by category
 */
function groupByCategory(tokens: DesignToken[]): Record<string, DesignToken[]> {
  const grouped: Record<string, DesignToken[]> = {};

  for (const token of tokens) {
    if (!grouped[token.category]) {
      grouped[token.category] = [];
    }
    grouped[token.category].push(token);
  }

  return grouped;
}

/**
 * Generate HTML structure tree
 */
function generateHTMLTree(structure: HTMLStructure, indent = 0): string {
  const lines: string[] = [];
  const prefix = '  '.repeat(indent);

  // Build element description
  let desc = `${prefix}<${structure.tag}`;
  if (structure.id) desc += ` id="${structure.id}"`;
  if (structure.classes.length > 0) desc += ` class="${structure.classes.join(' ')}"`;
  desc += '>';

  lines.push(desc);

  // Add children
  for (const child of structure.children.slice(0, 10)) {
    // Limit children
    lines.push(generateHTMLTree(child, indent + 1));
  }

  if (structure.children.length > 10) {
    lines.push(`${prefix}  ... (${structure.children.length - 10} more children)`);
  }

  return lines.join('\n');
}

/**
 * Generate styles markdown
 */
function generateStylesMarkdown(styles: ComputedStyles[]): string {
  const lines: string[] = [];

  for (const style of styles) {
    lines.push(`### \`${style.selector}\``);
    lines.push('');
    lines.push('**Typography:**');
    lines.push(`- Font: ${style.styles.typography.fontFamily}`);
    lines.push(`- Size: ${style.styles.typography.fontSize}`);
    lines.push(`- Weight: ${style.styles.typography.fontWeight}`);
    lines.push('');
    lines.push('**Colors:**');
    lines.push(`- Text: ${style.styles.colors.color}`);
    lines.push(`- Background: ${style.styles.colors.backgroundColor}`);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Save metadata as JSON
 */
export async function saveMetadataJSON(metadata: PageMetadata, outputDir: string): Promise<void> {
  const metadataDir = path.join(outputDir, 'metadata');
  fs.mkdirSync(metadataDir, { recursive: true });

  // Save HTML structure
  fs.writeFileSync(
    path.join(metadataDir, 'html-structure.json'),
    JSON.stringify(metadata.htmlStructure, null, 2),
    'utf-8'
  );

  // Save computed styles
  fs.writeFileSync(
    path.join(metadataDir, 'computed-styles.json'),
    JSON.stringify(metadata.computedStyles, null, 2),
    'utf-8'
  );

  // Save design tokens
  fs.writeFileSync(
    path.join(metadataDir, 'design-tokens.json'),
    JSON.stringify(metadata.designTokens, null, 2),
    'utf-8'
  );

  // Save HTML structure as markdown tree
  const htmlTree = generateHTMLTree(metadata.htmlStructure);
  fs.writeFileSync(path.join(metadataDir, 'html-structure.md'), htmlTree, 'utf-8');

  // Save design tokens as markdown table
  const tokensTable = generateDesignTokensTable(metadata.designTokens);
  fs.writeFileSync(path.join(metadataDir, 'design-tokens.md'), tokensTable, 'utf-8');
}

/**
 * Format name for display
 */
function formatName(name: string): string {
  return name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Capitalize string
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
