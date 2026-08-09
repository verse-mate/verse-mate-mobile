#!/usr/bin/env bun
/** Who calls the expensive frames, and what our own components cost. *
 * Usage: bun scripts/perf/hermes-callers.ts <file.cpuprofile>
 */
import { readFileSync } from 'node:fs';

const p = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const byId = new Map<number, any>(p.nodes.map((n: any) => [n.id, n]));
const parent = new Map<number, number>();
for (const n of p.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
const self = new Map<number, number>();
let total = 0;
for (let i = 0; i < p.samples.length; i++) {
  const dt = (p.timeDeltas[i] ?? 0) / 1000;
  if (dt <= 0) continue;
  total += dt;
  self.set(p.samples[i], (self.get(p.samples[i]) ?? 0) + dt);
}
const fn = (id: number) => byId.get(id)?.callFrame?.functionName || '(anon)';

// Callers of a given frame, by the time spent inside it.
function callersOf(target: string, depth = 4) {
  const acc = new Map<string, number>();
  for (const [id, ms] of self) {
    let cur: number | undefined = id;
    let found = false;
    while (cur != null) {
      if (fn(cur).includes(target)) {
        found = true;
        break;
      }
      cur = parent.get(cur);
    }
    if (!found) continue;
    const chain: string[] = [];
    let up: number | undefined = parent.get(cur as number);
    for (let d = 0; d < depth && up != null; d++) {
      chain.push(fn(up));
      up = parent.get(up);
    }
    const k = chain.join(' <- ') || '(root)';
    acc.set(k, (acc.get(k) ?? 0) + ms);
  }
  console.log(`\n=== callers of ${target} ===`);
  for (const [k, ms] of [...acc].sort((a, b) => b[1] - a[1]).slice(0, 6)) {
    console.log(`  ${ms.toFixed(0).padStart(5)}ms  ${k}`);
  }
}

for (const t of ['completeRoot', 'createNode', 'regExpConstructor', 'measureHeights']) callersOf(t);

// Our own components, by total subtree time.
const OURS =
  /^(ChapterReader|ChapterPage|SimpleChapterPager|ParagraphText|VMText|HighlightedText|useParagraphLayout|compileParagraph|BibleChapterScreen|Markdown)/;
const totals = new Map<string, number>();
for (const [id, ms] of self) {
  const seen = new Set<string>();
  let cur: number | undefined = id;
  while (cur != null) {
    const name = fn(cur);
    if (OURS.test(name) && !seen.has(name)) {
      seen.add(name);
      totals.set(name, (totals.get(name) ?? 0) + ms);
    }
    cur = parent.get(cur);
  }
}
console.log(`\n=== our components, total subtree time (of ${total.toFixed(0)}ms) ===`);
for (const [k, ms] of [...totals].sort((a, b) => b[1] - a[1]).slice(0, 14)) {
  console.log(
    `  ${ms.toFixed(0).padStart(5)}ms  ${((ms / total) * 100).toFixed(1).padStart(4)}%  ${k}`
  );
}
