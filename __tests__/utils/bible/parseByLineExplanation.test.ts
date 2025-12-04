import { parseByLineExplanation } from '@/utils/bible/parseByLineExplanation';

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
    expect(result).toContain(
      '**Verse 1:** This opening says God is the uncaused origin of everything.'
    );
    expect(result).not.toContain('Verse 2');
  });

  it('extracts summaries for a verse range', () => {
    const result = parseByLineExplanation(MOCK_MARKDOWN, 'Genesis', 1, 1, 2);
    expect(result).toContain('**Verse 1:**');
    expect(result).toContain('**Verse 2:**');
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
