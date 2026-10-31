/**
 * useWordChoices — switching between the words of a multi-word Define, across the two sheets.
 */

import { act, renderHook } from '@testing-library/react-native';
import { useWordChoices } from '@/hooks/bible/use-word-choices';
import type { DefineChoice } from '@/lib/text/ParagraphText';

const lexiconArgs = { surface: 'testimony', token: { lemma: 'G3141' }, entry: {}, isTheme: false };
const CHOICES = [
  { label: 'testimony', word: 'testimony', verseNumber: 19, lexicon: lexiconArgs },
  { label: 'priests', word: 'priests', verseNumber: 19 },
] as unknown as DefineChoice[];

function setup() {
  const openers = {
    openLexicon: jest.fn(),
    openWord: jest.fn(),
    closeLexicon: jest.fn(),
    closeWord: jest.fn(),
  };
  const hook = renderHook(() => useWordChoices(openers));
  return { openers, hook };
}

describe('useWordChoices', () => {
  it('opens the first word and offers every word as a chip', () => {
    const { openers, hook } = setup();
    act(() => hook.result.current.start(CHOICES));

    expect(openers.closeWord).toHaveBeenCalled();
    expect(openers.openLexicon).toHaveBeenCalledWith(lexiconArgs);
    expect(hook.result.current.sheetProps).toMatchObject({
      wordChoices: ['testimony', 'priests'],
      activeWordChoice: 0,
    });
  });

  it('switches to a dictionary word by swapping the sheet, keeping the chips', () => {
    const { openers, hook } = setup();
    act(() => hook.result.current.start(CHOICES));
    act(() => hook.result.current.sheetProps.onChooseWord?.(1));

    expect(openers.closeLexicon).toHaveBeenCalled();
    expect(openers.openWord).toHaveBeenCalledWith({ word: 'priests', verseNumber: 19 });
    // The lexicon sheet reports its close as it is swapped out; that must not drop the chips.
    act(() => hook.result.current.closedSheet('lexicon'));
    expect(hook.result.current.sheetProps).toMatchObject({ activeWordChoice: 1 });
  });

  it('ends the choices when the reader closes the sheet that is showing', () => {
    const { hook } = setup();
    act(() => hook.result.current.start(CHOICES));
    act(() => hook.result.current.closedSheet('lexicon'));
    expect(hook.result.current.sheetProps).toEqual({});
  });
});
