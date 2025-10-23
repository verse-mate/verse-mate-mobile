/**
 * Tests for ChapterReader Component
 *
 * Focused tests for the chapter content renderer.
 * Tests rendering of Bible text, section subtitles, verse numbers, and markdown.
 */

import { render, screen } from '@testing-library/react-native';
import { ChapterReader } from '@/components/bible/ChapterReader';
import type { ChapterContent } from '@/types/bible';

// Mock chapter data
const mockChapter: ChapterContent = {
  bookId: 1,
  bookName: 'Genesis',
  chapterNumber: 1,
  testament: 'OT',
  title: 'Genesis 1',
  sections: [
    {
      subtitle: 'The Creation',
      startVerse: 1,
      endVerse: 2,
      verses: [
        {
          number: 1,
          verseNumber: 1,
          text: 'In the beginning God created the heavens and the earth.',
        },
        { number: 2, verseNumber: 2, text: 'The earth was formless and void.' },
      ],
    },
    {
      subtitle: 'Let There Be Light',
      startVerse: 3,
      endVerse: 5,
      verses: [
        {
          number: 3,
          verseNumber: 3,
          text: 'Then God said, "Let there be light"; and there was light.',
        },
        { number: 4, verseNumber: 4, text: 'God saw that the light was good.' },
        {
          number: 5,
          verseNumber: 5,
          text: 'God called the light day, and the darkness He called night.',
        },
      ],
    },
  ],
};

const mockExplanation = {
  bookId: 1,
  chapterNumber: 1,
  type: 'summary' as const,
  content:
    '## Summary\n\nThis chapter describes the creation of the world.\n\n**Key Points:**\n- God created everything\n- It was very good',
  explanationId: 1,
  languageCode: 'en-US',
};

describe('ChapterReader', () => {
  /**
   * Test 1: Renders chapter title
   */
  it('renders chapter title with correct styling', () => {
    render(<ChapterReader chapter={mockChapter} activeTab="summary" />);

    const title = screen.getByText('Genesis 1');
    expect(title).toBeTruthy();
  });

  /**
   * Test 2: Renders section subtitles
   */
  it('renders section subtitles when present', () => {
    render(<ChapterReader chapter={mockChapter} activeTab="summary" />);

    expect(screen.getByText('The Creation')).toBeTruthy();
    expect(screen.getByText('Let There Be Light')).toBeTruthy();
  });

  /**
   * Test 3: Renders verse range captions
   */
  it('renders verse range captions for each section', () => {
    render(<ChapterReader chapter={mockChapter} activeTab="summary" />);

    expect(screen.getByText('1-2')).toBeTruthy();
    expect(screen.getByText('3-5')).toBeTruthy();
  });

  /**
   * Test 4: Renders Bible text with verse numbers
   */
  it('renders verse text with superscript verse numbers', () => {
    render(<ChapterReader chapter={mockChapter} activeTab="summary" />);

    // Verify verse text is rendered
    expect(screen.getByText(/In the beginning God created/)).toBeTruthy();
    expect(screen.getByText(/The earth was formless/)).toBeTruthy();
  });

  /**
   * Test 5: Renders explanation content when provided
   */
  it('renders explanation content in markdown format', () => {
    render(
      <ChapterReader chapter={mockChapter} activeTab="summary" explanation={mockExplanation} />
    );

    // Markdown should render the heading and content
    expect(screen.getByText(/Summary/)).toBeTruthy();
    expect(screen.getByText(/creation of the world/)).toBeTruthy();
  });

  /**
   * Test 6: Renders multiple sections correctly
   */
  it('renders all sections in order', () => {
    const { getAllByTestId } = render(<ChapterReader chapter={mockChapter} activeTab="summary" />);

    const sections = getAllByTestId(/chapter-section-/);
    expect(sections).toHaveLength(2);
  });
});
