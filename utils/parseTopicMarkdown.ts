/**
 * Parser utility to convert topic markdown content into structured data
 * for rendering with the TopicText component.
 *
 * Adapted from web version for React Native compatibility.
 */

export interface ParsedTopicVerse {
  verseNumber: string; // Can be "1", "6", etc. - from the source book
  text: string; // The verse text without the number and reference
  reference: string; // The reference like "Hebrews 11:1" (Display only)
  clickableReference?: string; // The reference for interaction/tooltip
}

export interface ParsedTopicSubtitle {
  subtitle: string;
  referenceList: string; // The grayed reference list under the subtitle
  verses: ParsedTopicVerse[];
}

export interface ParsedTopicContent {
  subtitles: ParsedTopicSubtitle[];
}

/**
 * Parses topic markdown text content into structured data
 */
export function parseTopicMarkdown(markdownContent: string): ParsedTopicContent {
  const result: ParsedTopicContent = {
    subtitles: [],
  };

  // Split by ## to get sections
  const sections = markdownContent.split(/^## /m).filter((s) => s.trim());

  for (const section of sections) {
    const lines = section.split('\n');
    const subtitle = lines[0]?.trim() || '';

    // Second line is usually the reference list in parentheses
    const referenceList = lines[1]?.trim() || '';

    // Rest of the lines are the verses
    const verseText = lines.slice(2).join('\n');
    const verses = parseVerses(verseText);

    result.subtitles.push({
      subtitle,
      referenceList,
      verses,
    });
  }

  return result;
}

/**
 * Parses individual verses from a paragraph text
 * Handles both:
 * - Verses with references: "[number]\n[text] ([reference])"
 * - Verses without references: "[number]\n[text]"
 * - Plain text without verse numbers: treated as a single verse
 */
function parseVerses(text: string): ParsedTopicVerse[] {
  const verses: ParsedTopicVerse[] = [];

  // Split text by verse numbers (lines that start with just a number)
  // This regex splits on newline followed by number and newline
  const parts = text.split(/\n(?=\d+\n)/);

  for (const part of parts) {
    const trimmedPart = part.trim();
    if (!trimmedPart) continue;

    // Try to match verse with reference: number, text, (reference)
    const withRefMatch = trimmedPart.match(/^(\d+)\s*\n([\s\S]*?)\(([^)]+)\)$/);
    if (withRefMatch) {
      const ref = withRefMatch[3].trim();
      verses.push({
        verseNumber: withRefMatch[1].trim(),
        text: withRefMatch[2].trim(),
        reference: ref,
        clickableReference: ref,
      });
      continue;
    }

    // Try to match verse without reference: number, text (no parentheses at end)
    const withoutRefMatch = trimmedPart.match(/^(\d+)\s*\n([\s\S]+?)$/);
    if (withoutRefMatch) {
      // Check if this text doesn't end with a reference in parentheses
      const textPart = withoutRefMatch[2].trim();
      if (!textPart.endsWith(')')) {
        verses.push({
          verseNumber: withoutRefMatch[1].trim(),
          text: textPart,
          reference: '', // No reference for this verse (display)
        });
      }
    }
  }

  // If no verses were parsed, treat the entire text as plain text (no verse numbers)
  if (verses.length === 0 && text.trim()) {
    verses.push({
      verseNumber: '', // No verse number for plain text
      text: text.trim(),
      reference: '',
    });
  }

  // Backfill clickable references
  // If a block of verses ends with a reference (e.g., "Genesis 1:1-5"),
  // apply the book/chapter context to preceding verses that lack a reference.
  for (let i = verses.length - 1; i >= 0; i--) {
    const current = verses[i];

    // Use either the display reference or an already backfilled clickable reference as the source
    const sourceRef = current.reference || current.clickableReference;

    if (sourceRef) {
      // Extract Book and Chapter from the reference
      // Matches "Book Name Chapter:Verse" or "Book Name Chapter:Verse-Range"
      const match = sourceRef.match(/^(.+?)\s+(\d+):(\d+)(?:-\d+)?$/);
      if (match) {
        const bookName = match[1];
        const chapter = match[2];

        // Look backwards for verses without clickable references
        for (let j = i - 1; j >= 0; j--) {
          const prev = verses[j];
          // Stop if we hit a verse that already has a clickable reference (or explicit display reference)
          if (prev.reference || prev.clickableReference) break;

          // Construct reference for the previous verse using its own number
          if (prev.verseNumber) {
            // Only set clickableReference, do NOT touch 'reference' (display)
            prev.clickableReference = `${bookName} ${chapter}:${prev.verseNumber}`;
          }
        }
      }
    }
  }

  return verses;
}
