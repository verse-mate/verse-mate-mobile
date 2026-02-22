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
}));

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

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
      const mockManifest = { bible_versions: [], commentaries: [], topics: [] };

      server.use(
        http.get('https://api.versemate.org/offline/manifest', () => {
          return HttpResponse.json(mockManifest);
        })
      );

      const result = await syncService.fetchManifest();
      expect(result).toEqual(mockManifest);
    });
  });
});
