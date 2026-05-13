/**
 * Locales — `sharing.*` keys
 *
 * Locks down the i18n contract for feat-humanize-share. Each share entry point
 * (chapter / topic / note) reads `title` + `body` from this catalog; this test
 * is the source-of-truth gate so a key rename can't ship silently.
 */

import { t } from 'i18next';
import en from '@/locales/en.json';

describe('sharing copy catalog (en.json)', () => {
  const catalog = en as unknown as {
    sharing: {
      chapter: { title: string; body: string };
      topic: { title: string; body: string };
      note: { title: string; body: string };
    };
  };

  it('exposes the six share keys', () => {
    expect(catalog.sharing.chapter.title).toEqual(expect.any(String));
    expect(catalog.sharing.chapter.body).toEqual(expect.any(String));
    expect(catalog.sharing.topic.title).toEqual(expect.any(String));
    expect(catalog.sharing.topic.body).toEqual(expect.any(String));
    expect(catalog.sharing.note.title).toEqual(expect.any(String));
    expect(catalog.sharing.note.body).toEqual(expect.any(String));
  });

  it('chapter templates carry book + chapter placeholders, body carries url', () => {
    expect(catalog.sharing.chapter.title).toContain('{{book}}');
    expect(catalog.sharing.chapter.title).toContain('{{chapter}}');
    expect(catalog.sharing.chapter.body).toContain('{{book}}');
    expect(catalog.sharing.chapter.body).toContain('{{chapter}}');
    expect(catalog.sharing.chapter.body).toContain('{{url}}');
  });

  it('topic templates carry topic placeholder, body carries url', () => {
    expect(catalog.sharing.topic.title).toContain('{{topic}}');
    expect(catalog.sharing.topic.body).toContain('{{topic}}');
    expect(catalog.sharing.topic.body).toContain('{{url}}');
  });

  it('note templates carry book + chapter, body carries content + url', () => {
    expect(catalog.sharing.note.title).toContain('{{book}}');
    expect(catalog.sharing.note.title).toContain('{{chapter}}');
    expect(catalog.sharing.note.body).toContain('{{book}}');
    expect(catalog.sharing.note.body).toContain('{{chapter}}');
    expect(catalog.sharing.note.body).toContain('{{content}}');
    expect(catalog.sharing.note.body).toContain('{{url}}');
  });

  it('no body opens with "Check out" (br-hs-002 / feat-share-copy-tone)', () => {
    expect(catalog.sharing.chapter.body.trimStart()).not.toMatch(/^Check out/i);
    expect(catalog.sharing.topic.body.trimStart()).not.toMatch(/^Check out/i);
    expect(catalog.sharing.note.body.trimStart()).not.toMatch(/^Check out/i);
  });

  it('renders the chapter body with book + chapter + url verbatim', () => {
    const rendered = t('sharing.chapter.body', {
      book: 'John',
      chapter: 3,
      url: 'https://app.versemate.org/bible/43/3',
    });
    expect(rendered).toContain('John 3');
    expect(rendered).toContain('https://app.versemate.org/bible/43/3');
    expect(rendered).not.toMatch(/^Check out/i);
  });

  it('renders the topic body with topic name + url verbatim', () => {
    const rendered = t('sharing.topic.body', {
      topic: 'The Beatitudes',
      url: 'https://app.versemate.org/topics/THEME/the-beatitudes',
    });
    expect(rendered).toContain('The Beatitudes');
    expect(rendered).toContain('https://app.versemate.org/topics/THEME/the-beatitudes');
    expect(rendered).not.toMatch(/^Check out/i);
  });

  it('renders the note body with content quoted verbatim', () => {
    const noteContent = 'This passage changed how I think about grace.';
    const rendered = t('sharing.note.body', {
      book: 'John',
      chapter: 3,
      content: noteContent,
      url: 'https://app.versemate.org/bible/43/3',
    });
    expect(rendered).toContain('John 3');
    expect(rendered).toContain(noteContent);
    expect(rendered).toContain('https://app.versemate.org/bible/43/3');
  });

  it('renders the note title with book + chapter (Share.share `title` form)', () => {
    expect(t('sharing.note.title', { book: 'John', chapter: 3 })).toBe('Note on John 3');
  });
});
