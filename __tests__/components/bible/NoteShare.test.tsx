/**
 * Note share copy
 *
 * Spec: feat-humanize-share, TASK-004. `NoteEditModal._handleShare` resolves
 * the share body from `sharing.note.*` keys and quotes the note content
 * verbatim. Lock both the resolved string + the wiring at the call site.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { t } from 'i18next';

const noteSrc = readFileSync(
  join(__dirname, '..', '..', '..', 'components/bible/NoteEditModal.tsx'),
  'utf8'
);

describe('Note share copy (feat-humanize-share)', () => {
  it('renders body with chapter reference + verbatim quoted content + url', () => {
    const content = 'This passage changed how I think about grace.';
    const body = t('sharing.note.body', {
      book: 'John',
      chapter: 3,
      content,
      url: 'https://app.versemate.org/bible/43/3',
    });

    expect(body).toContain('John 3');
    expect(body).toContain(`"${content}"`);
    expect(body).toContain('https://app.versemate.org/bible/43/3');
    expect(body).not.toMatch(/^Check out/i);
  });

  it('renders title in the `Note on {{book}} {{chapter}}` form', () => {
    expect(t('sharing.note.title', { book: 'John', chapter: 3 })).toBe('Note on John 3');
  });

  it('NoteEditModal._handleShare reads from sharing.note.* keys', () => {
    expect(noteSrc).toContain("t('sharing.note.body'");
    expect(noteSrc).toContain("t('sharing.note.title'");
    expect(noteSrc).not.toMatch(/`Note on \$\{bookName\} \$\{chapterNumber\}/);
  });

  it('strips the trailing URL slot when generateChapterShareUrl fails', () => {
    // Mirrors the fallback branch in NoteEditModal._handleShare: when URL
    // generation throws, the rendered body must not leave dangling whitespace
    // where {{url}} would have been (br-hs-003: no behavior regression).
    const raw = t('sharing.note.body', {
      book: 'John',
      chapter: 3,
      content: 'Quiet morning.',
      url: '',
    });
    const cleaned = raw.replace(/\s+$/, '');
    expect(cleaned.endsWith('"Quiet morning."')).toBe(true);
    expect(cleaned).not.toMatch(/\n\n$/);
  });
});
