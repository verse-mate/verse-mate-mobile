/**
 * Tests for the `VMText` fallback path.
 *
 * Jest has no native module, so these exercise the RN `<Text>` fallback — which
 * is exactly the path web and Expo Go take, and therefore worth its own coverage
 * rather than being treated as a stub. The native path is verified on device
 * (Phase 2 exit criterion: pixel-identical to RN `<Text>`).
 */

import { render } from '@testing-library/react-native';
import type { TextRange } from '@/modules/versemate-text';
import { isNativeTextAvailable, VMText } from '@/modules/versemate-text';

/** Flatten the rendered tree into text plus the effective style per character. */
function flatten(
  node: unknown,
  inherited: Record<string, unknown>
): {
  text: string;
  chars: Record<string, unknown>[];
} {
  if (typeof node === 'string') {
    return { text: node, chars: Array.from(node, () => ({ ...inherited })) };
  }
  if (node == null || typeof node !== 'object') return { text: '', chars: [] };

  const element = node as { props?: { style?: unknown }; children?: unknown[] };
  const style = Object.assign({}, ...toArray(element.props?.style)) as Record<string, unknown>;
  const next = { ...inherited, ...style };

  let text = '';
  const chars: Record<string, unknown>[] = [];
  for (const child of element.children ?? []) {
    const part = flatten(child, next);
    text += part.text;
    chars.push(...part.chars);
  }
  return { text, chars };
}

function toArray(style: unknown): object[] {
  if (!style) return [];
  if (Array.isArray(style)) return style.flatMap(toArray);
  return typeof style === 'object' ? [style] : [];
}

function renderFlat(text: string, ranges?: TextRange[]) {
  const tree = render(<VMText text={text} ranges={ranges} />).toJSON();
  if (!tree || Array.isArray(tree)) throw new Error('expected a single root');
  return flatten(tree, {});
}

const TEXT = 'In the beginning God created.';

describe('VMText fallback', () => {
  it('reports native as unavailable under Jest', () => {
    // Guards the premise of this whole file: if native ever did resolve here,
    // these tests would silently be exercising a different code path.
    expect(isNativeTextAvailable()).toBe(false);
  });

  it('renders plain text with no ranges', () => {
    expect(renderFlat(TEXT).text).toBe(TEXT);
  });

  it('preserves the text exactly when ranges split it', () => {
    // Boundary-splitting must be lossless — a dropped character would shift every
    // subsequent offset and misplace every decoration after it.
    const flat = renderFlat(TEXT, [
      { start: 3, end: 6, backgroundColor: '#ff000059' },
      { start: 17, end: 20, underline: { style: 'dotted', color: '#b09a6d', thickness: 1 } },
    ]);
    expect(flat.text).toBe(TEXT);
    expect(flat.chars).toHaveLength(TEXT.length);
  });

  it('applies a background only to the covered characters', () => {
    const flat = renderFlat(TEXT, [{ start: 3, end: 6, backgroundColor: '#ff000059' }]);
    expect(flat.chars[2].backgroundColor).toBeUndefined();
    expect(flat.chars[3].backgroundColor).toBe('#ff000059');
    expect(flat.chars[5].backgroundColor).toBe('#ff000059');
    expect(flat.chars[6].backgroundColor).toBeUndefined();
  });

  it('applies an underline to the covered characters', () => {
    const flat = renderFlat(TEXT, [
      { start: 17, end: 20, underline: { style: 'dotted', color: '#b09a6d', thickness: 1 } },
    ]);
    expect(flat.chars[17].textDecorationLine).toBe('underline');
    expect(flat.chars[17].textDecorationColor).toBe('#b09a6d');
    expect(flat.chars[20].textDecorationLine).toBeUndefined();
  });

  it('merges partially overlapping ranges without losing either', () => {
    // Overlap is why the fallback splits at boundaries instead of nesting: a
    // lexicon underline crossing a highlight edge cannot be expressed by nesting.
    const flat = renderFlat(TEXT, [
      { start: 0, end: 10, backgroundColor: '#ffff0059' },
      { start: 5, end: 15, underline: { style: 'solid', color: '#b09a6d', thickness: 1 } },
    ]);

    // Before the overlap: background only.
    expect(flat.chars[2]).toMatchObject({ backgroundColor: '#ffff0059' });
    expect(flat.chars[2].textDecorationLine).toBeUndefined();
    // Inside the overlap: both.
    expect(flat.chars[7]).toMatchObject({
      backgroundColor: '#ffff0059',
      textDecorationLine: 'underline',
    });
    // After the overlap: underline only.
    expect(flat.chars[12].backgroundColor).toBeUndefined();
    expect(flat.chars[12].textDecorationLine).toBe('underline');
  });

  it('lets a later range win on a conflicting attribute', () => {
    // Array order is the layering contract, matching how the native side stacks
    // spans. lib/text relies on it via RANGE_LAYER.
    const flat = renderFlat(TEXT, [
      { start: 0, end: 10, backgroundColor: '#111111ff' },
      { start: 0, end: 10, backgroundColor: '#222222ff' },
    ]);
    expect(flat.chars[5].backgroundColor).toBe('#222222ff');
  });

  it('tolerates a range that spans the whole string', () => {
    const flat = renderFlat(TEXT, [{ start: 0, end: TEXT.length, color: '#c1121f' }]);
    expect(flat.text).toBe(TEXT);
    expect(flat.chars.every((c) => c.color === '#c1121f')).toBe(true);
  });

  it('renders an empty string without crashing', () => {
    expect(renderFlat('').text).toBe('');
  });
});
