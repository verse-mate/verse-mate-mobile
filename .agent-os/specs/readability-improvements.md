# Bible Text Readability Improvements

**Status:** Draft
**Created:** 2025-11-16
**Component:** `components/bible/ChapterReader.tsx`

## Overview

Improve Bible text readability through subtle typography enhancements and intelligent paragraph breaking, making long sections easier to read while maintaining the integrity of the Biblical text.

## Goals

1. Add visual interest with drop caps on section starts
2. Improve sentence readability with subtle spacing adjustments
3. Break long paragraph sections intelligently based on content patterns

## Non-Goals

- Poetry/dialogue/structure detection (too complex, unclear criteria)
- User-configurable text settings (separate feature)
- Tablet-specific optimizations (mobile-first)
- Verse number styling changes (current superscript is good)

---

## Feature 1: Drop Cap - First Letter Styling

### Description
Make the first letter of each section (after subtitle) larger for visual interest and traditional Bible aesthetic.

### Behavior
- **Target:** First letter of first verse in each section (after section subtitle)
- **Size:** 1.5x larger than body text (subtle, not dramatic)
- **Style:** Same font weight and color as body text
- **Position:** Inline with text (not floated/dropped below baseline)

### Implementation Notes
- Apply to `section.verses[0].text.charAt(0)` after each subtitle
- Each chapter starts with a subtitle, so this covers chapter starts automatically
- Use `fontSize: fontSizes.bodyLarge * 1.5` for drop cap

### Visual Example
```
Section Subtitle
1-5
𝗜n the beginning God created... (← "I" is 1.5x larger)
```

---

## Feature 2: Subtle Sentence & Verse Spacing

### Description
Add small spacing improvements to enhance readability without disrupting flow.

### 2A: Period Spacing
- **What:** Add ~20% more space after sentence-ending periods
- **How:** Insert thin space character or adjust letter-spacing after `. `
- **Goal:** Make sentence boundaries slightly clearer

### 2B: Superscript-to-Text Spacing
- **What:** Add half a space between verse number superscript and first character
- **Current:** `¹In the beginning` (superscript touches text)
- **Target:** `¹ In the beginning` (but only ~0.5 space width)
- **How:** Use thin space character `\u2009` or zero-width space with small margin

### Implementation Notes
- For periods: Process text to replace `. ` with `. \u2009` (thin space)
- For superscripts: Add `marginRight: 2` to `verseNumberSuperscript` style
- Keep changes subtle - should feel natural, not forced

---

## Feature 3: Smart Paragraph Breaking

### Description
Intelligently break long paragraph sections into smaller visual groups based on content patterns, making text easier to scan and read.

### Current Behavior
- Each section renders as one giant `<Text>` block with all verses
- Long sections (10+ verses) become dense walls of text
- No visual breathing room within sections

### Target Behavior
- Break sections into smaller paragraph groups (2-4 verses per group)
- Add subtle spacing (`spacing.md` = 12px) between groups
- Breaks should feel natural, not arbitrary

### Breaking Algorithm (Hybrid Approach)

Use multiple signals to determine break points:

#### 1. **Transition Word Detection**
Break when verse starts with common Biblical transition words:
```
- Time: "Then", "After", "Meanwhile", "Now", "When", "While"
- Contrast: "But", "Yet", "However", "Nevertheless"
- Consequence: "Therefore", "Thus", "So", "Accordingly"
- Addition: "Moreover", "Furthermore", "Also", "And" (at paragraph start only)
```

**Rule:** If verse N+1 starts with transition word AND verse N has ending punctuation, break before verse N+1.

#### 2. **Verse Grouping Constraints**
- **Minimum group size:** 2 verses (don't create 1-verse paragraphs)
- **Maximum group size:** 5 verses (force break after 5 verses even without signals)
- **Section size:** Don't break sections with ≤3 verses (too short to benefit)

#### 3. **Punctuation Awareness**
- **Strong break signals:** Verse ends with period `.` followed by transition word
- **Weak signals:** Question marks `?` and exclamation points `!` (don't auto-break, could be rhetorical)
- **No break:** Verse ends with comma `,` semicolon `;` or colon `:` (continuation)

### Breaking Logic Pseudocode

```typescript
function calculateBreakPoints(verses: Verse[]): number[] {
  const breakAfter: number[] = [];

  // Don't break short sections
  if (verses.length <= 3) return [];

  let versesSinceLastBreak = 0;

  for (let i = 0; i < verses.length - 1; i++) {
    const currentVerse = verses[i];
    const nextVerse = verses[i + 1];
    versesSinceLastBreak++;

    // Force break after 5 verses
    if (versesSinceLastBreak >= 5) {
      breakAfter.push(i);
      versesSinceLastBreak = 0;
      continue;
    }

    // Check for natural break
    const endsWithPeriod = currentVerse.text.trim().endsWith('.');
    const nextStartsWithTransition = startsWithTransitionWord(nextVerse.text);

    // Break if: ends with period + next has transition + at least 2 verses in group
    if (endsWithPeriod && nextStartsWithTransition && versesSinceLastBreak >= 2) {
      breakAfter.push(i);
      versesSinceLastBreak = 0;
    }
  }

  return breakAfter;
}

function startsWithTransitionWord(text: string): boolean {
  const transitions = [
    'Then', 'After', 'Meanwhile', 'Now', 'When', 'While',
    'But', 'Yet', 'However', 'Nevertheless',
    'Therefore', 'Thus', 'So', 'Accordingly',
    'Moreover', 'Furthermore', 'Also', 'And'
  ];

  const firstWord = text.trim().split(/\s+/)[0];
  return transitions.includes(firstWord);
}
```

### Visual Structure

**Before:**
```
Section Subtitle
1-15
¹In the beginning... ²And the earth... ³And God said... [continues for 15 verses]
```

**After:**
```
Section Subtitle
1-15
¹In the beginning... ²And the earth...

³And God said... ⁴And God saw...

⁵Then God said... ⁶And it was so...
```

### Implementation Notes
- Calculate break points in rendering logic before mapping verses
- Insert spacing `<View style={{ height: spacing.md }} />` at break points
- Keep existing section subtitle and verse range display unchanged
- Only apply to paragraph view mode (`PARAGRAPH_VIEW_ENABLED`)

---

## Testing Strategy

### Manual Testing
1. **Drop caps:** Test on Genesis 1, Psalm 23, Romans 8
2. **Spacing:** Verify period spacing feels natural, superscript spacing is subtle
3. **Breaks:** Test on various chapter types:
   - Narrative: Genesis 1 (creation account)
   - Dialogue-heavy: John 3 (Nicodemus conversation)
   - Dense text: Romans 8 (theological)
   - Short sections: Psalm 23 (don't over-break)

### Edge Cases
- Single-verse sections (no breaks)
- Sections with 2-3 verses (no breaks)
- Verses starting with lowercase (continuation sentences)
- Verses with multiple sentences
- Verses with dialogue (quotes)

### Success Criteria
- ✅ Text feels easier to scan and read
- ✅ Breaks feel natural, not arbitrary
- ✅ Drop caps add subtle visual interest
- ✅ No jarring spacing or visual artifacts
- ✅ Works across different Bible book types

---

## Implementation Checklist

- [ ] **Feature 1: Drop Cap** (Skipped - doesn't fit with current font)
  - [x] Add drop cap style (1.5x fontSize)
  - [x] Apply to first letter of first verse in section
  - [x] Reverted - visual style didn't work well

- [x] **Feature 2A: Period Spacing** (Completed via superscript spacing)
  - [x] Thin space before next verse number provides sentence spacing
  - [x] Acts as ~20% more space after verse-ending periods

- [x] **Feature 2B: Superscript Spacing**
  - [x] Add thin space Unicode characters (\u2009) before and after superscript
  - [x] Test spacing is ~0.5 regular space
  - [x] Final implementation: regular space + thin space before, thin space after

- [x] **Feature 3: Smart Paragraph Breaking**
  - [x] Implement `calculateBreakPoints()` function
  - [x] Implement `startsWithTransitionWord()` helper
  - [x] Add break rendering logic to verse mapping
  - [x] Group verses with `spacing.md` (12px) between groups
  - [ ] Test on various chapter types
  - [ ] Tune parameters (min/max group size, transition words)

- [ ] **Testing & Polish**
  - [ ] Manual testing across book types
  - [ ] Edge case validation
  - [ ] Performance check (no lag on long chapters)
  - [ ] Final visual review with PM

---

## Future Enhancements (Not in Scope)

- User-configurable spacing preferences
- Poetry detection and special formatting
- Dialogue-specific styling
- Tablet-optimized line lengths
- Advanced NLP for semantic paragraph detection
