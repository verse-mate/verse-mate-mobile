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
import { HighlightSelectionSheet, type VerseRange } from '@/components/bible/HighlightSelectionSheet';
import { SimpleColorPickerModal } from '@/components/bible/SimpleColorPickerModal';
import { VerseMateTooltip } from '@/components/bible/VerseMateTooltip';
import type { HighlightColor } from '@/constants/highlight-colors';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useAutoHighlights } from '@/hooks/bible/use-auto-highlights';
import { type Highlight, useHighlights } from '@/hooks/bible/use-highlights';
import { useDeviceInfo } from '@/hooks/use-device-info';
import type { AutoHighlight } from '@/types/auto-highlights';
import { type HighlightGroup } from '@/utils/bible/groupConsecutiveHighlights';
import React, { createContext, useContext, useState } from 'react';

interface BibleInteractionContextType {
  // Data
  chapterHighlights: Highlight[];
  autoHighlights: AutoHighlight[];
  
  // Actions
  addHighlight: (data: any) => Promise<void>;
  updateHighlightColor: (id: number, color: HighlightColor) => Promise<void>;
  deleteHighlight: (id: number) => Promise<void>;
  
  // Interaction Triggers
  openVerseTooltip: (verseNumber: number | null, highlightGroup: HighlightGroup | null, verseText?: string) => void;
  openAutoHighlightTooltip: (autoHighlight: AutoHighlight) => void;
  openHighlightSelection: (range: VerseRange, text: string) => void;
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
  
  // Hooks for data
  const { chapterHighlights, addHighlight, updateHighlightColor, deleteHighlight } = useHighlights({
    bookId,
    chapterNumber,
  });
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
  }>({ visible: false, verseNumber: null, highlightGroup: null });

  const [autoHighlightState, setAutoHighlightState] = useState<{
    visible: boolean;
    autoHighlight: AutoHighlight | null;
  }>({ visible: false, autoHighlight: null });

  const [selectionSheetState, setSelectionSheetState] = useState<{
    visible: boolean;
    range: VerseRange;
    text: string;
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
  const openVerseTooltip = (verseNumber: number | null, highlightGroup: HighlightGroup | null, verseText?: string) => {
    // Close AutoHighlightTooltip if open
    setAutoHighlightState(prev => ({ ...prev, visible: false }));
    setVerseTooltipState({ visible: true, verseNumber, highlightGroup, verseText });
  };

  const openAutoHighlightTooltip = (autoHighlight: AutoHighlight) => {
    // Close VerseMateTooltip if open
    setVerseTooltipState(prev => ({ ...prev, visible: false }));
    setAutoHighlightState({ visible: true, autoHighlight });
  };

  const openHighlightSelection = (range: VerseRange, text: string) => {
    setSelectionSheetState({ visible: true, range, text });
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

  const value = {
    chapterHighlights,
    autoHighlights,
    addHighlight,
    updateHighlightColor,
    deleteHighlight,
    openVerseTooltip,
    openAutoHighlightTooltip,
    openHighlightSelection,
    openHighlightEditMenu,
    closeAll
  };

  return (
    <BibleInteractionContext.Provider value={value}>
      {children}
      
      {/* Overlays rendered at Root Level */}
      
      <VerseMateTooltip
        key={`tooltip-${!!user}`}
        visible={verseTooltipState.visible}
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
        onClose={() => setSelectionSheetState(prev => ({ ...prev, visible: false }))}
        onColorSelect={async (color) => {
             try {
                await addHighlight({
                    bookId,
                    chapterNumber,
                    startVerse: selectionSheetState.range.start,
                    endVerse: selectionSheetState.range.end,
                    color,
                    selectedText: selectionSheetState.text
                });
                setSelectionSheetState(prev => ({ ...prev, visible: false }));
             } catch (e) {
                 console.error(e);
                 showToast('Failed to create highlight');
             }
        }}
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
