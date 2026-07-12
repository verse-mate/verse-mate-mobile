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
 * Robust by-line summary extractor.
 *
 * Hardened after the "No specific insight available for this verse" bug
 * (Andy, 2026-06-27, Mark 10:29): the previous version only captured text that
 * sat under an EXACT `### Summary` sub-header for an EXACT `## Book C:V` header.
 * If the generated content omitted the `### Summary` line, used a different
 * sub-header (e.g. `### Analysis`), or grouped verses into a range header
 * (`## Mark 10:28-31`), the tapped verse silently resolved to "no insight" even
 * though prose existed. This version:
 *   - captures ALL prose under a matched verse header (skipping the `>` verse-
 *     text blockquote and stripping any `###`+ sub-header lines), so a missing
 *     or renamed `### Summary` no longer drops the content, and
 *   - matches verse RANGE headers (`## Book C:28-31`) so a tap on any verse in
 *     the range resolves.
 * A verse still resolves to null only when the content genuinely has no section
 * covering it (a backend content gap) — which is the correct signal.
 */
export function parseByLineExplanation(
  markdownContent: string,
  _bookName: string,
  chapterNumber: number,
  startVerse: number,
  endVerse: number
): string | null {
  if (!markdownContent) return null;

  const summaries: string[] = [];
  const content = markdownContent.replace(/\r\n/g, '\n');

  const versesToFind = new Set<number>();
  for (let i = startVerse; i <= endVerse; i++) {
    versesToFind.add(i);
  }

  const lines = content.split('\n');
  let currentVerse: number | null = null; // requested verse the current section covers
  let buffer: string[] = [];

  const flush = () => {
    if (currentVerse !== null) {
      // Drop any `###`/`####` sub-header lines (Summary/Analysis/etc.) but keep
      // their prose; the `>` blockquote verse text is already excluded below.
      const summaryText = buffer
        .join('\n')
        .replace(/^\s*#{3,}.*$/gm, '')
        .trim();
      if (summaryText) {
        summaries.push(
          startVerse === endVerse ? summaryText : `**${currentVerse}:** ${summaryText}`
        );
      }
    }
    currentVerse = null;
    buffer = [];
  };

  for (const line of lines) {
    // Verse header (`## Book C:V` or a range `## Book C:V-W`)
    if (line.startsWith('## ')) {
      flush();
      const match = line.match(/(\d+):(\d+)(?:\s*[-–—]\s*(\d+))?/);
      if (match) {
        const foundChapter = parseInt(match[1], 10);
        const vStart = parseInt(match[2], 10);
        const vEnd = match[3] ? parseInt(match[3], 10) : vStart;
        if (foundChapter === chapterNumber) {
          for (let v = vStart; v <= vEnd; v++) {
            if (versesToFind.has(v)) {
              currentVerse = v;
              break;
            }
          }
        }
      }
      continue;
    }

    // A top-level `# ` header (chapter title) ends the current verse section.
    if (line.startsWith('# ')) {
      flush();
      continue;
    }

    if (currentVerse !== null && !line.trim().startsWith('>')) {
      buffer.push(line);
    }
  }

  flush();

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

export interface ByLineSection {
  verseNumber: number;
  markdown: string;
}

/**
 * Splits byline markdown into per-verse sections.
 * Anything before the first `## <Chapter>:<Verse>` header is returned as a
 * leading prelude with verseNumber = 0 (preserves intro text from the model).
 *
 * Used by the quick-verse-jump control to anchor each verse section in the
 * ScrollView so taps on a verse number can scrollTo the right Y position.
 */
export function parseByLineSections(
  markdownContent: string,
  chapterNumber: number
): ByLineSection[] {
  if (!markdownContent) return [];

  const content = markdownContent.replace(/\r\n/g, '\n');
  const lines = content.split('\n');

  const sections: ByLineSection[] = [];
  let currentVerse = 0;
  let buffer: string[] = [];

  const flush = () => {
    const body = buffer.join('\n').trim();
    if (body.length > 0) {
      sections.push({ verseNumber: currentVerse, markdown: body });
    }
    buffer = [];
  };

  for (const line of lines) {
    if (line.startsWith('## ')) {
      const match = line.match(/(\d+):(\d+)/);
      if (match) {
        const foundChapter = parseInt(match[1], 10);
        const foundVerse = parseInt(match[2], 10);
        if (foundChapter === chapterNumber) {
          flush();
          currentVerse = foundVerse;
          buffer.push(line);
          continue;
        }
      }
    }
    buffer.push(line);
  }

  flush();

  return sections;
}
