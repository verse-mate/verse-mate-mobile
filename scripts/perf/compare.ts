#!/usr/bin/env bun
/**
 * Compare perf captures — between arms, and across chapter lengths.
 *
 * ```sh
 * bun scripts/perf/compare.ts --arms psalm-119            # legacy vs native
 * bun scripts/perf/compare.ts --scaling native            # Genesis 1 vs Psalm 119
 * ```
 *
 * ## Why the scaling mode exists
 *
 * The strongest report from the operator was that swiping "depends on the length of
 * the chapter when it really shouldn't". That is a claim about a RATIO, and no
 * single capture can confirm or refute it. This runs the same metrics over a short
 * chapter and a long one and prints how much each grew.
 *
 * A metric whose ratio tracks the verse-count ratio is doing per-verse work at a
 * moment it should not be. That is a much sharper signal than an absolute
 * millisecond number, and it points at a specific piece of code rather than at "the
 * app feels slow".
 */

import { globSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

interface Span {
  name: string;
  count: number;
  totalMs: number;
  meanMs: number;
  maxMs: number;
}
interface Report {
  durationMs: number;
  spans: Span[];
  blocks: { count: number; totalMs: number; maxMs: number; buckets: Record<string, number> };
  counts: { name: string; value: number }[];
}

/** Verse counts, for judging whether a ratio is "per-verse". */
const CHAPTER_VERSES: Record<string, number> = {
  'genesis-1': 31,
  'matthew-5': 48,
  'psalm-119': 176,
};

function loadReport(arm: string, chapter: string): Report | null {
  const dir = join('reports', 'perf', arm, chapter, 'report');
  const files = globSync(join(dir, '*background*.json'));
  if (files.length === 0) return null;
  return JSON.parse(readFileSync(files[0], 'utf8')) as Report;
}

function loadFrames(arm: string, chapter: string): Record<string, string> {
  try {
    const text = readFileSync(join('reports', 'perf', arm, chapter, 'gfxinfo.txt'), 'utf8');
    const grab = (pattern: RegExp): string => text.match(pattern)?.[1] ?? '—';
    return {
      janky: grab(/Janky frames: (\d+ \([\d.]+%\))/),
      p90: grab(/90th percentile: (\d+)ms/),
      p95: grab(/95th percentile: (\d+)ms/),
      p99: grab(/99th percentile: (\d+)ms/),
      vsync: grab(/Number Missed Vsync: (\d+)/),
      slowUi: grab(/Number Slow UI thread: (\d+)/),
      inputLatency: grab(/Number High input latency: (\d+)/),
    };
  } catch {
    return {};
  }
}

function spanMap(report: Report): Map<string, Span> {
  return new Map(report.spans.map((s) => [s.name, s]));
}

function countOf(report: Report, name: string): number | null {
  return report.counts.find((c) => c.name === name)?.value ?? null;
}

function pct(from: number, to: number): string {
  if (!from) return '—';
  const change = (to / from - 1) * 100;
  return `${change >= 0 ? '+' : ''}${change.toFixed(0)}%`;
}

function row(label: string, a: number | null, b: number | null, decimals = 0): string {
  const fmt = (v: number | null) => (v == null ? '—' : v.toFixed(decimals));
  const change = a != null && b != null ? pct(a, b) : '—';
  return `  ${label.padEnd(32)}${fmt(a).padStart(12)}${fmt(b).padStart(12)}${change.padStart(10)}`;
}

function compareArms(chapter: string): void {
  const legacy = loadReport('legacy', chapter);
  const native = loadReport('native', chapter);
  if (!legacy || !native) {
    console.error(`Need both arms captured for ${chapter}. Run:
  scripts/perf/capture-baseline.sh ${chapter} --arm legacy
  scripts/perf/capture-baseline.sh ${chapter} --arm native`);
    process.exit(1);
  }

  const sl = spanMap(legacy);
  const sn = spanMap(native);
  console.log(`\n=== ${chapter}: legacy vs native ===`);
  console.log(
    `  ${'metric'.padEnd(32)}${'legacy'.padStart(12)}${'native'.padStart(12)}${'change'.padStart(10)}`
  );
  console.log(row('window (s)', legacy.durationMs / 1000, native.durationMs / 1000, 1));
  console.log(row('JS blocked (%)', pctOf(legacy), pctOf(native), 1));
  console.log(row('blocks', legacy.blocks.count, native.blocks.count));
  console.log(row('severe blocks', legacy.blocks.buckets.severe, native.blocks.buckets.severe));
  console.log(row('textNodes', countOf(legacy, 'textNodes'), countOf(native, 'textNodes')));
  for (const name of allSpanNames(sl, sn)) {
    console.log(row(`${name} mean`, sl.get(name)?.meanMs ?? null, sn.get(name)?.meanMs ?? null, 1));
  }

  const fl = loadFrames('legacy', chapter);
  const fn = loadFrames('native', chapter);
  if (Object.keys(fl).length && Object.keys(fn).length) {
    console.log('\n  UI THREAD (what stutter actually is)');
    for (const key of Object.keys(fl)) {
      console.log(
        `  ${key.padEnd(32)}${String(fl[key]).padStart(12)}${String(fn[key]).padStart(12)}`
      );
    }
  }
}

/**
 * Compare a short chapter against a long one, within one arm.
 *
 * The verse ratio is printed alongside so a metric growing in step with it is
 * obvious. Anything at or near the verse ratio is doing per-verse work; anything
 * near 1.0x is correctly independent of chapter length.
 */
function compareScaling(arm: string, short = 'genesis-1', long = 'psalm-119'): void {
  const a = loadReport(arm, short);
  const b = loadReport(arm, long);
  if (!a || !b) {
    console.error(`Need both chapters captured for arm '${arm}'. Run:
  scripts/perf/capture-baseline.sh ${short} --arm ${arm}
  scripts/perf/capture-baseline.sh ${long} --arm ${arm}`);
    process.exit(1);
  }

  const verseRatio = CHAPTER_VERSES[long] / CHAPTER_VERSES[short];
  console.log(`\n=== ${arm}: does cost scale with chapter length? ===`);
  console.log(
    `  ${short} = ${CHAPTER_VERSES[short]} verses, ${long} = ${CHAPTER_VERSES[long]} verses`
  );
  console.log(
    `  verse ratio = ${verseRatio.toFixed(1)}x  <-- a metric near this is doing per-verse work`
  );
  console.log(
    `\n  ${'metric'.padEnd(32)}${short.padStart(12)}${long.padStart(12)}${'ratio'.padStart(10)}`
  );

  const sa = spanMap(a);
  const sb = spanMap(b);
  const ratio = (x: number | null, y: number | null) => (x && y ? `${(y / x).toFixed(1)}x` : '—');

  const lines: [string, number | null, number | null][] = [
    ['JS blocked (%)', pctOf(a), pctOf(b)],
    ['blocks', a.blocks.count, b.blocks.count],
    ['severe blocks', a.blocks.buckets.severe, b.blocks.buckets.severe],
    ['textNodes', countOf(a, 'textNodes'), countOf(b, 'textNodes')],
  ];
  for (const name of allSpanNames(sa, sb)) {
    lines.push([`${name} mean`, sa.get(name)?.meanMs ?? null, sb.get(name)?.meanMs ?? null]);
    if (sa.get(name)?.count != null) {
      lines.push([`${name} calls`, sa.get(name)?.count ?? null, sb.get(name)?.count ?? null]);
    }
  }

  for (const [label, x, y] of lines) {
    const fmt = (v: number | null) => (v == null ? '—' : v.toFixed(1));
    console.log(
      `  ${label.padEnd(32)}${fmt(x).padStart(12)}${fmt(y).padStart(12)}${ratio(x, y).padStart(10)}`
    );
  }

  console.log(`\n  Read it like this: a ratio near 1.0x is independent of chapter length,`);
  console.log(
    `  which is the goal. A ratio near ${verseRatio.toFixed(1)}x is doing work per verse.`
  );
}

function pctOf(report: Report): number {
  return report.durationMs > 0 ? (100 * report.blocks.totalMs) / report.durationMs : 0;
}

function allSpanNames(a: Map<string, Span>, b: Map<string, Span>): string[] {
  return [...new Set([...a.keys(), ...b.keys()])].sort();
}

const args = process.argv.slice(2);
const armsIdx = args.indexOf('--arms');
const scalingIdx = args.indexOf('--scaling');

if (armsIdx >= 0) {
  compareArms(args[armsIdx + 1] ?? 'psalm-119');
} else if (scalingIdx >= 0) {
  compareScaling(args[scalingIdx + 1] ?? 'native');
} else {
  console.error(`usage:
  bun scripts/perf/compare.ts --arms <chapter>     legacy vs native for one chapter
  bun scripts/perf/compare.ts --scaling <arm>      genesis-1 vs psalm-119 for one arm`);
  process.exit(2);
}
