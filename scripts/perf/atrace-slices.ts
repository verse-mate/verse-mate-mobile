/**
 * Attribute an atrace capture to named slices, with SELF time.
 *
 * ## Why this exists
 *
 * `framestats` says which *phase* of a frame was slow, and every finding in this work has pointed at
 * one phase: `animation`. But a phase is a time boundary, not a cause — it cannot say what executed
 * inside it. Three hypotheses have been offered for that phase so far (one confirmed, one wrong, one
 * retracted as untested), which is the signature of guessing rather than measuring.
 *
 * atrace can answer it, because both Android and React Native emit named slices:
 *
 *   - `animation`  — the Choreographer's CALLBACK_ANIMATION run, i.e. the phase itself
 *   - `BatchEventDispatchedListeners`, `ReactScrollView.onScrollChanged`, ... — React Native's own
 *   - `performTraversals` / `measure` / `layout` / `draw` — the platform's view work
 *
 * So a slice nested *inside* `animation` names what the animation phase is actually spending time on.
 *
 * ## Self time, not total
 *
 * Total (wall) time double-counts: a parent's total includes every child. `animation` totalling 30ms
 * tells you nothing about which of its children to fix. Self time — a slice's duration minus the time
 * its children were on the stack — is additive across the tree, so the largest self time is the thing
 * actually executing. That distinction is the whole point of the report.
 *
 * ## Threads and processes
 *
 * Only the app's own process is considered: the trace also contains SurfaceFlinger, the timer
 * dispatcher and the GPU driver, whose slices are noise here. The process is discovered from the
 * thread name rather than hardcoded, because the pid changes on every launch.
 *
 * Stacks are kept per THREAD, not per process. The app has several trace-emitting threads (main,
 * RenderThread, mqt_js, ...) writing interleaved B/E lines to one buffer; a single shared stack would
 * pair a begin on one thread with an end on another and produce fiction.
 *
 * Usage:
 *   bun scripts/perf/atrace-slices.ts <trace.txt> [--within animation] [--top 25]
 */

const CRLF = /\r$/;

/**
 * `<thread-name>-<tid> ( <tgid>) [cpu] <flags> <ts>: tracing_mark_write: <B|E|C>|<pid>[|<name>]`
 *
 * The thread name itself can contain '-' and spaces (e.g. "Binder:1234_5", "g.versemate.app"), so the
 * tid is anchored to the LAST '-' before the parenthesised tgid rather than by splitting on '-'.
 */
const LINE =
  /^\s*(.+)-(\d+)\s+\(\s*(\d+|-+)\)\s+\[\d+\]\s+\S+\s+(\d+\.\d+):\s+tracing_mark_write:\s+([BEC])\|(\d+)(?:\|(.*))?$/;

interface Frame {
  name: string;
  start: number;
  /** Wall time accumulated by children, so self = dur - childTime. */
  childTime: number;
  /** True when this slice or any ancestor matches --within. */
  inside: boolean;
}

interface Agg {
  count: number;
  total: number;
  self: number;
  max: number;
}

function agg(map: Map<string, Agg>, name: string, dur: number, self: number): void {
  const a = map.get(name) ?? { count: 0, total: 0, self: 0, max: 0 };
  a.count += 1;
  a.total += dur;
  a.self += self;
  if (dur > a.max) a.max = dur;
  map.set(name, a);
}

function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[i];
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  if (!file) {
    console.error(
      'usage: bun scripts/perf/atrace-slices.ts <trace.txt> [--within animation] [--top 25]'
    );
    process.exit(2);
  }
  const withinIdx = args.indexOf('--within');
  const within = withinIdx >= 0 ? args[withinIdx + 1] : 'animation';
  const topIdx = args.indexOf('--top');
  const top = topIdx >= 0 ? Number(args[topIdx + 1]) : 25;
  const procMatch = 'versemate';

  const text = await Bun.file(file).text();
  const lines = text.split('\n');

  // Pass 1: find the app's tgid from any thread whose name identifies it. Hardcoding a pid would
  // silently analyse the wrong process after a relaunch.
  let appTgid: string | null = null;
  for (const raw of lines) {
    const m = LINE.exec(raw.replace(CRLF, ''));
    if (!m) continue;
    if (m[1].includes(procMatch)) {
      appTgid = m[3];
      break;
    }
  }
  if (!appTgid) {
    console.error(`No thread name containing "${procMatch}" emitted a slice.

The app process never wrote to the trace buffer. Usual causes: atrace was started without
\`-a <package>\` (app-tag slices stay disabled), or the capture window did not overlap any
interaction. Both look identical to "the app is fast".`);
    process.exit(1);
  }

  const stacks = new Map<string, Frame[]>();
  const all = new Map<string, Agg>();
  const inside = new Map<string, Agg>();
  const withinDurations: number[] = [];
  let unmatchedEnds = 0;
  let slices = 0;

  for (const raw of lines) {
    const line = raw.replace(CRLF, '');
    const m = LINE.exec(line);
    if (!m) continue;
    const [, , tid, tgid, tsStr, kind, , name] = m;
    if (tgid !== appTgid) continue;
    // 'C' is a counter track, not a duration — it has no matching end.
    if (kind === 'C') continue;

    const ts = Number(tsStr) * 1000; // seconds -> ms
    let stack = stacks.get(tid);
    if (!stack) {
      stack = [];
      stacks.set(tid, stack);
    }

    if (kind === 'B') {
      const parentInside = stack.length > 0 && stack[stack.length - 1].inside;
      stack.push({
        name: name ?? '(unnamed)',
        start: ts,
        childTime: 0,
        inside: parentInside || (name ?? '') === within,
      });
      continue;
    }

    // kind === 'E'
    const frame = stack.pop();
    if (!frame) {
      // A slice that began before the ring buffer's oldest retained line. Counting these is the
      // honest alternative to inventing a start time for them.
      unmatchedEnds += 1;
      continue;
    }
    const dur = ts - frame.start;
    const self = Math.max(0, dur - frame.childTime);
    slices += 1;
    agg(all, frame.name, dur, self);
    if (frame.name === within) withinDurations.push(dur);
    // Attribute to the `within` bucket only for slices strictly BELOW it, so the phase itself does
    // not dominate its own breakdown.
    if (frame.inside && frame.name !== within) agg(inside, frame.name, dur, self);
    const parent = stack[stack.length - 1];
    if (parent) parent.childTime += dur;
  }

  const unclosed = [...stacks.values()].reduce((n, s) => n + s.length, 0);
  const span = withinDurations.length > 0 ? withinDurations.reduce((t, v) => t + v, 0) : 0;

  console.log(`atrace slice attribution — ${file}`);
  console.log(`app process tgid=${appTgid}  threads=${stacks.size}  slices=${slices}`);
  console.log(
    `dropped: ${unmatchedEnds} ends with no begin (pre-buffer), ${unclosed} begins never closed (post-buffer)\n`
  );

  const sorted = [...withinDurations].sort((a, b) => a - b);
  if (sorted.length > 0) {
    console.log(
      `"${within}" x${sorted.length}: total ${span.toFixed(1)}ms  p50 ${pct(sorted, 50).toFixed(2)}ms  ` +
        `p95 ${pct(sorted, 95).toFixed(2)}ms  max ${pct(sorted, 100).toFixed(2)}ms`
    );
    const budget = 8.34;
    const over = sorted.filter((d) => d > budget).length;
    console.log(`  over the 8.34ms budget: ${over}/${sorted.length}\n`);
  } else {
    console.log(`"${within}" never appeared as a slice in this process.\n`);
  }

  const table = (label: string, map: Map<string, Agg>) => {
    const rows = [...map.entries()].sort((a, b) => b[1].self - a[1].self).slice(0, top);
    if (rows.length === 0) {
      console.log(`${label}: nothing\n`);
      return;
    }
    console.log(label);
    console.log('     self(ms)   total(ms)   max(ms)   count  slice');
    for (const [name, a] of rows) {
      console.log(
        `  ${a.self.toFixed(1).padStart(9)} ${a.total.toFixed(1).padStart(11)} ${a.max
          .toFixed(2)
          .padStart(9)} ${String(a.count).padStart(7)}  ${name}`
      );
    }
    console.log('');
  };

  table(`INSIDE "${within}" — what the phase is actually executing (by self time):`, inside);
  table('WHOLE PROCESS — every slice by self time:', all);
}

main();
