/**
 * Parser for ByLine Explanation Markdown
 *
 * Extracts verse-specific summaries from the "byline" explanation type.
 *
 * Expected Markdown format:
 * ## {Book} {Chapter}:{Verse}
 * > {Verse Text}
 *
 * ### Summary
 * {Summary Text}
 */

export interface VerseSummary {
  verseNumber: number;
  summary: string;
}

/**
 * Parses the full byline markdown content and extracts summaries for specific verses.
 *
 * @param markdownContent The full markdown string from the API.
 * @param bookName The name of the book (e.g., "Genesis") to help match headers.
 * @param chapterNumber The chapter number.
 * @param startVerse The start verse of the range to extract.
 * @param endVerse The end verse of the range to extract.
 * @returns A combined summary string for the requested verse range, or null if not found.
 */
export function parseByLineExplanation(
  markdownContent: string,
  bookName: string,
  chapterNumber: number,
  startVerse: number,
  endVerse: number
): string | null {
  if (!markdownContent) return null;

  const summaries: string[] = [];

  // Normalize line endings
  const content = markdownContent.replace(/\r\n/g, '\n');

  // Create a range of verse numbers to look for
  const versesToFind = new Set<number>();
  for (let i = startVerse; i <= endVerse; i++) {
    versesToFind.add(i);
  }

  // Helper to check if a header matches a specific verse
  // Matches: "## Genesis 1:1" or "## 1:1" (if book name is omitted)
  const _isVerseHeader = (line: string, verseNum: number) => {
    const normalizedLine = line.trim().toLowerCase();
    const patterns = [
      `## ${bookName.toLowerCase()} ${chapterNumber}:${verseNum}`,
      `## ${chapterNumber}:${verseNum}`,
    ];
    return patterns.some((p) => normalizedLine.startsWith(p.toLowerCase()));
  };

  const lines = content.split('\n');
  let currentVerse: number | null = null;
  let inSummarySection = false;
  let currentSummaryBuffer: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if this line is a verse header
    if (line.startsWith('## ')) {
      // If we were collecting a summary for a requested verse, save it
      if (currentVerse !== null && inSummarySection && versesToFind.has(currentVerse)) {
        const summaryText = currentSummaryBuffer.join('\n').trim();
        if (summaryText) {
          summaries.push(`**Verse ${currentVerse}:** ${summaryText}`);
        }
      }

      // Reset state for new section
      currentVerse = null;
      inSummarySection = false;
      currentSummaryBuffer = [];

      // Try to identify which verse this header belongs to
      // Iterate through our requested verses to see if this header matches one
      // Optimization: If we only need a few verses, this loop is tiny.
      // If we needed all verses, we'd parse the number from the header string instead.
      // Let's parse the number from the string to be more robust for any verse.
      const match = line.match(/(\d+):(\d+)/);
      if (match) {
        const foundChapter = parseInt(match[1], 10);
        const foundVerse = parseInt(match[2], 10);

        if (foundChapter === chapterNumber && versesToFind.has(foundVerse)) {
          currentVerse = foundVerse;
        }
      }
      continue;
    }

    // Check for Summary header
    if (currentVerse !== null && line.trim().startsWith('### Summary')) {
      inSummarySection = true;
      continue;
    }

    // Stop collecting if we hit another header (safety check, though '##' above handles major sections)
    if (line.startsWith('#')) {
      // If we were capturing, save what we have (e.g., hit a ## header we didn't parse correctly)
      // But usually the '##' block above catches this. This is for safety.
      if (currentVerse !== null && inSummarySection && versesToFind.has(currentVerse)) {
        const summaryText = currentSummaryBuffer.join('\n').trim();
        if (summaryText) {
          summaries.push(`**Verse ${currentVerse}:** ${summaryText}`);
        }
      }
      currentVerse = null;
      inSummarySection = false;
      currentSummaryBuffer = [];
      continue;
    }

    // Collect summary content
    if (currentVerse !== null && inSummarySection) {
      // Skip quote blocks (verse text) if they appear after Summary (unlikely but possible)
      if (!line.trim().startsWith('>')) {
        currentSummaryBuffer.push(line);
      }
    }
  }

  // Handle the last section if file ends
  if (currentVerse !== null && inSummarySection && versesToFind.has(currentVerse)) {
    const summaryText = currentSummaryBuffer.join('\n').trim();
    if (summaryText) {
      summaries.push(`**Verse ${currentVerse}:** ${summaryText}`);
    }
  }

  if (summaries.length === 0) return null;

  return summaries.join('\n\n');
}

/**
 * Extracts the verse text (blockquotes) for a specific verse range from the byline markdown.
 *
 * @param markdownContent The full markdown string.
 * @param chapterNumber The chapter number.
 * @param startVerse The start verse.
 * @param endVerse The end verse.
 * @returns The combined verse text for the range, or null if not found.
 */
export function extractVerseTextFromByLine(
  markdownContent: string,
  chapterNumber: number,
  startVerse: number,
  endVerse: number
): string | null {
  if (!markdownContent) return null;

  const verseTexts: string[] = [];
  const content = markdownContent.replace(/\r\n/g, '\n');
  const versesToFind = new Set<number>();
  for (let i = startVerse; i <= endVerse; i++) {
    versesToFind.add(i);
  }

  const lines = content.split('\n');
  let currentVerse: number | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if this line is a verse header
    if (line.startsWith('## ')) {
      currentVerse = null;
      const match = line.match(/(\d+):(\d+)/);
      if (match) {
        const foundChapter = parseInt(match[1], 10);
        const foundVerse = parseInt(match[2], 10);
        if (foundChapter === chapterNumber && versesToFind.has(foundVerse)) {
          currentVerse = foundVerse;
        }
      }
      continue;
    }

    // Collect verse text (blockquotes)
    if (currentVerse !== null && line.trim().startsWith('>')) {
      // Remove '> ' prefix and trim
      const text = line.trim().substring(1).trim();
      if (text) {
        verseTexts.push(text);
      }
    }
  }

  if (verseTexts.length === 0) return null;

  return verseTexts.join(' ');
}
