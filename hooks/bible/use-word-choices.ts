/**
 * Define on a multi-word selection: which selected word's definition is showing, and switching.
 *
 * The reader and the Life of Jesus passages each own a Greek/Hebrew card and an English dictionary
 * sheet. A choice opens the right one and closes the other, so moving from "testimony" (a lexicon
 * word) to "witness" (dictionary only) swaps the sheet while the chip row stays the same.
 */

import { useCallback, useRef, useState } from 'react';
import type { DefineChoice, LexiconWordArgs } from '@/lib/text/ParagraphText';

interface Openers {
  openLexicon: (args: LexiconWordArgs) => void;
  openWord: (args: { word: string; verseNumber: number }) => void;
  closeLexicon: () => void;
  closeWord: () => void;
}

export function useWordChoices({ openLexicon, openWord, closeLexicon, closeWord }: Openers) {
  const [state, setStateRaw] = useState<{ choices: DefineChoice[]; index: number } | null>(null);
  // Mirrors `state` for the callbacks, which open sheets and so must not run inside an updater.
  const stateRef = useRef(state);
  const setState = useCallback((next: typeof state) => {
    stateRef.current = next;
    setStateRaw(next);
  }, []);

  const show = useCallback(
    (choice: DefineChoice) => {
      if (choice.lexicon) {
        closeWord();
        openLexicon(choice.lexicon);
      } else {
        closeLexicon();
        openWord({ word: choice.word, verseNumber: choice.verseNumber });
      }
    },
    [openLexicon, openWord, closeLexicon, closeWord]
  );

  /** Define on a selection: remember its words and open the first. */
  const start = useCallback(
    (choices: DefineChoice[]) => {
      if (choices.length === 0) return;
      setState({ choices, index: 0 });
      show(choices[0]);
    },
    [show, setState]
  );

  const choose = useCallback(
    (index: number) => {
      const current = stateRef.current;
      if (!current || !current.choices[index]) return;
      setState({ ...current, index });
      show(current.choices[index]);
    },
    [show, setState]
  );

  /**
   * A sheet was closed by the reader. Only the sheet showing the current choice ends the choices: the
   * other one also reports a close when a switch swaps it out, and that must not drop the chips.
   */
  const closedSheet = useCallback(
    (kind: 'lexicon' | 'word') => {
      const current = stateRef.current;
      if (!current) return;
      const showing = current.choices[current.index]?.lexicon ? 'lexicon' : 'word';
      if (showing === kind) setState(null);
    },
    [setState]
  );

  /** Props for either sheet's chip row; empty when there is nothing to choose between. */
  const sheetProps =
    state && state.choices.length > 1
      ? {
          wordChoices: state.choices.map((c) => c.label),
          activeWordChoice: state.index,
          onChooseWord: choose,
        }
      : {};

  return { start, closedSheet, sheetProps };
}
