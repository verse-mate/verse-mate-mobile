#!/usr/bin/env bun
/**
 * Summarise `adb shell dumpsys gfxinfo <pkg> framestats`.
 *
 * ## Why this is needed alongside the JS monitor
 *
 * `lib/perf` watches the JS thread. It cannot see the UI thread, so a stall
 * caused by native work — RN flattening a nested `<Text>` tree into a
 * `Spannable` and re-measuring it, which is exactly what this project is about —
 * is invisible to it. gfxinfo is the record of what the display actually did.
 *
 * Read the two together: the JS monitor says which app work was running, gfxinfo
 * says whether the user saw a dropped frame because of it.
 */

import { readFileSync } from 'node:fs';

/** Frame budget at 60Hz. The Xperia 5 V can run 120Hz, see `noteOnRefreshRate`. */
const BUDGET_60_MS = 16.67;
const BUDGET_120_MS = 8.33;

interface Frame {
  /** Non-zero flags mark frames Android itself says not to count. */
  flags: number;
  /** Total frame time: FrameCompleted - IntendedVsync, in ms. */
  totalMs: number;
}

function main(): void {
  const path = process.argv[2];
  if (!path) {
    console.error('usage: bun scripts/perf/summarise-gfxinfo.ts <gfxinfo.txt>');
    process.exit(2);
  }

  const raw = readFileSync(path, 'utf8');
  const frames = parseFrames(raw);
  const aggregate = parseAggregate(raw);

  // Android's own aggregate counters are authoritative when present — they cover
  // the whole reset window, whereas PROFILEDATA only retains the last ~120
  // frames. Report both rather than picking, since disagreement between them is
  // itself informative (it means the jank happened outside the retained window).
  if (aggregate.size > 0) {
    console.log('Android aggregate counters (whole window since reset):');
    for (const [key, value] of aggregate) {
      console.log(`  ${key.padEnd(34)} ${value}`);
    }
  } else {
    console.log('No aggregate counters found in the dump.');
    console.log('(Expected "Total frames rendered" / "Janky frames" lines — check');
    console.log(' that the dump came from `dumpsys gfxinfo <pkg> framestats`.)');
  }

  console.log('');

  if (frames.length === 0) {
    console.log('No PROFILEDATA frames in the dump.');
    console.log('');
    console.log('Most often this means the app rendered nothing during the window:');
    console.log('  - it was backgrounded before the flow ran, or');
    console.log('  - gfxinfo was reset after the interaction rather than before.');
    return;
  }

  const counted = frames.filter((f) => f.flags === 0);
  const skipped = frames.length - counted.length;
  const times = counted.map((f) => f.totalMs).sort((a, b) => a - b);

  console.log(`Retained frames: ${frames.length} (${counted.length} counted, ${skipped} flagged)`);
  if (times.length === 0) {
    console.log('Every retained frame was flagged — nothing to summarise.');
    return;
  }

  console.log(
    `  mean ${mean(times).toFixed(2)}ms   p50 ${pct(times, 0.5).toFixed(2)}ms   ` +
      `p90 ${pct(times, 0.9).toFixed(2)}ms   p95 ${pct(times, 0.95).toFixed(2)}ms   ` +
      `p99 ${pct(times, 0.99).toFixed(2)}ms   max ${times[times.length - 1].toFixed(2)}ms`
  );

  for (const [label, budget] of [
    ['60Hz', BUDGET_60_MS],
    ['120Hz', BUDGET_120_MS],
  ] as const) {
    const over = times.filter((t) => t > budget).length;
    const pctOver = ((over / times.length) * 100).toFixed(1);
    console.log(`  over ${label} budget (${budget}ms): ${over}/${times.length} (${pctOver}%)`);
  }

  // Long frames are the ones a user describes as "a hiccup". Listing them makes
  // the count concrete and lets them be lined up against the JS monitor's
  // block timestamps.
  const long = times.filter((t) => t > 100);
  if (long.length > 0) {
    console.log('');
    console.log(`Frames over 100ms (visible stalls): ${long.length}`);
    console.log(`  ${long.map((t) => t.toFixed(0)).join('ms, ')}ms`);
  }

  console.log('');
  console.log('NOTE: the Xperia 5 V is a 120Hz panel but RN apps often run at 60.');
  console.log('Which budget applies depends on the panel rate the app actually got,');
  console.log('so both are shown rather than guessing one.');
}

/** Parse the `---PROFILEDATA---` CSV blocks. */
function parseFrames(raw: string): Frame[] {
  const frames: Frame[] = [];
  let header: string[] | null = null;

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('Flags,')) {
      header = trimmed.split(',');
      continue;
    }
    if (!header || !/^\d/.test(trimmed)) continue;

    const cols = trimmed.split(',');
    if (cols.length !== header.length) continue;

    const flags = Number(cols[header.indexOf('Flags')]);
    const intended = Number(cols[header.indexOf('IntendedVsync')]);
    const completed = Number(cols[header.indexOf('FrameCompleted')]);
    // A frame still in flight when the dump was taken has FrameCompleted=0;
    // including it would report an absurd negative duration.
    if (!Number.isFinite(flags) || !intended || !completed || completed < intended) continue;

    frames.push({ flags, totalMs: (completed - intended) / 1e6 });
  }
  return frames;
}

/** Pull the human-readable aggregate lines Android prints above PROFILEDATA. */
function parseAggregate(raw: string): Map<string, string> {
  const wanted = [
    'Total frames rendered',
    'Janky frames',
    'Number Missed Vsync',
    'Number High input latency',
    'Number Slow UI thread',
    'Number Slow bitmap uploads',
    'Number Slow issue draw commands',
    'Number Frame deadline missed',
    '50th percentile',
    '90th percentile',
    '95th percentile',
    '99th percentile',
  ];
  const out = new Map<string, string>();
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    for (const key of wanted) {
      if (trimmed.startsWith(key)) {
        out.set(key, trimmed.slice(key.length).replace(/^[:\s]+/, ''));
      }
    }
  }
  return out;
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Percentile over an already-sorted array. */
function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

main();
