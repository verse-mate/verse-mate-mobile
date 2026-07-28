/**
 * Round-trip tests for the perf log transport (emit -> log lines -> parse).
 *
 * The transport exists because Android's logger drops messages over ~4076
 * bytes. The failure mode it guards against is a *plausible but incomplete*
 * report, so these tests care as much about detecting corruption as about the
 * happy path.
 */

import { emitPerfReport } from '@/lib/perf/emit';
import { formatPerfReport, parsePerfReports } from '@/lib/perf/parse';
import type { PerfRecord, PerfReport } from '@/lib/perf/types';

/** Capture everything emitted via console.log during `fn`. */
function captureLog(fn: () => void): string[] {
  const lines: string[] = [];
  const spy = jest.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    lines.push(args.map(String).join(' '));
  });
  try {
    fn();
  } finally {
    spy.mockRestore();
  }
  return lines;
}

/**
 * Build a report big enough to span many chunks. `records` is what makes a real
 * report large, so the padding goes there rather than into a synthetic field.
 */
/**
 * True when `line` is the DATA line for chunk `index`.
 *
 * Anchored and structural rather than a substring search: chunk payloads are
 * raw JSON, so a loose `i=3` match can hit report content instead of the
 * marker.
 */
function isDataChunk(line: string, index: number): boolean {
  return new RegExp(String.raw`^\[VMPERF-DATA\] id=\S+ i=${index} `).test(line);
}

function makeReport(recordCount: number, label = 'psalm-119'): PerfReport {
  const records: PerfRecord[] = [];
  for (let i = 0; i < recordCount; i++) {
    records.push({
      kind: 'span',
      name: `paragraph.render.section-${i}`,
      ms: 12.5 + i,
      at: i * 20,
      meta: { verseStart: i * 5, verseEnd: i * 5 + 4, book: 19, chapter: 119 },
    });
  }
  return {
    label,
    durationMs: 12_345.6,
    spans: [
      {
        name: 'paragraph.render',
        count: recordCount,
        totalMs: 1234.5,
        meanMs: 20.1,
        minMs: 4,
        maxMs: 310.2,
        p95Ms: 280.4,
      },
    ],
    blocks: {
      count: 7,
      totalMs: 1820.5,
      maxMs: 690.2,
      buckets: { minor: 2, major: 3, severe: 2 },
      topSuspects: [{ name: 'chapter.mount', blocks: 5, totalMs: 1500.1 }],
    },
    counts: [{ name: 'textNodes', value: 2894 }],
    records,
    truncated: false,
  };
}

describe('perf log transport round-trip', () => {
  it('reassembles a multi-chunk report byte-for-byte', () => {
    const original = makeReport(200);
    const lines = captureLog(() => emitPerfReport(original));

    // Guard the premise of the whole transport: this report really is big
    // enough to need chunking, so the test is exercising the split path.
    const dataLines = lines.filter((l) => l.startsWith('[VMPERF-DATA]'));
    expect(dataLines.length).toBeGreaterThan(5);

    const parsed = parsePerfReports(lines.join('\n'));
    expect(parsed).toHaveLength(1);
    expect(parsed[0].ok).toBe(true);
    if (!parsed[0].ok) return;
    expect(parsed[0].report).toEqual(original);
  });

  it('keeps every chunk within the logcat payload limit', () => {
    const lines = captureLog(() => emitPerfReport(makeReport(400)));
    for (const line of lines) {
      // ~4076 bytes is the hard cap; assert well below it so metadata with
      // multi-byte characters still has headroom.
      expect(Buffer.byteLength(line, 'utf8')).toBeLessThan(3000);
    }
  });

  it('survives interleaved unrelated log output', () => {
    const original = makeReport(50);
    const lines = captureLog(() => emitPerfReport(original));

    const noisy: string[] = [];
    lines.forEach((line, i) => {
      noisy.push(`07-27 18:00:0${i % 10}.000  1234  5678 I ReactNativeJS: ${line}`);
      noisy.push('07-27 18:00:00.001  1234  5678 D SomeOtherTag: unrelated chatter');
    });

    const parsed = parsePerfReports(noisy.join('\n'));
    expect(parsed).toHaveLength(1);
    expect(parsed[0].ok).toBe(true);
    if (parsed[0].ok) expect(parsed[0].report.label).toBe('psalm-119');
  });

  it('parses a CRLF capture written on Windows', () => {
    // A capture taken through PowerShell arrives CRLF. `.` in a JavaScript regex
    // excludes `\r`, so `(.*)$` does not merely capture one stray character — it
    // fails to match at all, and every DATA line is silently skipped. That
    // reported as "missing chunk(s) 0..12 of 13" while all thirteen sat in the
    // file, which cost a debugging session chasing a transport that was fine.
    const original = makeReport(120);
    const lines = captureLog(() => emitPerfReport(original));

    const crlf = lines.map((line) => ` LOG  ${line}`).join('\r\n');
    const parsed = parsePerfReports(crlf);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].ok).toBe(true);
    if (parsed[0].ok) expect(parsed[0].report).toEqual(original);
  });

  it('parses multiple reports from one capture', () => {
    const lines = captureLog(() => {
      emitPerfReport(makeReport(20, 'genesis-1'));
      emitPerfReport(makeReport(20, 'matthew-5'));
    });

    const parsed = parsePerfReports(lines.join('\n'));
    expect(parsed).toHaveLength(2);
    expect(parsed.every((p) => p.ok)).toBe(true);
    expect(parsed.map((p) => (p.ok ? p.report.label : null))).toEqual(['genesis-1', 'matthew-5']);
  });
});

describe('perf log transport corruption detection', () => {
  it('reports a missing chunk instead of returning partial data', () => {
    const lines = captureLog(() => emitPerfReport(makeReport(200)));
    const dropped = lines.filter((l) => !isDataChunk(l, 3));
    // Assert the drop actually happened. Without this the test would pass
    // vacuously if the selector stopped matching the log format.
    expect(dropped.length).toBe(lines.length - 1);

    const parsed = parsePerfReports(dropped.join('\n'));
    expect(parsed).toHaveLength(1);
    expect(parsed[0].ok).toBe(false);
    if (parsed[0].ok) return;
    expect(parsed[0].reason).toMatch(/missing chunk\(s\) 3/);
  });

  it('detects a mutated chunk via the checksum', () => {
    const lines = captureLog(() => emitPerfReport(makeReport(200)));
    let mutated = 0;
    const tampered = lines.map((l) => {
      if (!isDataChunk(l, 2)) return l;
      mutated += 1;
      // Same length, different content — length alone cannot catch this, which
      // is exactly why the checksum is there.
      return l.replace(/9/g, '8');
    });
    expect(mutated).toBe(1);

    const parsed = parsePerfReports(tampered.join('\n'));
    expect(parsed[0].ok).toBe(false);
    if (!parsed[0].ok) expect(parsed[0].reason).toMatch(/checksum mismatch/);
  });

  it('reports a report whose END never arrived', () => {
    const lines = captureLog(() => emitPerfReport(makeReport(100)));
    const truncated = lines.filter((l) => !l.startsWith('[VMPERF-END]'));

    const parsed = parsePerfReports(truncated.join('\n'));
    expect(parsed).toHaveLength(1);
    expect(parsed[0].ok).toBe(false);
    if (!parsed[0].ok) expect(parsed[0].reason).toMatch(/no END marker/);
  });

  it('reports a capture that started mid-report', () => {
    const lines = captureLog(() => emitPerfReport(makeReport(100)));
    const startedLate = lines.filter((l) => !l.startsWith('[VMPERF-BEGIN]'));

    const parsed = parsePerfReports(startedLate.join('\n'));
    expect(parsed).toHaveLength(1);
    expect(parsed[0].ok).toBe(false);
    if (!parsed[0].ok) expect(parsed[0].reason).toMatch(/no matching BEGIN/);
  });

  it('returns nothing for log output containing no reports', () => {
    expect(parsePerfReports('just\nsome\nlogs')).toEqual([]);
  });
});

describe('formatPerfReport', () => {
  it('leads with JS blocks and includes the blocked percentage', () => {
    const out = formatPerfReport(makeReport(3));
    expect(out).toContain('psalm-119');
    expect(out).toContain('JS blocks: 7');
    expect(out).toContain('worst 690.2ms');
    // 1820.5 / 12345.6 = 14.7%
    expect(out).toContain('JS thread blocked 14.7% of the session');
    expect(out).toContain('chapter.mount');
  });

  it('warns loudly when records were dropped', () => {
    const out = formatPerfReport({ ...makeReport(3), truncated: true });
    expect(out).toContain('ring buffer overflowed');
  });
});
