import { sheetDragDecision, sheetDragDismisses } from '@/lib/bible/sheet-drag';

describe('sheetDragDecision', () => {
  it('takes a downward drag when the analysis is at its top', () => {
    expect(sheetDragDecision(0, 40)).toBe('activate');
  });

  it('leaves a drag to the scroll view once the analysis is scrolled down', () => {
    expect(sheetDragDecision(200, 40)).toBe('fail');
  });

  it('leaves an upward drag to the scroll view, so the analysis can be read on', () => {
    expect(sheetDragDecision(0, -40)).toBe('fail');
  });

  it('waits while the finger has barely moved', () => {
    expect(sheetDragDecision(0, 3)).toBe('wait');
  });
});

describe('sheetDragDismisses', () => {
  it('closes on a long drag or a short flick, and springs back otherwise', () => {
    expect(sheetDragDismisses(80, 0)).toBe(true);
    expect(sheetDragDismisses(30, 900)).toBe(true);
    expect(sheetDragDismisses(30, 100)).toBe(false);
  });
});
