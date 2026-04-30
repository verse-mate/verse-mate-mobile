#!/usr/bin/env bun
/**
 * extract-design-tokens — diff Lovable design source against theme/tokens.ts
 *
 * br-002: This script is DIFF-ONLY. It MUST NOT write to theme/tokens.ts.
 * The drift report is for a human (or an agent under explicit instruction)
 * to apply manually. Do not add fs.writeFile/writeFileSync calls targeting
 * theme/* — review will reject the change.
 *
 * Usage:
 *   bun run scripts/extract-design-tokens.ts
 *   bun run scripts/extract-design-tokens.ts --source ../verse-mate-web
 *   bun run scripts/extract-design-tokens.ts --json
 *   bun run scripts/extract-design-tokens.ts --help
 *
 * Exit codes:
 *   0 — no drift detected
 *   1 — drift detected (output reports it)
 *   2 — extractor failed (missing source files, parse error)
 *
 * --json schema:
 *   {
 *     colors:     { added: Entry[], changed: ChangeEntry[], removed: Entry[] },
 *     typography: { added: Entry[], changed: ChangeEntry[], removed: Entry[] },
 *     spacing:    { added: Entry[], changed: ChangeEntry[], removed: Entry[] },
 *     radii:      { added: Entry[], changed: ChangeEntry[], removed: Entry[] },
 *     animations: { added: Entry[], changed: ChangeEntry[], removed: Entry[] }
 *   }
 *   Entry        = { key: string, value: string }
 *   ChangeEntry  = { key: string, old: string, new: string }
 *
 * @see Spec: specs/feat-design-system-foundation/spec.md
 * @see Decisions: DEC-007 (diff-only), DEC-014 (AST parse, no module eval)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';

// ============================================================================
// RN_ONLY_SCOPE — categories excluded from the cross-platform design contract
// ============================================================================

/**
 * Categories that exist only in mobile (RN-specific component sizing) and are
 * NOT diffed against Lovable. Designer output never references these.
 */
const RN_ONLY_SCOPE: readonly string[] = [
  'headerSpecs',
  'modalSpecs',
  'tabSpecs',
  'fabSpecs',
  'progressBarSpecs',
  'skeletonSpecs',
  'splitViewSpecs',
  'springConfig',
  'animations', // mobile: a structured map keyed by use-case (modal/tabSwitch/...).
  // animationDurations IS diffed below.
];

// ============================================================================
// Types
// ============================================================================

type Dict = Record<string, string>;
type Category = 'colors' | 'typography' | 'spacing' | 'radii' | 'animations';
type DiffEntry = { key: string; value: string };
type ChangeEntry = { key: string; old: string; new: string };
type CategoryDiff = { added: DiffEntry[]; changed: ChangeEntry[]; removed: DiffEntry[] };
type Diff = Record<Category, CategoryDiff>;

interface CliOptions {
  source: string;
  json: boolean;
  help: boolean;
}

// ============================================================================
// CLI
// ============================================================================

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    source: path.resolve(__dirname, '..', '..', 'verse-mate-web'),
    json: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg === '--json') opts.json = true;
    else if (arg === '--source') {
      const value = argv[++i];
      if (!value) {
        console.error('Error: --source requires a path argument.');
        process.exit(2);
      }
      opts.source = path.resolve(value);
    } else {
      console.error(`Error: unknown argument "${arg}". Run with --help.`);
      process.exit(2);
    }
  }
  return opts;
}

function printHelp() {
  const help = `extract-design-tokens — diff Lovable design source against theme/tokens.ts

USAGE
  bun run scripts/extract-design-tokens.ts [options]

OPTIONS
  --source <path>   Path to the design source repo (default: ../verse-mate-web)
  --json            Emit machine-readable JSON (schema in script header)
  --help, -h        Print this help

EXIT CODES
  0   No drift detected
  1   Drift detected (output reports it)
  2   Extractor failed (missing source files, parse error)

INVARIANT
  br-002: this script is diff-only. It NEVER writes to theme/tokens.ts.
  When drift exists, a human reviews the report and applies changes manually.

RN_ONLY_SCOPE (excluded from diff — mobile-only categories)
  ${RN_ONLY_SCOPE.join(', ')}

EXAMPLES
  bun run scripts/extract-design-tokens.ts
  bun run scripts/extract-design-tokens.ts --source ~/work/lovable-export
  bun run scripts/extract-design-tokens.ts --json | jq '.colors.changed'
`;
  process.stdout.write(help);
}

// ============================================================================
// Lovable: parse tailwind.config.ts via AST (DEC-014 — never evaluate)
// ============================================================================

/**
 * Walks `theme.extend.<key>` literal expressions from tailwind.config.ts.
 * Returns a flat dictionary of dotted-path strings → literal value strings.
 *
 * Examples produced:
 *   colors.background      = "hsl(var(--background))"
 *   colors.primary.DEFAULT = "hsl(var(--primary))"
 *   borderRadius.lg        = "var(--radius)"
 *   fontFamily.sans        = "Inter,system-ui,sans-serif"
 *
 * Skips non-literal expressions (call expressions, identifiers, etc.) — those
 * are not relevant to color/spacing/radius drift.
 */
function parseTailwindConfig(filePath: string): Record<string, Dict> {
  const source = fs.readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true);

  const result: Record<string, Dict> = {};

  // Find: export default { ... } satisfies Config | export default { ... }
  function findDefaultExport(node: ts.Node): ts.ObjectLiteralExpression | undefined {
    if (ts.isExportAssignment(node)) {
      let expr = node.expression;
      // unwrap "satisfies" / "as" wrappers
      while (
        ts.isAsExpression(expr) ||
        ts.isSatisfiesExpression(expr) ||
        ts.isParenthesizedExpression(expr)
      ) {
        expr = (expr as { expression: ts.Expression }).expression;
      }
      if (ts.isObjectLiteralExpression(expr)) return expr;
    }
    let found: ts.ObjectLiteralExpression | undefined;
    ts.forEachChild(node, (child) => {
      if (!found) found = findDefaultExport(child);
    });
    return found;
  }

  const root = findDefaultExport(sourceFile);
  if (!root) return result;

  // Walk to theme.extend
  const themeProp = root.properties.find(
    (p) => ts.isPropertyAssignment(p) && getPropertyName(p.name) === 'theme'
  ) as ts.PropertyAssignment | undefined;
  if (!themeProp || !ts.isObjectLiteralExpression(themeProp.initializer)) return result;

  const extendProp = themeProp.initializer.properties.find(
    (p) => ts.isPropertyAssignment(p) && getPropertyName(p.name) === 'extend'
  ) as ts.PropertyAssignment | undefined;
  if (!extendProp || !ts.isObjectLiteralExpression(extendProp.initializer)) return result;

  // For each top-level key under extend (colors, fontFamily, fontSize, spacing, borderRadius, animation)
  for (const prop of extendProp.initializer.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    const groupName = getPropertyName(prop.name);
    if (!groupName) continue;
    const flat: Dict = {};
    flattenLiterals(prop.initializer, flat, '');
    if (Object.keys(flat).length > 0) result[groupName] = flat;
  }

  return result;
}

function getPropertyName(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  return undefined;
}

function flattenLiterals(node: ts.Node, out: Dict, prefix: string): void {
  if (ts.isObjectLiteralExpression(node)) {
    for (const prop of node.properties) {
      if (!ts.isPropertyAssignment(prop)) continue;
      const key = getPropertyName(prop.name);
      if (!key) continue;
      const newPrefix = prefix ? `${prefix}.${key}` : key;
      flattenLiterals(prop.initializer, out, newPrefix);
    }
    return;
  }
  if (ts.isArrayLiteralExpression(node)) {
    // Tailwind fontFamily allows arrays of family names — flatten to comma-joined
    const items: string[] = [];
    for (const el of node.elements) {
      if (ts.isStringLiteral(el)) items.push(el.text);
    }
    if (items.length > 0 && prefix) out[prefix] = items.join(',');
    return;
  }
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    if (prefix) out[prefix] = node.text;
    return;
  }
  // Numeric literal (e.g., spacing values) — coerce to string
  if (ts.isNumericLiteral(node)) {
    if (prefix) out[prefix] = node.text;
    return;
  }
  // Skip non-literal expressions (CallExpression, Identifier, etc.) silently
}

// ============================================================================
// Lovable: parse src/index.css for CSS custom properties
// ============================================================================

/**
 * Extracts every `--name: value;` occurrence in the file. Returns the LAST
 * value seen for a given name (matching CSS cascade semantics for the file).
 *
 * Handles:
 *   --vm-night: #000;
 *   --background: 39 43% 95%;          (HSL triplet)
 *   --hl-yellow: rgb(255 235 59 / 30%);
 *   --primary-foreground: hsl(var(--something));   (kept as-is)
 */
function parseCssVars(filePath: string): Dict {
  const source = fs.readFileSync(filePath, 'utf-8');
  const out: Dict = {};
  // Match --name: value;  Value is everything up to the next semicolon, ignoring
  // comments and whitespace. We use a simple regex — full CSS parsing is overkill.
  const re = /--([a-zA-Z0-9_-]+)\s*:\s*([^;]+);/g;
  for (const match of source.matchAll(re)) {
    const name = match[1];
    const value = match[2].trim();
    out[name] = value;
  }
  return out;
}

// ============================================================================
// Resolve shadcn `hsl(var(--token))` indirection
// ============================================================================

/**
 * If `expr` looks like `hsl(var(--token))` or `var(--token)`, replace the
 * inner var reference with the resolved CSS variable value. Returns expr
 * unchanged if no var() reference is found, or if the referenced var is
 * not in `cssVars` (in which case the original expression is preserved so
 * the diff shows the unresolved form rather than a misleading match).
 */
function resolveShadcn(expr: string, cssVars: Dict): string {
  return expr.replace(/var\(\s*--([a-zA-Z0-9_-]+)\s*\)/g, (full, varName) => {
    const resolved = cssVars[varName];
    return resolved !== undefined ? resolved : full;
  });
}

// ============================================================================
// Mobile: load theme/tokens.ts via dynamic import (allowed — pure TS, no
// React imports per feat-rename AC; resolves cleanly under Bun)
// ============================================================================

interface MobileTokens {
  colors: Dict; // light palette flattened
  fontSizes: Dict;
  spacing: Dict;
  radii: Dict;
  animationDurations: Dict;
}

async function loadMobileTokens(modulePath: string): Promise<MobileTokens> {
  const mod = await import(modulePath);
  if (!mod.colors?.light) throw new Error(`theme/tokens missing colors.light export`);
  return {
    colors: dictFromObj(mod.colors.light),
    fontSizes: dictFromObj(mod.fontSizes ?? {}),
    spacing: dictFromObj(mod.spacing ?? {}),
    radii: dictFromObj(mod.radii ?? {}),
    animationDurations: dictFromObj(mod.animationDurations ?? {}),
  };
}

function dictFromObj(obj: Record<string, unknown>): Dict {
  const out: Dict = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string' || typeof v === 'number') out[k] = String(v);
  }
  return out;
}

// ============================================================================
// Diff
// ============================================================================

function diffDict(lovable: Dict, mobile: Dict): CategoryDiff {
  const out: CategoryDiff = { added: [], changed: [], removed: [] };
  for (const [key, value] of Object.entries(lovable)) {
    if (!(key in mobile)) out.added.push({ key, value });
    else if (mobile[key] !== value) out.changed.push({ key, old: mobile[key], new: value });
  }
  for (const [key, value] of Object.entries(mobile)) {
    if (!(key in lovable)) out.removed.push({ key, value });
  }
  out.added.sort((a, b) => a.key.localeCompare(b.key));
  out.changed.sort((a, b) => a.key.localeCompare(b.key));
  out.removed.sort((a, b) => a.key.localeCompare(b.key));
  return out;
}

// ============================================================================
// Extract & build per-category dictionaries from Lovable
// ============================================================================

interface LovableTokens {
  colors: Dict;
  typography: Dict; // fontSize values
  spacing: Dict;
  radii: Dict;
  animations: Dict;
}

function buildLovableTokens(twConfig: Record<string, Dict>, cssVars: Dict): LovableTokens {
  const resolveAll = (d: Dict | undefined): Dict => {
    if (!d) return {};
    const out: Dict = {};
    for (const [k, v] of Object.entries(d)) out[k] = resolveShadcn(v, cssVars);
    return out;
  };
  return {
    colors: resolveAll(twConfig.colors),
    typography: resolveAll(twConfig.fontSize),
    spacing: resolveAll(twConfig.spacing),
    radii: resolveAll(twConfig.borderRadius),
    animations: resolveAll(twConfig.animation),
  };
}

// ============================================================================
// Output formatting
// ============================================================================

function hasDrift(diff: Diff): boolean {
  for (const cat of Object.values(diff)) {
    if (cat.added.length || cat.changed.length || cat.removed.length) return true;
  }
  return false;
}

function formatText(diff: Diff): string {
  if (!hasDrift(diff)) return 'No drift detected.\n';
  const lines: string[] = ['Token drift detected:', ''];
  for (const cat of ['colors', 'typography', 'spacing', 'radii', 'animations'] as Category[]) {
    const c = diff[cat];
    const total = c.added.length + c.changed.length + c.removed.length;
    if (total === 0) continue;
    lines.push(`${cat} (${total}):`);
    for (const e of c.added) lines.push(`  + ${cat}.${e.key} = ${e.value}`);
    for (const e of c.changed) lines.push(`  ~ ${cat}.${e.key}: ${e.old} → ${e.new}`);
    for (const e of c.removed) lines.push(`  - ${cat}.${e.key} (was ${e.value})`);
    lines.push('');
  }
  return lines.join('\n');
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    process.exit(0);
  }

  const tailwindPath = path.join(opts.source, 'tailwind.config.ts');
  const cssPath = path.join(opts.source, 'src', 'index.css');

  if (!fs.existsSync(tailwindPath)) {
    console.error(`Error: ${tailwindPath} not found. Use --source to point at a different repo.`);
    process.exit(2);
  }
  if (!fs.existsSync(cssPath)) {
    console.error(`Error: ${cssPath} not found.`);
    process.exit(2);
  }

  let twConfig: Record<string, Dict>;
  let cssVars: Dict;
  let mobile: MobileTokens;
  try {
    twConfig = parseTailwindConfig(tailwindPath);
    cssVars = parseCssVars(cssPath);
    const tokensPath = path.resolve(__dirname, '..', 'theme', 'tokens.ts');
    mobile = await loadMobileTokens(tokensPath);
  } catch (err) {
    console.error(`Error parsing source: ${(err as Error).message}`);
    process.exit(2);
  }

  const lovable = buildLovableTokens(twConfig, cssVars);

  const diff: Diff = {
    colors: diffDict(lovable.colors, mobile.colors),
    typography: diffDict(lovable.typography, mobile.fontSizes),
    spacing: diffDict(lovable.spacing, mobile.spacing),
    radii: diffDict(lovable.radii, mobile.radii),
    animations: diffDict(lovable.animations, mobile.animationDurations),
  };

  // Note: RN_ONLY_SCOPE categories are not even queried — they're absent from
  // both `lovable.*` (Lovable doesn't have them) and the chosen mobile keys
  // (loadMobileTokens never reads them). RN_ONLY_SCOPE is documented in --help
  // and exists in the file as a contract; the runtime simply doesn't sample
  // those categories.

  if (opts.json) {
    process.stdout.write(`${JSON.stringify(diff, null, 2)}\n`);
  } else {
    process.stdout.write(formatText(diff));
  }
  process.exit(hasDrift(diff) ? 1 : 0);
}

main().catch((err) => {
  console.error(`Unhandled error: ${(err as Error).stack ?? err}`);
  process.exit(2);
});
