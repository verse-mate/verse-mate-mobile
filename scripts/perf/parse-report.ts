#!/usr/bin/env bun
/**
 * Reassemble and summarise `PerfReport`s from captured log output.
 *
 * ```sh
 * bun scripts/perf/parse-report.ts <logfile> [--json] [--out <dir>]
 * cat logcat.txt | bun scripts/perf/parse-report.ts -
 * ```
 *
 * Exits non-zero when any report in the capture failed to reassemble. A perf run
 * whose data was silently truncated must not look like a clean run — the whole
 * point of the checksummed transport is that a lost chunk is detectable, so this
 * treats it as an error rather than a note.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { formatPerfReport, parsePerfReports } from '../../lib/perf/parse';

function usage(): never {
  console.error('usage: bun scripts/perf/parse-report.ts <logfile|-> [--json] [--out <dir>]');
  process.exit(2);
}

const args = process.argv.slice(2);
if (args.length === 0) usage();

const source = args[0];
const asJson = args.includes('--json');
const outIdx = args.indexOf('--out');
const outDir = outIdx >= 0 ? args[outIdx + 1] : null;
if (outIdx >= 0 && !outDir) usage();

const raw = source === '-' ? readFileSync(0, 'utf8') : readFileSync(source, 'utf8');
const parsed = parsePerfReports(raw);

if (parsed.length === 0) {
  console.error(
    'No [VMPERF-*] markers found in the capture.\n' +
      '\n' +
      'Likely causes, in order of how often they are the actual cause:\n' +
      '  1. The app is a release build — the perf session is __DEV__ only.\n' +
      '  2. The app never backgrounded, so no report was emitted. Send it to\n' +
      '     the background with: adb shell input keyevent KEYCODE_HOME\n' +
      '  3. logcat was filtered to the wrong tag. The session logs through\n' +
      '     console.log, which surfaces under the ReactNativeJS tag.\n' +
      '  4. The capture window missed the emit (logcat cleared after it).'
  );
  process.exit(1);
}

const failures = parsed.filter((p) => !p.ok);
const successes = parsed.flatMap((p) => (p.ok ? [p.report] : []));

if (asJson) {
  console.log(JSON.stringify({ reports: successes, failures }, null, 2));
} else {
  for (const report of successes) {
    console.log(formatPerfReport(report));
    console.log('');
  }
}

if (outDir) {
  mkdirSync(outDir, { recursive: true });
  for (const [i, report] of successes.entries()) {
    // Index-prefixed so two reports with the same label (an interval flush and
    // the background flush) don't overwrite each other.
    const name = `${String(i).padStart(2, '0')}-${report.label.replace(/[^\w.-]/g, '_')}.json`;
    writeFileSync(join(outDir, name), JSON.stringify(report, null, 2));
    console.error(`wrote ${join(outDir, name)}`);
  }
}

if (failures.length > 0) {
  console.error('');
  console.error(`${failures.length} report(s) could not be reassembled:`);
  for (const f of failures) {
    console.error(`  id=${f.id} label=${f.label}: ${f.reason}`);
  }
  console.error('');
  console.error(
    'Treat the surviving reports as incomplete. A dropped chunk usually means\n' +
      'the logcat ring buffer wrapped — re-run with a bigger buffer:\n' +
      '  adb logcat -G 16M'
  );
  process.exit(1);
}
