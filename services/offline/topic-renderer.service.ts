import { getBookByName } from '../../constants/bible-books';
import { getLocalBibleChapter, getSpecificVerses } from './sqlite-manager';

/**
 * Service to parse topic content and inject Bible verses from local SQLite database.
 * Mirrors the logic from backend `verse-parser.ts`.
 */

/**
 * Normalize book names to handle common variations
 * Maps singular/alternate forms to the canonical plural forms used in the database
 */
function normalizeBookName(bookName: string): string {
  const normalized = bookName.trim();

  // Handle common book name variations
  const bookNameMap: Record<string, string> = {
    Psalm: 'Psalms',
    'Song of Solomon': 'Song of Songs',
    'Song of Song': 'Song of Songs',
    '1 Corinthian': '1 Corinthians',
    '2 Corinthian': '2 Corinthians',
    '1 Thessalonian': '1 Thessalonians',
    '2 Thessalonian': '2 Thessalonians',
    '1 Peter': '1 Peter',
    '2 Peter': '2 Peter',
    '1 John': '1 John',
    '2 John': '2 John',
    '3 John': '3 John',
  };

  return bookNameMap[normalized] || normalized;
}

/**
 * Add reference summaries under markdown section headers (##)
 */
function addReferenceSummariesToSections(
  text: string,
  versePlaceholders: RegExpMatchArray[],
  chapterPlaceholders: RegExpMatchArray[]
): string {
  const lines = text.split('\n');
  const result: string[] = [];

  // Create a map of line index to placeholders that appear on/after that line
  const allPlaceholders = [
    ...versePlaceholders.map((m) => ({
      match: m[0],
      index: m.index || 0,
      bookName: m[1].trim(),
      chapter: parseInt(m[2], 10),
      startVerse: parseInt(m[3], 10),
      endVerse: m[4] ? parseInt(m[4], 10) : parseInt(m[3], 10),
      type: 'verse' as const,
    })),
    ...chapterPlaceholders.map((m) => ({
      match: m[0],
      index: m.index || 0,
      bookName: m[1].trim(),
      startChapter: parseInt(m[2], 10),
      endChapter: m[3] ? parseInt(m[3], 10) : parseInt(m[2], 10),
      type: 'chapter' as const,
    })),
  ].sort((a, b) => a.index - b.index);

  let currentPosition = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    result.push(line);

    // Check if this is a section header (## Something)
    if (line.trim().startsWith('##') && !line.trim().startsWith('###')) {
      // Find all placeholders between this header and the next header (or end of text)
      const headerEndPosition = currentPosition + line.length + 1; // +1 for newline

      // Find the next section header position
      let nextHeaderPosition = text.length;
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].trim().startsWith('##') && !lines[j].trim().startsWith('###')) {
          // Calculate position of this next header
          const linesUpToNext = lines.slice(0, j);
          nextHeaderPosition = linesUpToNext.join('\n').length + 1;
          break;
        }
      }

      // Collect placeholders in this section
      const sectionPlaceholders = allPlaceholders.filter(
        (p) => p.index >= headerEndPosition && p.index < nextHeaderPosition
      );

      if (sectionPlaceholders.length > 0) {
        // Format references
        const references = sectionPlaceholders.map((p) => {
          if (p.type === 'verse') {
            const verseRange =
              p.startVerse === p.endVerse ? `${p.startVerse}` : `${p.startVerse}-${p.endVerse}`;
            return `${p.bookName} ${p.chapter}:${verseRange}`;
          }
          // chapter type
          const chapterRange =
            p.startChapter === p.endChapter
              ? `${p.startChapter}`
              : `${p.startChapter}-${p.endChapter}`;
          return `${p.bookName} ${chapterRange}`;
        });

        // Add reference summary line with blank line after for proper markdown separation
        result.push(`(${references.join(', ')})`);
        result.push(''); // Add blank line to separate from content
      }
    }

    currentPosition += line.length + 1; // +1 for newline
  }

  return result.join('\n');
}

export async function parseAndInjectVerses(
  text: string,
  bibleVersion: string,
  options?: { includeReference?: boolean; includeVerseNumbers?: boolean }
) {
  // Handle verse placeholders
  const verseRegex = /{verse:([\w\d .'-]+)\s+(\d+):(\d+)(?:-(\d+))?}/g;
  const versePlaceholders = [...text.matchAll(verseRegex)];

  // Handle chapter placeholders
  const chapterRegex = /{chapter:([\w\d .'-]+)\s+(\d+)(?:-(\d+))?}/g;
  const chapterPlaceholders = [...text.matchAll(chapterRegex)];

  if (versePlaceholders.length === 0 && chapterPlaceholders.length === 0) {
    return text;
  }

  // If includeReference is true, add reference summaries under section headers
  let textWithHeaders = text;
  if (options?.includeReference) {
    textWithHeaders = addReferenceSummariesToSections(text, versePlaceholders, chapterPlaceholders);
  }

  // Process verse placeholders
  const verseRefs = versePlaceholders.map((match) => {
    const startVerse = parseInt(match[3], 10);
    const endVerse = match[4] ? parseInt(match[4], 10) : startVerse;
    return {
      fullMatch: match[0],
      bookName: normalizeBookName(match[1].trim()),
      chapterNumber: parseInt(match[2], 10),
      startVerse,
      endVerse,
      isRange: endVerse > startVerse,
    };
  });

  let processedText = textWithHeaders;

  // Process verse placeholders
  for (const verseRef of verseRefs) {
    // Generate array of verse numbers
    const versesToFetch = Array.from(
      { length: verseRef.endVerse - verseRef.startVerse + 1 },
      (_, i) => verseRef.startVerse + i
    );

    const fetchedVerses = await getSpecificVerses(
      bibleVersion,
      verseRef.bookName,
      verseRef.chapterNumber,
      versesToFetch
    );

    if (fetchedVerses.length > 0) {
      // Concatenate all verses in the range
      const includeVerseNumbers = options?.includeVerseNumbers !== false;
      const versesText = fetchedVerses
        .map((v) => (includeVerseNumbers ? `${v.verse_number}\n${v.text}` : v.text))
        .join('\n');

      let replacementText = versesText;
      if (options?.includeReference) {
        const referenceString = `(${verseRef.bookName} ${verseRef.chapterNumber}:${verseRef.startVerse}${verseRef.isRange ? `-${verseRef.endVerse}` : ''})`;
        replacementText = `${versesText} ${referenceString}`;
      }

      // Replace the original placeholder (global replacement for safety if dupes exist)
      const replacementRegex = new RegExp(
        verseRef.fullMatch.replace(/[.*+?^${}()|[\\]/g, '\\$& '),
        'g'
      );
      processedText = processedText.replace(replacementRegex, replacementText);
    } else {
      // If verses not found (e.g. book/version missing), keep placeholder or replace with error?
      // For now, let's keep it but log a warning
      console.warn(
        `[TopicRenderer] Verses not found: ${verseRef.bookName} ${verseRef.chapterNumber}:${verseRef.startVerse}-${verseRef.endVerse}`
      );
    }
  }

  // Process chapter placeholders
  const chapterRefs = chapterPlaceholders.map((match) => ({
    fullMatch: match[0],
    bookName: normalizeBookName(match[1].trim()),
    startChapter: parseInt(match[2], 10),
    endChapter: match[3] ? parseInt(match[3], 10) : parseInt(match[2], 10),
  }));

  // Process chapter placeholders
  for (const chapterRef of chapterRefs) {
    let chapterContent = '';

    // Process each chapter in the range
    for (
      let chapterNum = chapterRef.startChapter;
      chapterNum <= chapterRef.endChapter;
      chapterNum++
    ) {
      // We need the book ID first to fetch the chapter
      // getLocalBibleChapter needs bookId.
      // We can use a small helper or rely on getBookByName which is available in sqlite-manager context (but not exported directly for us to use here cleanly without circular deps maybe?)
      // Actually sqlite-manager exports getLocalBibleChapter.
      // But getLocalBibleChapter requires `bookId`.
      // We need to resolve bookName -> bookId here too.

      const book = getBookByName(chapterRef.bookName);

      if (book) {
        const verses = await getLocalBibleChapter(bibleVersion, book.id, chapterNum);

        if (verses && verses.length > 0) {
          // Format chapter content as verses with numbers
          const includeVerseNumbers = options?.includeVerseNumbers !== false;
          const formattedVerses = verses
            .map((verse) =>
              includeVerseNumbers ? `${verse.verse_number}\n${verse.text}` : verse.text
            )
            .join('\n');

          // Add chapter heading if it's a range
          if (chapterRef.startChapter !== chapterRef.endChapter) {
            chapterContent +=
              `## ${chapterRef.bookName} ${chapterNum}` + '\n\n' + formattedVerses + '\n\n';
          } else {
            chapterContent += formattedVerses;
          }
        }
      }
    }

    if (chapterContent) {
      let replacementText = chapterContent.trim();
      if (options?.includeReference) {
        const isRange = chapterRef.startChapter !== chapterRef.endChapter;
        const referenceString = `(${chapterRef.bookName} ${chapterRef.startChapter}${isRange ? `-${chapterRef.endChapter}` : ''})`;
        replacementText = `${replacementText} ${referenceString}`;
      }

      // Replace the placeholder with the chapter content
      const replacementRegex = new RegExp(
        chapterRef.fullMatch.replace(/[.*+?^${}()|[\\]/g, '\\$& '),
        'g'
      );
      processedText = processedText.replace(replacementRegex, replacementText);
    }
  }

  return processedText;
}
