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
 * Usage: bun scripts/perf/framestats.ts <gfxinfo-with-framestats.txt> [slowMs]
 */

import { readFileSync } from 'node:fs';

const file = process.argv[2];
const slowMs = Number(process.argv[3] ?? 16);
if (!file) {
  console.error('usage: bun scripts/perf/framestats.ts <gfxinfo.txt> [slowMs]');
  process.exit(2);
}

const text = readFileSync(file, 'utf8').replace(/\r/g, '');
const start = text.indexOf('---PROFILEDATA---');
if (start === -1) {
  console.error('No ---PROFILEDATA--- block. Capture with: dumpsys gfxinfo <pkg> framestats');
  process.exit(1);
}
const lines = text.slice(start).split('\n').slice(1);
const header = lines[0]?.split(',') ?? [];
const col = (name: string) => header.indexOf(name);

const idx = {
  intended: col('IntendedVsync'),
  input: col('HandleInputStart'),
  anim: col('AnimationStart'),
  trav: col('PerformTraversalsStart'),
  draw: col('DrawStart'),
  sync: col('SyncStart'),
  issue: col('IssueDrawCommandsStart'),
  done: col('FrameCompleted'),
};
if (Object.values(idx).some((i) => i < 0)) {
  console.error(`Unexpected framestats columns: ${header.join(',')}`);
  process.exit(1);
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

const ms = (a: number, b: number) => (b - a) / 1e6;
const frames: Frame[] = [];

for (const line of lines.slice(1)) {
  const f = line.split(',').map(Number);
  if (f.length < header.length || !Number.isFinite(f[idx.done]) || f[idx.done] <= 0) continue;
  // A dropped/never-drawn frame reports 0 in a phase column; skip rather than report noise.
  if (f[idx.input] <= 0 || f[idx.trav] <= 0) continue;
  frames.push({
    total: ms(f[idx.intended], f[idx.done]),
    input: ms(f[idx.input], f[idx.anim]),
    animation: ms(f[idx.anim], f[idx.trav]),
    traversals: ms(f[idx.trav], f[idx.draw]),
    draw: ms(f[idx.draw], f[idx.sync]),
    sync: ms(f[idx.sync], f[idx.issue]),
    gpu: ms(f[idx.issue], f[idx.done]),
  });
}

if (frames.length === 0) {
  console.error('No usable frames in the block.');
  process.exit(1);
}

const slow = frames.filter((f) => f.total > slowMs).sort((a, b) => b.total - a.total);
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
