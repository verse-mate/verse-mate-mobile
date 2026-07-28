#!/usr/bin/env bun
/**
 * Break the slowest frames down by UI-thread phase.
 *
 * ## Why this exists
 *
 * `gfxinfo`'s summary gives percentiles and a jank count, which says a frame was slow but not
 * WHY. That gap cost four consecutive non-improving attempts on the Insight surface: a Hermes
 * profile showed the JS thread 98% idle during tab switching, so the cost had to be on the UI
 * thread, and nothing available could see inside it. Pre-warming tabs, stabilising the
 * explanation prop, hunting per-word text nodes and capping the markdown layout pass each moved
 * render counts and left the frame numbers alone.
 *
 * The `framestats` block has always carried the answer. Each row timestamps the phases of one
 * frame, so the slow ones can be attributed:
 *
 *   input        HandleInputStart      -> AnimationStart
 *   animation    AnimationStart        -> PerformTraversalsStart
 *   traversals   PerformTraversalsStart-> DrawStart      (measure + layout — React Native's
 *                                                        view tree work lands here)
 *   draw         DrawStart             -> SyncStart      (recording draw commands)
 *   sync         SyncStart             -> IssueDrawCommandsStart
 *   gpu          IssueDrawCommandsStart-> FrameCompleted
 *
 * A slow frame dominated by `traversals` is layout, and the fix is a smaller or shallower tree.
 * One dominated by `gpu` is overdraw. One dominated by `input` is the JS thread blocking the
 * response. They point at completely different work, which is the distinction that has been
 * missing.
 *
 * ## Two traps in the format, both of which produced wrong numbers here
 *
 * A row whose `Flags` column is non-zero MUST be discarded — Android's own contract for this
 * block. Those rows carry timestamps from a different frame lifecycle and their columns are not
 * ordered in time. Keeping exactly ONE such row (of 120) put a -17,006ms frame in the set and
 * dragged the reported means to -131ms total and -141ms sync, which is how a real finding —
 * `draw` dominating the slow frames — nearly got thrown out with the arithmetic.
 *
 * And `dumpsys` emits one block PER WINDOW, each with its own header, followed by unrelated
 * prose (`View hierarchy:`). Reading from the first marker to end-of-file and splitting on
 * newlines swallows all of it.
 *
 * The frame budget comes from the `FrameInterval` column rather than an assumed 16.7ms. This
 * device reports 8,340,090ns — it is a 120Hz panel, so a frame that looks fine against 16ms is
 * already two vsyncs late.
 *
 * Usage: bun scripts/perf/framestats.ts <gfxinfo-with-framestats.txt> [slowMs]
 */

import { readFileSync } from 'node:fs';

const file = process.argv[2];
const slowOverride = process.argv[3] ? Number(process.argv[3]) : null;
if (!file) {
  console.error('usage: bun scripts/perf/framestats.ts <gfxinfo.txt> [slowMs]');
  process.exit(2);
}

interface Frame {
  total: number;
  input: number;
  animation: number;
  traversals: number;
  draw: number;
  sync: number;
  gpu: number;
}

const PHASES = [
  ['input', 'HandleInputStart', 'AnimationStart'],
  ['animation', 'AnimationStart', 'PerformTraversalsStart'],
  ['traversals', 'PerformTraversalsStart', 'DrawStart'],
  ['draw', 'DrawStart', 'SyncStart'],
  ['sync', 'SyncStart', 'IssueDrawCommandsStart'],
  ['gpu', 'IssueDrawCommandsStart', 'FrameCompleted'],
] as const;

const text = readFileSync(file, 'utf8').replace(/\r/g, '');
if (!text.includes('---PROFILEDATA---')) {
  console.error('No ---PROFILEDATA--- block. Capture with: dumpsys gfxinfo <pkg> framestats');
  process.exit(1);
}

const frames: Frame[] = [];
const intervals: number[] = [];
let skippedFlagged = 0;

for (const block of text.split('---PROFILEDATA---').slice(1)) {
  const lines = block.split('\n').filter((l) => l.trim().length > 0);
  // A block that does not open with the header is trailing prose from another section.
  if (!lines[0]?.startsWith('Flags')) continue;
  const header = lines[0].split(',');
  const col = (name: string) => header.indexOf(name);
  const at = { flags: col('Flags'), interval: col('FrameInterval') };
  if (PHASES.some(([, from, to]) => col(from) < 0 || col(to) < 0)) continue;

  for (const line of lines.slice(1)) {
    // The next window's header, or prose, ends this block's rows.
    const raw = line.split(',');
    const f = raw.map(Number);
    if (raw.length < header.length - 1 || f.slice(0, at.flags + 2).some((n) => !Number.isFinite(n)))
      break;
    if (f[at.flags] !== 0) {
      skippedFlagged++;
      continue;
    }
    const phase = Object.fromEntries(
      PHASES.map(([name, from, to]) => [name, (f[col(to)] - f[col(from)]) / 1e6])
    ) as Omit<Frame, 'total'>;
    // A frame that never drew reports 0 in a phase column, which shows up as a large negative.
    if (Object.values(phase).some((v) => v < 0)) continue;
    frames.push({
      ...phase,
      total: (f[col('FrameCompleted')] - f[col('IntendedVsync')]) / 1e6,
    });
    if (at.interval >= 0 && f[at.interval] > 0) intervals.push(f[at.interval] / 1e6);
  }
}

if (frames.length === 0) {
  console.error('No usable frames in the block.');
  process.exit(1);
}

const budget = intervals.length
  ? intervals.reduce((t, v) => t + v, 0) / intervals.length
  : 1000 / 60;
const slowMs = slowOverride ?? budget;
const slow = frames.filter((f) => f.total > slowMs).sort((a, b) => b.total - a.total);
console.log(
  `budget ${budget.toFixed(2)}ms/frame (${Math.round(1000 / budget)}Hz)` +
    `${skippedFlagged ? `, ${skippedFlagged} flagged row(s) discarded` : ''}`
);
const mean = (pick: (f: Frame) => number, set: Frame[]) =>
  set.length === 0 ? 0 : set.reduce((t, f) => t + pick(f), 0) / set.length;

console.log(`${frames.length} frames, ${slow.length} slower than ${slowMs}ms\n`);
console.log(`  ${'phase'.padEnd(12)}${'all frames'.padStart(12)}${'slow frames'.padStart(13)}`);
for (const [name, pick] of [
  ['total', (f: Frame) => f.total],
  ['input', (f: Frame) => f.input],
  ['animation', (f: Frame) => f.animation],
  ['traversals', (f: Frame) => f.traversals],
  ['draw', (f: Frame) => f.draw],
  ['sync', (f: Frame) => f.sync],
  ['gpu', (f: Frame) => f.gpu],
] as [string, (f: Frame) => number][]) {
  console.log(
    `  ${name.padEnd(12)}${mean(pick, frames).toFixed(1).padStart(12)}${mean(pick, slow).toFixed(1).padStart(13)}`
  );
}

console.log('\n  worst 5 frames, by phase:');
console.log(
  `  ${'total'.padStart(8)}${'input'.padStart(8)}${'anim'.padStart(8)}${'traversals'.padStart(12)}${'draw'.padStart(8)}${'sync'.padStart(8)}${'gpu'.padStart(8)}`
);
for (const f of slow.slice(0, 5)) {
  console.log(
    `  ${f.total.toFixed(1).padStart(8)}${f.input.toFixed(1).padStart(8)}${f.animation.toFixed(1).padStart(8)}${f.traversals.toFixed(1).padStart(12)}${f.draw.toFixed(1).padStart(8)}${f.sync.toFixed(1).padStart(8)}${f.gpu.toFixed(1).padStart(8)}`
  );
}
