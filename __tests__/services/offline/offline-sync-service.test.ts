import { HttpResponse, http } from 'msw';
import { authenticatedFetch } from '@/lib/api/authenticated-fetch';
import * as syncService from '@/services/offline/offline-sync-service';
import * as sqliteManager from '@/services/offline/sqlite-manager';
import { server } from '../../mocks/server';

// Mock dependencies
jest.mock('@/lib/api/authenticated-fetch', () => ({
  authenticatedFetch: jest.fn(),
}));

jest.mock('@/services/offline/sqlite-manager', () => ({
  getPendingSyncActions: jest.fn(),
  updateSyncActionStatus: jest.fn(),
  deleteSyncAction: jest.fn(),
  addSyncAction: jest.fn(),
  insertBibleVerses: jest.fn(),
  saveMetadata: jest.fn(),
  isBibleVersionDownloaded: jest.fn(),
  isCommentaryDownloaded: jest.fn(),
  isTopicsDownloaded: jest.fn(),
  insertCommentaries: jest.fn(),
  insertTopics: jest.fn(),
  insertUserNotes: jest.fn(),
  insertUserHighlights: jest.fn(),
  insertUserBookmarks: jest.fn(),
  getLastSyncTime: jest.fn(),
  getTotalStorageUsed: jest.fn(),
  initDatabase: jest.fn().mockResolvedValue({}),
  downloadUserData: jest.fn().mockResolvedValue(undefined),
  deleteCommentaries: jest.fn(),
  deleteTopics: jest.fn(),
  deleteBibleVersion: jest.fn(),
}));

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

const mockManifest = {
  bible_versions: [
    {
      key: 'en-KJV',
      language: 'en',
      name: 'KJV',
      size_bytes: 1000,
      url: 'http://test/kjv',
      updated_at: '2024-01-01',
    },
    {
      key: 'pt-ACF',
      language: 'pt',
      name: 'ACF',
      size_bytes: 2000,
      url: 'http://test/acf',
      updated_at: '2024-01-01',
    },
  ],
  commentary_languages: [
    {
      code: 'en',
      name: 'English',
      size_bytes: 500,
      url: 'http://test/commentary-en',
      updated_at: '2024-01-01',
    },
  ],
  topic_languages: [
    {
      code: 'en',
      name: 'English',
      size_bytes: 300,
      url: 'http://test/topics-en',
      updated_at: '2024-01-01',
    },
  ],
};

describe('OfflineSyncService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (authenticatedFetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve('{}'),
    });
  });

  describe('processSyncQueue', () => {
    it('does nothing if queue is empty', async () => {
      (sqliteManager.getPendingSyncActions as jest.Mock).mockResolvedValue([]);

      await syncService.processSyncQueue();

      expect(authenticatedFetch).not.toHaveBeenCalled();
    });

    it('processes a pending note creation', async () => {
      const mockAction = {
        id: 1,
        type: 'NOTE',
        action: 'CREATE',
        payload: JSON.stringify({ book_id: 1, chapter_number: 1, content: 'Test Note' }),
        retry_count: 0,
      };

      (sqliteManager.getPendingSyncActions as jest.Mock).mockResolvedValue([mockAction]);

      await syncService.processSyncQueue();

      expect(sqliteManager.updateSyncActionStatus).toHaveBeenCalledWith(1, 'SYNCING');
      expect(authenticatedFetch).toHaveBeenCalledWith(
        expect.stringContaining('/bible-book-note/add'),
        expect.objectContaining({
          method: 'POST',
          body: mockAction.payload,
        })
      );
      expect(sqliteManager.deleteSyncAction).toHaveBeenCalledWith(1);
    });

    it('processes a pending highlight deletion', async () => {
      const mockAction = {
        id: 2,
        type: 'HIGHLIGHT',
        action: 'DELETE',
        payload: JSON.stringify({ highlight_id: 123 }),
        retry_count: 0,
      };

      (sqliteManager.getPendingSyncActions as jest.Mock).mockResolvedValue([mockAction]);

      await syncService.processSyncQueue();

      expect(authenticatedFetch).toHaveBeenCalledWith(
        expect.stringContaining('/bible-highlight/123'),
        expect.objectContaining({ method: 'DELETE' })
      );
      expect(sqliteManager.deleteSyncAction).toHaveBeenCalledWith(2);
    });

    it('handles bookmark deletion with query params', async () => {
      const mockAction = {
        id: 3,
        type: 'BOOKMARK',
        action: 'DELETE',
        payload: JSON.stringify({ book_id: 1, chapter_number: 1 }),
        retry_count: 0,
      };

      (sqliteManager.getPendingSyncActions as jest.Mock).mockResolvedValue([mockAction]);

      await syncService.processSyncQueue();

      expect(authenticatedFetch).toHaveBeenCalledWith(
        expect.stringContaining('/bible-book-bookmark/remove?book_id=1&chapter_number=1'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('increments retry count on failure', async () => {
      const mockAction = {
        id: 4,
        type: 'NOTE',
        action: 'UPDATE',
        payload: JSON.stringify({ note_id: 'abc', content: 'Updated' }),
        retry_count: 1,
      };

      (sqliteManager.getPendingSyncActions as jest.Mock).mockResolvedValue([mockAction]);
      (authenticatedFetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await syncService.processSyncQueue();

      expect(sqliteManager.updateSyncActionStatus).toHaveBeenCalledWith(4, 'FAILED', 2);
      expect(sqliteManager.deleteSyncAction).not.toHaveBeenCalled();
    });
  });

  describe('fetchManifest', () => {
    it('fetches manifest from API', async () => {
      server.use(
        http.get('https://api.versemate.org/offline/manifest', () => {
          return HttpResponse.json(mockManifest);
        })
      );

      const result = await syncService.fetchManifest();
      expect(result).toEqual(mockManifest);
    });
  });

  describe('buildLanguageBundles', () => {
    it('groups bible versions, commentaries, and topics by language code', () => {
      const bundles = syncService.buildLanguageBundles(mockManifest);

      expect(bundles).toHaveLength(2);
      const enBundle = bundles.find((b) => b.languageCode === 'en');
      const ptBundle = bundles.find((b) => b.languageCode === 'pt');

      expect(enBundle).toBeDefined();
      expect(enBundle?.bibleVersions).toHaveLength(1);
      expect(enBundle?.hasCommentaries).toBe(true);
      expect(enBundle?.hasTopics).toBe(true);
      expect(enBundle?.totalSizeBytes).toBe(1800); // 1000 + 500 + 300

      expect(ptBundle).toBeDefined();
      expect(ptBundle?.bibleVersions).toHaveLength(1);
      expect(ptBundle?.hasCommentaries).toBe(false);
      expect(ptBundle?.hasTopics).toBe(false);
    });

    it('returns empty array for empty manifest', () => {
      const bundles = syncService.buildLanguageBundles({
        bible_versions: [],
        commentary_languages: [],
        topic_languages: [],
      });
      expect(bundles).toHaveLength(0);
    });

    it('normalizes language codes (en-US → en)', () => {
      const manifest = {
        bible_versions: [
          {
            key: 'en-US-KJV',
            language: 'en-US',
            name: 'KJV',
            size_bytes: 100,
            url: '',
            updated_at: '2024-01-01',
          },
          {
            key: 'en-GB-KJV',
            language: 'en-GB',
            name: 'KJV GB',
            size_bytes: 100,
            url: '',
            updated_at: '2024-01-01',
          },
        ],
        commentary_languages: [],
        topic_languages: [],
      };
      const bundles = syncService.buildLanguageBundles(manifest);
      expect(bundles).toHaveLength(1);
      expect(bundles[0].languageCode).toBe('en');
      expect(bundles[0].bibleVersions).toHaveLength(2);
    });
  });

  describe('downloadLanguageBundle', () => {
    beforeEach(() => {
      // Register handlers for all offline download endpoints used by the test manifest
      server.use(
        http.get('https://api.versemate.org/offline/bible/:versionKey', () =>
          HttpResponse.json([])
        ),
        http.get('https://api.versemate.org/offline/commentaries/:lang', () =>
          HttpResponse.json([])
        ),
        http.get('https://api.versemate.org/offline/topics/:lang', () =>
          HttpResponse.json({ topics: [], references: [], explanations: [] })
        )
      );
    });

    it('downloads all components for a language bundle', async () => {
      const progressCalls: any[] = [];
      await syncService.downloadLanguageBundle('en', mockManifest, (p) => progressCalls.push(p));

      expect(progressCalls[progressCalls.length - 1].message).toBe('Complete!');
      // en has bible + commentaries + topics → 3 items
      const downloadingMessages = progressCalls.filter((p) => p.message.startsWith('Downloading'));
      expect(downloadingMessages.length).toBe(3);
    });

    it('only downloads bible version for language without commentary or topics', async () => {
      const progressCalls: any[] = [];
      await syncService.downloadLanguageBundle('pt', mockManifest, (p) => progressCalls.push(p));

      expect(progressCalls[progressCalls.length - 1].message).toBe('Complete!');
      // pt only has bible version → 1 item
      const downloadingMessages = progressCalls.filter((p) => p.message.startsWith('Downloading'));
      expect(downloadingMessages.length).toBe(1);
    });
  });

  describe('deleteLanguageBundle', () => {
    it('removes all content for a language bundle', async () => {
      await syncService.deleteLanguageBundle('en', mockManifest);

      expect(sqliteManager.deleteBibleVersion).toHaveBeenCalledWith('en-KJV');
      expect(sqliteManager.deleteCommentaries).toHaveBeenCalledWith('en');
      expect(sqliteManager.deleteTopics).toHaveBeenCalledWith('en');
    });

    it('skips commentary/topics removal when not present', async () => {
      await syncService.deleteLanguageBundle('pt', mockManifest);

      expect(sqliteManager.deleteBibleVersion).toHaveBeenCalledWith('pt-ACF');
      expect(sqliteManager.deleteCommentaries).not.toHaveBeenCalled();
      expect(sqliteManager.deleteTopics).not.toHaveBeenCalled();
    });
  });

  describe('downloadUserData', () => {
    it('stores notes, highlights, and bookmarks on success', async () => {
      const mockData = {
        notes: [
          {
            note_id: 'n1',
            book_id: 1,
            chapter_number: 1,
            verse_number: 1,
            content: 'Test',
            updated_at: '',
          },
        ],
        highlights: [
          {
            highlight_id: 1,
            book_id: 1,
            chapter_number: 1,
            start_verse: 1,
            end_verse: 2,
            color: 'yellow',
            start_char: null,
            end_char: null,
            updated_at: '',
          },
        ],
        bookmarks: [
          {
            favorite_id: 1,
            book_id: 1,
            chapter_number: 1,
            created_at: '',
            insight_type: undefined,
          },
        ],
      };

      (authenticatedFetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockData)),
      });

      await syncService.downloadUserData();

      expect(sqliteManager.insertUserNotes).toHaveBeenCalledWith(mockData.notes);
      expect(sqliteManager.insertUserHighlights).toHaveBeenCalledWith(mockData.highlights);
      expect(sqliteManager.insertUserBookmarks).toHaveBeenCalledWith(mockData.bookmarks);
      expect(sqliteManager.saveMetadata).toHaveBeenCalled();
    });

    it('throws a session-expired error on 401', async () => {
      (authenticatedFetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve(''),
      });

      await expect(syncService.downloadUserData()).rejects.toThrow(/session expired/i);
    });

    it('throws a generic error on other HTTP failures', async () => {
      (authenticatedFetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 503,
        text: () => Promise.resolve(''),
      });

      await expect(syncService.downloadUserData()).rejects.toThrow('503');
    });

    it('reports progress during download', async () => {
      (authenticatedFetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ notes: [], highlights: [], bookmarks: [] })),
      });

      const progressValues: number[] = [];
      await syncService.downloadUserData((p) => progressValues.push(p.current));

      expect(progressValues[0]).toBe(0);
      expect(progressValues[progressValues.length - 1]).toBeGreaterThan(0);
    });
  });
});
