/**
 * Reassemble `PerfReport`s from raw logcat / Metro output.
 *
 * Lives in `lib/` rather than in `scripts/` so it is covered by the Jest suite
 * and shares one implementation with `scripts/perf/parse-report.mjs`. A log
 * transport that silently loses data is worse than no transport, so the
 * round-trip is tested rather than assumed.
 */

import { checksum } from './emit';
import type { PerfReport } from './types';

/** Outcome of parsing one BEGIN…END group. */
export type ParsedReport =
  | { ok: true; report: PerfReport }
  | {
      ok: false;
      id: string;
      label: string;
      /** Why this group could not be trusted. Never silently dropped. */
      reason: string;
    };

const BEGIN = /^\[VMPERF-BEGIN\] id=(\S+) chunks=(\d+) label=(\S*)/;
const DATA = /^\[VMPERF-DATA\] id=(\S+) i=(\d+) (.*)$/;
const END = /^\[VMPERF-END\] id=(\S+) len=(\d+) sum=(\S+)/;

interface Pending {
  id: string;
  label: string;
  expectedChunks: number;
  chunks: Map<number, string>;
}

/**
 * Parse every report in a blob of log output.
 *
 * Tolerates interleaved unrelated log lines (logcat is shared) and prefixes
 * added by the log pipeline — `adb logcat` stamps each line with time/pid/tag,
 * and Metro prefixes with ` LOG `. Lines are matched on the marker, wherever it
 * appears.
 *
 * Every BEGIN group yields exactly one result, successful or not. A truncated
 * or corrupted report is reported as a failure rather than omitted, because
 * "the report showed no stalls" and "the chunk with the stalls went missing"
 * must not look the same.
 */
export function parsePerfReports(raw: string): ParsedReport[] {
  const results: ParsedReport[] = [];
  const pending = new Map<string, Pending>();

  for (const line of raw.split('\n')) {
    const marker = findMarker(line);
    if (!marker) continue;

    const beginMatch = BEGIN.exec(marker);
    if (beginMatch) {
      const [, id, chunks, label] = beginMatch;
      pending.set(id, {
        id,
        label,
        expectedChunks: Number(chunks),
        chunks: new Map(),
      });
      continue;
    }

    const dataMatch = DATA.exec(marker);
    if (dataMatch) {
      const [, id, index, payload] = dataMatch;
      // A DATA line with no BEGIN means the capture started mid-report; there
      // is no way to know how many chunks are missing, so it is discarded.
      pending.get(id)?.chunks.set(Number(index), payload);
      continue;
    }

    const endMatch = END.exec(marker);
    if (endMatch) {
      const [, id, len, sum] = endMatch;
      const entry = pending.get(id);
      pending.delete(id);
      if (!entry) {
        results.push({
          ok: false,
          id,
          label: '(unknown)',
          reason: 'END marker with no matching BEGIN — capture started mid-report',
        });
        continue;
      }
      results.push(finalise(entry, Number(len), sum));
    }
  }

  // Anything still pending never saw its END: the app was killed, or the log
  // buffer wrapped mid-report.
  for (const entry of pending.values()) {
    results.push({
      ok: false,
      id: entry.id,
      label: entry.label,
      reason:
        `no END marker (got ${entry.chunks.size}/${entry.expectedChunks} chunks) — ` +
        'the app likely died before flushing, or the log buffer wrapped',
    });
  }

  return results;
}

/**
 * Strip any log-pipeline prefix and return the `[VMPERF-*]` marker onwards, or
 * null when the line carries no marker.
 */
function findMarker(line: string): string | null {
  const at = line.indexOf('[VMPERF-');
  return at === -1 ? null : line.slice(at);
}

function finalise(entry: Pending, expectedLen: number, expectedSum: string): ParsedReport {
  const missing: number[] = [];
  for (let i = 0; i < entry.expectedChunks; i++) {
    if (!entry.chunks.has(i)) missing.push(i);
  }
  if (missing.length > 0) {
    return {
      ok: false,
      id: entry.id,
      label: entry.label,
      reason: `missing chunk(s) ${missing.join(',')} of ${entry.expectedChunks}`,
    };
  }

  let json = '';
  for (let i = 0; i < entry.expectedChunks; i++) {
    json += entry.chunks.get(i) as string;
  }

  if (json.length !== expectedLen) {
    return {
      ok: false,
      id: entry.id,
      label: entry.label,
      reason: `length mismatch: got ${json.length}, expected ${expectedLen}`,
    };
  }

  const actualSum = checksum(json);
  if (actualSum !== expectedSum) {
    return {
      ok: false,
      id: entry.id,
      label: entry.label,
      reason: `checksum mismatch: got ${actualSum}, expected ${expectedSum}`,
    };
  }

  try {
    return { ok: true, report: JSON.parse(json) as PerfReport };
  } catch (error) {
    return {
      ok: false,
      id: entry.id,
      label: entry.label,
      // Should be unreachable given the checksum passed, so surface it loudly
      // rather than folding it into a generic failure.
      reason: `checksum passed but JSON.parse failed: ${(error as Error).message}`,
    };
  }
}

/**
 * Render a report as a short human-readable summary.
 *
 * Deliberately leads with JS blocks: a span total tells you where time went,
 * but a block is what the user actually felt.
 */
export function formatPerfReport(report: PerfReport): string {
  const lines: string[] = [];
  lines.push(`=== ${report.label} — ${fmt(report.durationMs)}ms session ===`);

  const b = report.blocks;
  lines.push(
    `JS blocks: ${b.count} (${fmt(b.totalMs)}ms total, worst ${fmt(b.maxMs)}ms) ` +
      `[minor ${b.buckets.minor} / major ${b.buckets.major} / severe ${b.buckets.severe}]`
  );
  if (report.durationMs > 0) {
    const pct = ((b.totalMs / report.durationMs) * 100).toFixed(1);
    lines.push(`JS thread blocked ${pct}% of the session`);
  }

  if (b.topSuspects.length > 0) {
    lines.push('');
    lines.push('Blocks attributed to open spans:');
    for (const s of b.topSuspects) {
      lines.push(`  ${pad(s.name, 34)} ${String(s.blocks).padStart(4)} blocks  ${fmt(s.totalMs)}ms`);
    }
  }

  if (report.spans.length > 0) {
    lines.push('');
    lines.push('Spans (worst total first):');
    lines.push(`  ${pad('name', 34)} ${'n'.padStart(4)}  ${'total'.padStart(9)}  ${'mean'.padStart(8)}  ${'p95'.padStart(8)}  ${'max'.padStart(8)}`);
    for (const s of report.spans) {
      lines.push(
        `  ${pad(s.name, 34)} ${String(s.count).padStart(4)}  ${fmt(s.totalMs).padStart(9)}  ` +
          `${fmt(s.meanMs).padStart(8)}  ${fmt(s.p95Ms).padStart(8)}  ${fmt(s.maxMs).padStart(8)}`
      );
    }
  }

  if (report.counts.length > 0) {
    lines.push('');
    lines.push('Counters:');
    for (const c of report.counts) {
      lines.push(`  ${pad(c.name, 34)} ${c.value}`);
    }
  }

  if (report.truncated) {
    lines.push('');
    lines.push('WARNING: record ring buffer overflowed — early records were dropped.');
    lines.push('Summaries above cover only the retained window.');
  }

  return lines.join('\n');
}

function fmt(n: number): string {
  return n.toFixed(1);
}

function pad(s: string, width: number): string {
  return s.length >= width ? s : s + ' '.repeat(width - s.length);
}
