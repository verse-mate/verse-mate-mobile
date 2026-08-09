/**
 * The encoded-range transport.
 *
 * This format exists because an array prop crashed the native setter through Expo's
 * pooled `Dynamic` converter, which rendered a blank screen behind a normal-looking view
 * hierarchy. The format is therefore load-bearing, and its two halves live in different
 * languages — `encodeRanges` here and `decodeRanges` in VMTextModule.kt. A decoder written
 * against the same spec is tested here so a change to one side that breaks the other fails
 * in CI rather than on a device.
 */

import type { TextRange } from '@/modules/versemate-text/src/types';
import { encodeRangesForTest } from '@/modules/versemate-text/src/VMText';

/** Mirrors decodeRanges in VMTextModule.kt, field for field. */
function decodeLikeKotlin(encoded: string) {
  if (!encoded) return [];
  return encoded
    .split('|')
    .filter((c) => c.length > 0)
    .map((chunk) => chunk.split('~'))
    .filter((f) => f.length >= 11)
    .map((f) => ({
      start: Number.parseInt(f[0], 10) || 0,
      end: Number.parseInt(f[1], 10) || 0,
      underlineStyle: f[2] || null,
      underlineColor: f[3] || null,
      underlineThickness: f[4] === '' ? null : Number.parseFloat(f[4]),
      backgroundColor: f[5] || null,
      color: f[6] || null,
      fontWeight: f[7] || null,
      fontScale: f[8] === '' ? null : Number.parseFloat(f[8]),
      baselineShift: f[9] === '' ? null : Number.parseFloat(f[9]),
      interactive: f[10] === '1',
      // getOrNull(11) in Kotlin: absent on chunks written before fontStyle existed.
      fontStyle: f[11] || null,
    }));
}

describe('encodeRanges', () => {
  it('is empty for no ranges', () => {
    expect(encodeRangesForTest(undefined)).toBe('');
    expect(encodeRangesForTest([])).toBe('');
  });

  it('round-trips a full range', () => {
    const range: TextRange = {
      start: 3,
      end: 11,
      underline: { style: 'dotted', color: 'rgba(176,154,109,0.55)', thickness: 1 },
      backgroundColor: '#ffcc0059',
      color: '#c1121f',
      fontWeight: 'bold',
      fontStyle: 'italic',
      fontScale: 0.7,
      baselineShift: 0.35,
      interactive: true,
    };
    const [decoded] = decodeLikeKotlin(encodeRangesForTest([range]));
    expect(decoded).toEqual({
      start: 3,
      end: 11,
      underlineStyle: 'dotted',
      underlineColor: 'rgba(176,154,109,0.55)',
      underlineThickness: 1,
      backgroundColor: '#ffcc0059',
      color: '#c1121f',
      fontWeight: 'bold',
      fontStyle: 'italic',
      fontScale: 0.7,
      baselineShift: 0.35,
      interactive: true,
    });
  });

  it('round-trips a minimal range, leaving absent fields absent', () => {
    const [decoded] = decodeLikeKotlin(encodeRangesForTest([{ start: 0, end: 4 }]));
    expect(decoded.underlineStyle).toBeNull();
    expect(decoded.backgroundColor).toBeNull();
    expect(decoded.fontScale).toBeNull();
    expect(decoded.interactive).toBe(false);
  });

  it('keeps many ranges in order', () => {
    const ranges: TextRange[] = [
      { start: 0, end: 1 },
      { start: 2, end: 3, interactive: true },
      { start: 4, end: 5, color: '#fff' },
    ];
    const decoded = decodeLikeKotlin(encodeRangesForTest(ranges));
    expect(decoded.map((d) => [d.start, d.end])).toEqual([
      [0, 1],
      [2, 3],
      [4, 5],
    ]);
    expect(decoded[1].interactive).toBe(true);
    expect(decoded[2].color).toBe('#fff');
  });

  it('never emits a delimiter that would corrupt the stream', () => {
    // rgba() colours contain commas and parens but must never contain ~ or |.
    const encoded = encodeRangesForTest([
      {
        start: 0,
        end: 1,
        backgroundColor: 'rgba(1,2,3,0.4)',
        underline: { style: 'dotted', color: 'rgba(5,6,7,0.8)', thickness: 1.5 },
      },
    ]);
    expect(encoded.split('|')).toHaveLength(1);
    // 12 fields since fontStyle was appended. Update this number ONLY by appending: the position of
    // every field is the contract with decodeRanges in VMTextModule.kt, and inserting one instead
    // makes every later field decode as its neighbour's value — wrong colours rather than an error.
    expect(encoded.split('~')).toHaveLength(12);
  });

  it('decodes a chunk written before fontStyle existed', () => {
    // The reason fontStyle went LAST. An older JS bundle emits 11 fields; Kotlin reads index 11 with
    // getOrNull, so such a chunk must still decode fully rather than be skipped as malformed.
    const legacy = '0~4~dotted~#fff~1~~#000~bold~0.7~0.35~1';
    const [decoded] = decodeLikeKotlin(legacy);
    expect(decoded.start).toBe(0);
    expect(decoded.interactive).toBe(true);
    expect(decoded.fontWeight).toBe('bold');
    expect(decoded.fontStyle).toBeNull();
  });

  it('carries fontStyle independently of fontWeight', () => {
    // Both axes must survive together: the native side composes them into one Typeface style, and
    // markdown routinely nests emphasis inside strong.
    const [both] = decodeLikeKotlin(
      encodeRangesForTest([{ start: 0, end: 3, fontWeight: '700', fontStyle: 'italic' }])
    );
    expect(both.fontWeight).toBe('700');
    expect(both.fontStyle).toBe('italic');

    const [italicOnly] = decodeLikeKotlin(
      encodeRangesForTest([{ start: 0, end: 3, fontStyle: 'italic' }])
    );
    expect(italicOnly.fontWeight).toBeNull();
    expect(italicOnly.fontStyle).toBe('italic');
  });
});
