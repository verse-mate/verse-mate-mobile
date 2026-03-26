/**
 * Tests for sqlite-manager web stub
 *
 * Verifies key no-op stubs return the correct default values
 * so the app works in online-only mode on web.
 */

import {
  addLocalBookmark,
  addLocalHighlight,
  addLocalNote,
  closeDatabase,
  deleteAllOfflineData,
  deleteLocalBookmark,
  deleteLocalHighlight,
  deleteLocalNote,
  getDatabase,
  getLocalAllHighlights,
  getLocalAllNotes,
  getLocalBibleChapter,
  getLocalBookmarks,
  getLocalCommentary,
  getLocalHighlights,
  getLocalNotes,
  getLocalTopic,
  getLocalTopicExplanations,
  getLocalTopicReferences,
  getLocalTopics,
  getMetadata,
  getTotalStorageUsed,
  initDatabase,
  insertBibleVerses,
  isBibleVersionDownloaded,
  isUserDataDownloaded,
  resetDatabase,
} from '@/services/offline/sqlite-manager.web';

describe('sqlite-manager.web (no-op stubs)', () => {
  it('initDatabase returns null', async () => {
    expect(await initDatabase()).toBeNull();
  });

  it('getDatabase returns null', async () => {
    expect(await getDatabase()).toBeNull();
  });

  it('resetDatabase returns null', async () => {
    expect(await resetDatabase()).toBeNull();
  });

  it('closeDatabase resolves without error', async () => {
    await expect(closeDatabase()).resolves.toBeUndefined();
  });

  it('insertBibleVerses resolves without error', async () => {
    await expect(insertBibleVerses('NASB', [])).resolves.toBeUndefined();
  });

  it('getLocalBibleChapter returns empty array', async () => {
    expect(await getLocalBibleChapter(1, 1, 'NASB')).toEqual([]);
  });

  it('isBibleVersionDownloaded returns false', async () => {
    expect(await isBibleVersionDownloaded('NASB')).toBe(false);
  });

  it('getLocalTopics returns empty array', async () => {
    expect(await getLocalTopics('en')).toEqual([]);
  });

  it('getLocalTopic returns null', async () => {
    expect(await getLocalTopic('1', 'en')).toBeNull();
  });

  it('getLocalTopicExplanations returns empty array', async () => {
    expect(await getLocalTopicExplanations('1', 'en')).toEqual([]);
  });

  it('getLocalTopicReferences returns null', async () => {
    expect(await getLocalTopicReferences('1')).toBeNull();
  });

  it('getLocalCommentary returns empty array', async () => {
    expect(await getLocalCommentary(1, 1, 'en')).toEqual([]);
  });

  it('getMetadata returns null', async () => {
    expect(await getMetadata('NASB')).toBeNull();
  });

  it('getLocalBookmarks returns empty array', async () => {
    expect(await getLocalBookmarks()).toEqual([]);
  });

  it('getLocalHighlights returns empty array', async () => {
    expect(await getLocalHighlights(1, 1)).toEqual([]);
  });

  it('getLocalAllHighlights returns empty array', async () => {
    expect(await getLocalAllHighlights()).toEqual([]);
  });

  it('getLocalNotes returns empty array', async () => {
    expect(await getLocalNotes(1, 1)).toEqual([]);
  });

  it('getLocalAllNotes returns empty array', async () => {
    expect(await getLocalAllNotes()).toEqual([]);
  });

  it('isUserDataDownloaded returns false', async () => {
    expect(await isUserDataDownloaded()).toBe(false);
  });

  it('addLocalNote resolves without error', async () => {
    await expect(addLocalNote({} as any)).resolves.toBeUndefined();
  });

  it('deleteLocalNote resolves without error', async () => {
    await expect(deleteLocalNote('1')).resolves.toBeUndefined();
  });

  it('addLocalHighlight resolves without error', async () => {
    await expect(addLocalHighlight({} as any)).resolves.toBeUndefined();
  });

  it('deleteLocalHighlight resolves without error', async () => {
    await expect(deleteLocalHighlight(1)).resolves.toBeUndefined();
  });

  it('addLocalBookmark resolves without error', async () => {
    await expect(addLocalBookmark({} as any)).resolves.toBeUndefined();
  });

  it('deleteLocalBookmark resolves without error', async () => {
    await expect(deleteLocalBookmark(1)).resolves.toBeUndefined();
  });

  it('deleteAllOfflineData resolves without error', async () => {
    await expect(deleteAllOfflineData()).resolves.toBeUndefined();
  });

  it('getTotalStorageUsed returns 0', async () => {
    expect(await getTotalStorageUsed()).toBe(0);
  });
});
