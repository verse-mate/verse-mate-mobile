/**
 * Bible Interaction Context
 *
 * Manages state and logic for verse interactions (highlights, tooltips, selection)
 * at the screen level to allow overlays to render above the SplitView layout.
 *
 * This enables the "Side Panel" UX for tooltips in landscape mode.
 */

import { AutoHighlightTooltip } from '@/components/bible/AutoHighlightTooltip';
import { HighlightEditMenu } from '@/components/bible/HighlightEditMenu';
import {
  type HighlightScope,
  type HighlightSheetActions,
  HighlightSelectionSheet,
  type VerseRange,
} from '@/components/bible/HighlightSelectionSheet';
import { SimpleColorPickerModal } from '@/components/bible/SimpleColorPickerModal';
import { VerseMateTooltip } from '@/components/bible/VerseMateTooltip';
import { getBookById } from '@/constants/bible-books';
import type { HighlightColor } from '@/constants/highlight-colors';
import { useAuth } from '@/contexts/AuthContext';
import { useOfflineContext } from '@/contexts/OfflineContext';
import { useToast } from '@/contexts/ToastContext';
import { useAutoHighlights } from '@/hooks/bible/use-auto-highlights';
import { type Highlight, useHighlights } from '@/hooks/bible/use-highlights';
import type { VersemateTooltipSource } from '@/lib/analytics/types';
import { useBibleVersion } from '@/hooks/use-bible-version';
import { useDeviceInfo } from '@/hooks/use-device-info';
import {
  collectBookOccurrences,
  HIGHLIGHT_ALL_CONFIRM_ABOVE,
} from '@/lib/highlights/highlight-all';
import { bibleChapterQuery, chapterFromQueryData } from '@/src/api/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import type { AutoHighlight } from '@/types/auto-highlights';
import { type HighlightGroup } from '@/utils/bible/groupConsecutiveHighlights';
import { useTranslation } from 'react-i18next';
import React, { createContext, useContext, useMemo, useRef, useState } from 'react';

interface BibleInteractionContextType {
  // Data
  chapterHighlights: Highlight[];
  autoHighlights: AutoHighlight[];
  
  // Actions
  addHighlight: (data: any) => Promise<void>;
  updateHighlightColor: (id: number, color: HighlightColor) => Promise<void>;
  deleteHighlight: (id: number) => Promise<void>;
  
  // Interaction Triggers
  openVerseTooltip: (verseNumber: number | null, highlightGroup: HighlightGroup | null, verseText: string | undefined, source: VersemateTooltipSource) => void;
  openAutoHighlightTooltip: (autoHighlight: AutoHighlight) => void;
  openHighlightSelection: (range: VerseRange, text: string, actions?: HighlightSheetActions) => void;
  openHighlightEditMenu: (id: number, color: HighlightColor) => void;
  closeAll: () => void;
}

const BibleInteractionContext = createContext<BibleInteractionContextType | null>(null);

interface BibleInteractionProviderProps {
  children: React.ReactNode;
  bookId: number;
  chapterNumber: number;
  bookName: string;
}

export function BibleInteractionProvider({ 
  children, 
  bookId, 
  chapterNumber,
  bookName 
}: BibleInteractionProviderProps) {
  const { useSplitView } = useDeviceInfo();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { t } = useTranslation();
  
  // Hooks for data
  const { chapterHighlights, addHighlight, addHighlights, updateHighlightColor, deleteHighlight } =
    useHighlights({
      bookId,
      chapterNumber,
    });
  const queryClient = useQueryClient();
  const { isOnline, downloadedBibleBooks } = useOfflineContext();
  const { bibleVersion } = useBibleVersion();
  const { autoHighlights } = useAutoHighlights({
    bookId,
    chapterNumber,
  });

  // State for Tooltips/Modals
  const [verseTooltipState, setVerseTooltipState] = useState<{
    visible: boolean;
    verseNumber: number | null;
    highlightGroup: HighlightGroup | null;
    verseText?: string;
    source: VersemateTooltipSource;
  }>({ visible: false, verseNumber: null, highlightGroup: null, source: 'unknown' });

  const [autoHighlightState, setAutoHighlightState] = useState<{
    visible: boolean;
    autoHighlight: AutoHighlight | null;
  }>({ visible: false, autoHighlight: null });

  const [selectionSheetState, setSelectionSheetState] = useState<{
    visible: boolean;
    range: VerseRange;
    text: string;
    actions?: HighlightSheetActions;
  }>({ visible: false, range: { start: 0, end: 0 }, text: '' });

  const [editMenuState, setEditMenuState] = useState<{
    visible: boolean;
    id: number | null;
    color: HighlightColor;
  }>({ visible: false, id: null, color: 'yellow' });

  const [colorPickerState, setColorPickerState] = useState<{
    visible: boolean;
    verseNumber: number | null;
    text?: string;
  }>({ visible: false, verseNumber: null });

  // Actions
  const openVerseTooltip = (
    verseNumber: number | null,
    highlightGroup: HighlightGroup | null,
    verseText: string | undefined,
    // No default. A default is how a new opener silently reports as an old one,
    // which is the entire reason this field exists.
    source: VersemateTooltipSource
  ) => {
    // Close AutoHighlightTooltip if open
    setAutoHighlightState(prev => ({ ...prev, visible: false }));
    setVerseTooltipState({ visible: true, verseNumber, highlightGroup, verseText, source });
  };

  const openAutoHighlightTooltip = (autoHighlight: AutoHighlight) => {
    // Close VerseMateTooltip if open
    setVerseTooltipState(prev => ({ ...prev, visible: false }));
    setAutoHighlightState({ visible: true, autoHighlight });
  };

  const openHighlightSelection = (
    range: VerseRange,
    text: string,
    actions?: HighlightSheetActions
  ) => {
    // Saving needs an account; without one the sheet would accept a colour and silently drop it.
    if (!user) {
      showToast(t('highlights.sign_in_to_save', 'Sign in to save highlights'));
      return;
    }
    setSelectionSheetState({ visible: true, range, text, actions });
  };

  const openHighlightEditMenu = (id: number, color: HighlightColor) => {
    setEditMenuState({ visible: true, id, color });
  };

  const closeAll = () => {
    setVerseTooltipState(prev => ({ ...prev, visible: false }));
    setAutoHighlightState(prev => ({ ...prev, visible: false }));
    setSelectionSheetState(prev => ({ ...prev, visible: false }));
    setEditMenuState(prev => ({ ...prev, visible: false }));
    setColorPickerState(prev => ({ ...prev, visible: false }));
  };

  // --- Handlers ---

  const handleSaveFromVerseTooltip = () => {
    if (verseTooltipState.verseNumber) {
      // Close tooltip and open color picker
      setVerseTooltipState(prev => ({ ...prev, visible: false }));

      setColorPickerState({
          visible: true,
          verseNumber: verseTooltipState.verseNumber,
          text: verseTooltipState.verseText
      });
    }
  };

  const handleRemoveFromTooltip = async (group: HighlightGroup) => {
    setVerseTooltipState(prev => ({ ...prev, visible: false }));
    try {
      await Promise.all(group.highlights.map((h) => deleteHighlight(h.highlight_id)));
      showToast('Highlight group removed');
    } catch (error) {
      console.error('Failed to remove highlight group:', error);
      showToast('Failed to remove highlight group');
    }
  };

  const handleChangeColorFromTooltip = (group: HighlightGroup) => {
    setVerseTooltipState(prev => ({ ...prev, visible: false }));
    const first = group.highlights[0];
    if (first) {
        openHighlightEditMenu(first.highlight_id, first.color as HighlightColor);
    }
  };

  /**
   * "Highlight all": every place the selected words occur in this book, in one colour.
   *
   * Reads the book chapter by chapter through the reader's own chapter query (cached, and the
   * device's copy for a downloaded book), so the offsets match the text on screen. A large count
   * asks first.
   */
  const highlightAllInBook = async (phrase: string, color: HighlightColor) => {
    if (!isOnline) {
      showToast(t('highlights.highlight_all_offline', 'Highlight all needs a connection'));
      return;
    }
    const chapterCount = getBookById(bookId)?.chapterCount ?? 0;
    const isLocal = (downloadedBibleBooks?.[bibleVersion] ?? []).includes(bookId);
    showToast(`Finding \u201C${phrase}\u201D in ${bookName}\u2026`);
    const { occurrences, missingChapters } = await collectBookOccurrences({
      phrase,
      chapterCount,
      loadChapter: async (chapter) => {
        const query = bibleChapterQuery(bookId, chapter, bibleVersion, isLocal);
        const data = await queryClient.fetchQuery({
          ...query,
          staleTime: Number.POSITIVE_INFINITY,
          networkMode: 'always',
        });
        const content = chapterFromQueryData(data);
        return content
          ? content.sections.flatMap((section) =>
              section.verses.map((verse) => ({ verseNumber: verse.verseNumber, text: verse.text }))
            )
          : null;
      },
    });
    if (occurrences.length === 0) {
      showToast(`\u201C${phrase}\u201D was not found in ${bookName}`);
      return;
    }
    const save = async () => {
      const saved = await addHighlights(
        occurrences.map((o) => ({
          bookId,
          chapterNumber: o.chapter,
          startVerse: o.verse,
          endVerse: o.verse,
          startChar: o.start,
          endChar: o.end,
          color,
          selectedText: o.text,
        }))
      );
      const partial = missingChapters.length > 0 ? ' (some chapters could not be read)' : '';
      showToast(`Highlighted ${saved} of ${occurrences.length} in ${bookName}${partial}`);
    };
    if (occurrences.length > HIGHLIGHT_ALL_CONFIRM_ABOVE) {
      Alert.alert(
        `Highlight ${occurrences.length} places?`,
        `\u201C${phrase}\u201D appears ${occurrences.length} times in ${bookName}.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Highlight all', onPress: () => void save() },
        ]
      );
      return;
    }
    await save();
  };

  /** A colour from the highlight sheet, for the scope the reader picked there. */
  const handleSelectionColor = async (color: HighlightColor, scope: HighlightScope) => {
    const { range, text } = selectionSheetState;
    setSelectionSheetState((prev) => ({ ...prev, visible: false }));
    try {
      if (scope === 'book') {
        await highlightAllInBook(text, color);
        return;
      }
      const wholeVerses = scope === 'verse';
      await addHighlight({
        bookId,
        chapterNumber,
        startVerse: range.start,
        endVerse: range.end,
        startChar: wholeVerses ? undefined : range.startChar,
        endChar: wholeVerses ? undefined : range.endChar,
        color,
        selectedText: wholeVerses ? undefined : text,
      });
    } catch (e) {
      console.error(e);
      showToast('Failed to create highlight');
    }
  };

  const handleColorPickerSave = async (color: HighlightColor) => {
    if (!colorPickerState.verseNumber) return;

    const verseNum = colorPickerState.verseNumber;
    setColorPickerState(prev => ({ ...prev, visible: false }));

    try {
      await addHighlight({
        bookId,
        chapterNumber,
        startVerse: verseNum,
        endVerse: verseNum,
        color,
        selectedText: colorPickerState.text || `Verse ${verseNum}`,
      });
      showToast('Highlight saved!');
    } catch (error) {
      console.error('Failed to save highlight:', error);
      showToast('Failed to save highlight');
    }
  };

  const handleSaveAutoHighlight = async (
    color: HighlightColor,
    verseRange: { start: number; end: number },
    selectedText?: string
  ) => {
    try {
      await addHighlight({
        bookId,
        chapterNumber,
        startVerse: verseRange.start,
        endVerse: verseRange.end,
        color,
        selectedText,
      });
      showToast('Highlight saved!');
      setAutoHighlightState(prev => ({ ...prev, visible: false }));
    } catch (error) {
      console.error('Failed to save auto-highlight:', error);
      showToast('Failed to save highlight');
    }
  };

  /**
   * Latest implementations of every action, refreshed on each render.
   *
   * None of these are stable on their own: the three mutations come from
   * `useHighlights`, which has no `useCallback` anywhere, and the five triggers
   * are declared inline. So a `useMemo` over them as dependencies would rebuild
   * on every render and achieve nothing.
   */
  const latestActions = useRef({
    addHighlight,
    updateHighlightColor,
    deleteHighlight,
    openVerseTooltip,
    openAutoHighlightTooltip,
    openHighlightSelection,
    openHighlightEditMenu,
    closeAll,
  });
  latestActions.current = {
    addHighlight,
    updateHighlightColor,
    deleteHighlight,
    openVerseTooltip,
    openAutoHighlightTooltip,
    openHighlightSelection,
    openHighlightEditMenu,
    closeAll,
  };

  /**
   * Stable action facade — created once, always delegating to the latest impl.
   *
   * Every call forwards its arguments and RETURNS the inner result, which
   * matters because callers `await` the mutations.
   */
  const actions = useMemo(
    () => ({
      addHighlight: (data: any) => latestActions.current.addHighlight(data),
      updateHighlightColor: (id: number, color: HighlightColor) =>
        latestActions.current.updateHighlightColor(id, color),
      deleteHighlight: (id: number) => latestActions.current.deleteHighlight(id),
      // Every parameter has to be forwarded explicitly here. This facade is what
      // consumers actually hold, and a three-argument function is assignable to a
      // four-argument type, so a forgotten parameter type-checks clean and drops
      // the value on the floor.
      openVerseTooltip: (
        verseNumber: number | null,
        highlightGroup: HighlightGroup | null,
        verseText: string | undefined,
        source: VersemateTooltipSource
      ) =>
        latestActions.current.openVerseTooltip(verseNumber, highlightGroup, verseText, source),
      openAutoHighlightTooltip: (autoHighlight: AutoHighlight) =>
        latestActions.current.openAutoHighlightTooltip(autoHighlight),
      openHighlightSelection: (range: VerseRange, text: string, actions?: HighlightSheetActions) =>
        latestActions.current.openHighlightSelection(range, text, actions),
      openHighlightEditMenu: (id: number, color: HighlightColor) =>
        latestActions.current.openHighlightEditMenu(id, color),
      closeAll: () => latestActions.current.closeAll(),
    }),
    []
  );

  /**
   * The context value now changes only when the DATA changes.
   *
   * Before this, `value` was a fresh object literal on every render of the
   * provider — and the provider re-renders on any of its five pieces of modal
   * state, plus whenever its query hooks re-render. Every consumer re-rendered
   * each time, whether or not anything it reads had moved. The re-render probe
   * measured it: `render.page.by.bibleInteraction` fired 83 times in a
   * 45-second swipe session, which is what produced the ~100 ChapterReader
   * renders attributed to `nothing-tracked`. Each of those is a React commit
   * Fabric has to diff against the whole live tree, and that diff
   * (`completeRoot`) is the single largest cost in the CPU profile.
   */
  const value = useMemo(
    () => ({ chapterHighlights, autoHighlights, ...actions }),
    [chapterHighlights, autoHighlights, actions]
  );

  return (
    <BibleInteractionContext.Provider value={value}>
      {children}
      
      {/* Overlays rendered at Root Level */}
      
      <VerseMateTooltip
        key={`tooltip-${!!user}`}
        visible={verseTooltipState.visible}
        source={verseTooltipState.source}
        verseNumber={verseTooltipState.verseNumber}
        highlightGroup={verseTooltipState.highlightGroup}
        bookId={bookId}
        chapterNumber={chapterNumber}
        bookName={bookName}
        onClose={() => setVerseTooltipState(prev => ({ ...prev, visible: false }))}
        isLoggedIn={!!user}
        useModal={!useSplitView}
        verseText={verseTooltipState.verseText} // Pass the text!
        // Interaction Handlers
        onSaveAsHighlight={handleSaveFromVerseTooltip}
        onRemoveHighlight={handleRemoveFromTooltip}
        onChangeColor={handleChangeColorFromTooltip}
        onCopy={() => showToast('Verse copied to clipboard')}
      />

      <AutoHighlightTooltip
        visible={autoHighlightState.visible}
        autoHighlight={autoHighlightState.autoHighlight}
        onClose={() => setAutoHighlightState(prev => ({ ...prev, visible: false }))}
        bookName={bookName}
        isLoggedIn={!!user}
        useModal={!useSplitView}
        onSaveAsUserHighlight={handleSaveAutoHighlight}
        onCopy={() => showToast('Text copied')}
      />
      
      <HighlightSelectionSheet
        visible={selectionSheetState.visible}
        verseRange={selectionSheetState.range}
        text={selectionSheetState.text}
        actions={selectionSheetState.actions}
        bookName={bookName}
        canHighlightAll
        onClose={() => setSelectionSheetState(prev => ({ ...prev, visible: false }))}
        onColorSelect={handleSelectionColor}
        useModal={!useSplitView}
      />
      
      <HighlightEditMenu
        visible={editMenuState.visible}
        currentColor={editMenuState.color}
        onClose={() => setEditMenuState(prev => ({ ...prev, visible: false }))}
        onColorChange={async (color) => {
            if (editMenuState.id) {
                await updateHighlightColor(editMenuState.id, color);
                setEditMenuState(prev => ({ ...prev, visible: false }));
            }
        }}
        onDelete={async () => {
            if (editMenuState.id) {
                await deleteHighlight(editMenuState.id);
                setEditMenuState(prev => ({ ...prev, visible: false }));
            }
        }}
        useModal={!useSplitView}
      />

      <SimpleColorPickerModal
        visible={colorPickerState.visible}
        onClose={() => setColorPickerState(prev => ({ ...prev, visible: false }))}
        onSave={handleColorPickerSave}
        useModal={!useSplitView}
      />
      
    </BibleInteractionContext.Provider>
  );
}

export function useBibleInteraction() {
  const context = useContext(BibleInteractionContext);
  if (!context) {
    throw new Error('useBibleInteraction must be used within a BibleInteractionProvider');
  }
  return context;
}

/**
 * The interaction surface if there is one, otherwise null.
 *
 * The throwing version is right inside the reader, where a missing provider is
 * a wiring bug. It is wrong for a component that renders in BOTH a provided and
 * an unprovided context — the Jesus passage block, which opens Verse Insight in
 * place when it has a provider and falls back to opening the reader when it
 * does not.
 */
export function useOptionalBibleInteraction() {
  return useContext(BibleInteractionContext) ?? null;
}
