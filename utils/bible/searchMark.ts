/**
 * Id of the display-only yellow highlight that marks a verse opened from a
 * typed search reference ("John 3:16"). Negative so it can never collide
 * with a saved highlight; ChapterReader treats a tap on it as a tap on the
 * verse and leaves it out of the saved-highlight groups.
 */
export const SEARCH_MARK_HIGHLIGHT_ID = -1;
