import { parseByLineExplanation, parseByLineSections } from '@/utils/bible/parseByLineExplanation';

const MOCK_MARKDOWN = `# Line-by-Line Analysis of Genesis 1

## Genesis 1:1
> In the beginning God created the heavens and the earth.

### Summary
This opening says God is the uncaused origin of everything. He started time, space, and matter.

## Genesis 1:2
> The earth was formless and void...

### Summary
The phrase “without form and void” comes from the Hebrew **tohu va-bohu**.

## Genesis 1:3
> Then God said...

### Summary
God’s word is powerful.
`;

describe('parseByLineExplanation', () => {
  it('extracts summary for a single verse', () => {
    const result = parseByLineExplanation(MOCK_MARKDOWN, 'Genesis', 1, 1, 1);
    expect(result).toContain('This opening says God is the uncaused origin of everything.');
    expect(result).not.toContain('Verse 2');
  });

  it('extracts summaries for a verse range', () => {
    const result = parseByLineExplanation(MOCK_MARKDOWN, 'Genesis', 1, 1, 2);
    expect(result).toContain('**1:**');
    expect(result).toContain('**2:**');
    expect(result).toContain('The phrase “without form and void”');
  });

  it('returns null if verse is not found', () => {
    const result = parseByLineExplanation(MOCK_MARKDOWN, 'Genesis', 1, 5, 5);
    expect(result).toBeNull();
  });

  it('handles simple verse headers without book name', () => {
    const simpleMarkdown = `
## 1:1
> Verse text

### Summary
Simple summary.
`;
    const result = parseByLineExplanation(simpleMarkdown, 'Genesis', 1, 1, 1);
    expect(result).toContain('Simple summary');
  });
});

describe('parseByLineSections', () => {
  it('splits markdown into ordered per-verse sections', () => {
    const sections = parseByLineSections(MOCK_MARKDOWN, 1);
    const verseNumbers = sections.filter((s) => s.verseNumber > 0).map((s) => s.verseNumber);
    expect(verseNumbers).toEqual([1, 2, 3]);
  });

  it('keeps the ## heading inside the section markdown so headings still render', () => {
    const sections = parseByLineSections(MOCK_MARKDOWN, 1);
    const verseOne = sections.find((s) => s.verseNumber === 1);
    expect(verseOne).toBeDefined();
    expect(verseOne?.markdown).toContain('## Genesis 1:1');
    expect(verseOne?.markdown).toContain('### Summary');
    expect(verseOne?.markdown).toContain('uncaused origin');
  });

  it('captures intro / prelude markdown before the first verse header as verseNumber 0', () => {
    const sections = parseByLineSections(MOCK_MARKDOWN, 1);
    expect(sections[0]?.verseNumber).toBe(0);
    expect(sections[0]?.markdown).toContain('# Line-by-Line Analysis of Genesis 1');
  });

  it('returns an empty array for empty input', () => {
    expect(parseByLineSections('', 1)).toEqual([]);
  });

  it('skips ## headings from a different chapter', () => {
    const markdown = `## Genesis 1:1\n> A\n\n### Summary\nFirst.\n\n## Genesis 2:1\n> B\n\n### Summary\nSecond.`;
    const sections = parseByLineSections(markdown, 1);
    const verseNumbers = sections.filter((s) => s.verseNumber > 0).map((s) => s.verseNumber);
    expect(verseNumbers).toEqual([1]);
    // Chapter 2 content folds into chapter 1's section because we don't see a
    // matching ## header to switch into. That's fine — the quick-jump UX only
    // surfaces the verses we DID detect, and the contiguous markdown still
    // renders correctly.
    expect(sections[sections.length - 1]?.markdown).toContain('Genesis 2:1');
  });

  it('handles long chapters (e.g. Psalm 119) without dropping verses', () => {
    const lines: string[] = ['# Psalm 119'];
    for (let v = 1; v <= 176; v++) {
      lines.push('');
      lines.push(`## Psalm 119:${v}`);
      lines.push(`> verse ${v} text`);
      lines.push('');
      lines.push('### Summary');
      lines.push(`Summary for verse ${v}.`);
    }
    const sections = parseByLineSections(lines.join('\n'), 119);
    const verseNumbers = sections.filter((s) => s.verseNumber > 0).map((s) => s.verseNumber);
    expect(verseNumbers).toHaveLength(176);
    expect(verseNumbers[0]).toBe(1);
    expect(verseNumbers[175]).toBe(176);
  });
});
