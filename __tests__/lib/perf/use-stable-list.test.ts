/**
 * Identity stability for derived arrays.
 *
 * This exists because filtering highlights per chapter — a correctness fix — made the app
 * measurably slower: a fresh array on every render of every page, with source arrays that
 * churn identity constantly, took reader.render.bible to 889 renders and
 * paragraph.compile to 999 calls across ~20 chapter changes. The property under test is
 * therefore identity, not contents, and it is easy to reintroduce by "simplifying" this
 * hook away.
 */

import { renderHook } from '@testing-library/react-native';
import { useStableList } from '@/lib/perf/use-stable-list';

const key = (n: { id: number }) => String(n.id);

describe('useStableList', () => {
  it('returns the same array when contents are unchanged', () => {
    const { result, rerender } = renderHook(({ list }) => useStableList(list, key), {
      initialProps: { list: [{ id: 1 }, { id: 2 }] },
    });
    const first = result.current;
    // A NEW array with identical contents — the exact case that caused the churn.
    rerender({ list: [{ id: 1 }, { id: 2 }] });
    expect(result.current).toBe(first);
  });

  it('returns a new array when contents change', () => {
    const { result, rerender } = renderHook(({ list }) => useStableList(list, key), {
      initialProps: { list: [{ id: 1 }] },
    });
    const first = result.current;
    rerender({ list: [{ id: 1 }, { id: 2 }] });
    expect(result.current).not.toBe(first);
    expect(result.current).toHaveLength(2);
  });

  it('notices a change of order', () => {
    const { result, rerender } = renderHook(({ list }) => useStableList(list, key), {
      initialProps: { list: [{ id: 1 }, { id: 2 }] },
    });
    const first = result.current;
    rerender({ list: [{ id: 2 }, { id: 1 }] });
    expect(result.current).not.toBe(first);
  });

  it('handles empty lists without churning', () => {
    const { result, rerender } = renderHook(({ list }) => useStableList(list, key), {
      initialProps: { list: [] as { id: number }[] },
    });
    const first = result.current;
    rerender({ list: [] });
    expect(result.current).toBe(first);
  });

  it('notices a field the key covers', () => {
    const colourKey = (h: { id: number; color: string }) => `${h.id}:${h.color}`;
    const { result, rerender } = renderHook(({ list }) => useStableList(list, colourKey), {
      initialProps: { list: [{ id: 1, color: 'yellow' }] },
    });
    const first = result.current;
    rerender({ list: [{ id: 1, color: 'green' }] });
    expect(result.current).not.toBe(first);
  });
});
