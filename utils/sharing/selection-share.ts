/**
 * Text for Copy and Share from the reader's selection menu.
 *
 * Same shape as the Verse Insight sheet's Copy/Share (`VerseMateTooltip`): the words in quotes,
 * then the reference and version. Share adds the chapter's link, which is also what lets iOS show
 * VerseMate's icon in the share sheet instead of a generic text icon (Andy, 2026-11-01): a share
 * of bare text has no app to attribute it to.
 */

interface SelectionRange {
  startVerse: number;
  endVerse: number;
}

/** "John 1:5", or "John 1:5-7" when the selection runs across verses. */
export function selectionReference(
  bookName: string,
  chapterNumber: number,
  selection: SelectionRange
): string {
  const verses =
    selection.startVerse === selection.endVerse
      ? `${selection.startVerse}`
      : `${selection.startVerse}-${selection.endVerse}`;
  return `${bookName} ${chapterNumber}:${verses}`;
}

/** The quoted words and their reference, then the link when one is given. */
export function selectionShareText({
  text,
  reference,
  version,
  url,
}: {
  text: string;
  reference: string;
  version?: string;
  url?: string;
}): string {
  const source = version ? `${reference} ${version}` : reference;
  const body = `"${text.trim()}"\n\n- ${source}`;
  return url ? `${body}\n\n${url}` : body;
}
