#!/usr/bin/env bun
/**
 * Aggregate a Hermes .cpuprofile into "where did the JS thread actually go".
 *
 * Self time answers "which function was executing"; total time answers "which
 * subtree owns the cost". Both are printed because they disagree in the useful
 * case: a cheap function called from one expensive place.
 *
 * Usage: bun scripts/perf/hermes-analyse.ts <file.cpuprofile>
 */
import { readFileSync } from 'node:fs';

interface Node {
  id: number;
  callFrame: { functionName: string; url?: string; lineNumber?: number };
  children?: number[];
}
const p = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const nodes: Node[] = p.nodes;
const byId = new Map(nodes.map((n) => [n.id, n]));
const parent = new Map<number, number>();
for (const n of nodes) for (const c of n.children ?? []) parent.set(c, n.id);

// timeDeltas[i] is the gap BEFORE samples[i]; charge it to that sample.
const self = new Map<number, number>();
let total = 0;
for (let i = 0; i < p.samples.length; i++) {
  const dt = (p.timeDeltas[i] ?? 0) / 1000; // µs -> ms
  if (dt <= 0) continue;
  total += dt;
  self.set(p.samples[i], (self.get(p.samples[i]) ?? 0) + dt);
}

const label = (n: Node): string => {
  const fn = n.callFrame.functionName || '(anonymous)';
  const url = (n.callFrame.url ?? '').replace(/^.*?(node_modules|app|components|hooks|lib|src)\//, '$1/');
  return `${fn}  ${url ? `[${url}:${n.callFrame.lineNumber ?? '?'}]` : ''}`;
};

// Fold by call frame — the same function appears under many stacks.
const selfByName = new Map<string, number>();
for (const [id, ms] of self) {
  const n = byId.get(id);
  if (!n) continue;
  const k = label(n);
  selfByName.set(k, (selfByName.get(k) ?? 0) + ms);
}

const totalByName = new Map<string, number>();
for (const [id, ms] of self) {
  const seen = new Set<string>();
  let cur: number | undefined = id;
  while (cur != null) {
    const n = byId.get(cur);
    if (!n) break;
    const k = label(n);
    // Guard recursion so a recursive frame is not charged twice for one sample.
    if (!seen.has(k)) {
      seen.add(k);
      totalByName.set(k, (totalByName.get(k) ?? 0) + ms);
    }
    cur = parent.get(cur);
  }
}

const show = (m: Map<string, number>, title: string, n = 22) => {
  console.log(`\n=== ${title} (of ${total.toFixed(0)}ms sampled) ===`);
  for (const [k, ms] of [...m].sort((a, b) => b[1] - a[1]).slice(0, n)) {
    console.log(`  ${ms.toFixed(0).padStart(6)}ms  ${((ms / total) * 100).toFixed(1).padStart(5)}%  ${k}`);
  }
};
show(selfByName, 'SELF time — what was executing');
show(totalByName, 'TOTAL time — which subtree owns it', 26);
