/**
 * Emit a `PerfReport` to logcat / Metro in a form a script can reassemble.
 *
 * ## Why chunking is not optional
 *
 * Android's logger drops any single message over ~4076 bytes
 * (`LOGGER_ENTRY_MAX_PAYLOAD`). A full report is far larger than that, so
 * logging it in one call yields a silently truncated line — which parses as
 * invalid JSON at best, and as a *plausible but incomplete* report at worst.
 *
 * So the report is split into fixed-size chunks framed by BEGIN/END markers,
 * with a length and checksum in the END marker. The reader can then tell the
 * difference between "the report says there were no stalls" and "the report
 * lost the chunk that had the stalls in it". Detecting a dropped chunk matters
 * more than recovering from one.
 */

import type { PerfReport } from './types';

/**
 * Bytes per chunk. Well under the ~4076-byte logcat cap, leaving room for the
 * marker prefix and for multi-byte UTF-8 expansion in span metadata.
 */
const CHUNK_SIZE = 2000;

let sequence = 0;

/**
 * Serialise and log a report.
 *
 * Reassemble with `scripts/perf/parse-report.mjs`, which validates the
 * checksum and refuses to emit a report with missing chunks.
 */
export function emitPerfReport(report: PerfReport): void {
  if (!__DEV__) return;

  const json = JSON.stringify(report);
  const id = `r${++sequence}`;
  const chunks: string[] = [];
  for (let i = 0; i < json.length; i += CHUNK_SIZE) {
    chunks.push(json.slice(i, i + CHUNK_SIZE));
  }

  console.log(`[VMPERF-BEGIN] id=${id} chunks=${chunks.length} label=${report.label}`);
  for (let i = 0; i < chunks.length; i++) {
    console.log(`[VMPERF-DATA] id=${id} i=${i} ${chunks[i]}`);
  }
  console.log(`[VMPERF-END] id=${id} len=${json.length} sum=${checksum(json)}`);

  // A compact human-readable line too, so a run can be sanity-checked by eye
  // in the Metro console without running the parser.
  console.log(
    `[VMPERF] ${report.label}: ${report.blocks.count} blocks ` +
      `(${report.blocks.totalMs}ms total, worst ${report.blocks.maxMs}ms) ` +
      `over ${report.durationMs}ms` +
      (report.truncated ? ' [RECORDS TRUNCATED]' : '')
  );
}

/**
 * FNV-1a, 32-bit. Chosen because it is a dozen lines, needs no dependency, and
 * only has to catch a dropped or reordered chunk — this is a transport
 * integrity check, not a security boundary.
 */
export function checksum(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i) & 0xff;
    // 16777619, via shifts to stay in 32-bit int range without Math.imul deopt.
    hash = (hash + (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
