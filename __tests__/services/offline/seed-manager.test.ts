/**
 * Seed Manager Tests
 *
 * Verifies that copySeedDatabaseIfNeeded() correctly:
 * - Skips the copy when the database file already exists (existing installs)
 * - Copies the bundled seed DB when the file is absent (fresh installs)
 * - Handles edge cases: missing localUri, filesystem errors
 */

// Mock the require() call for the asset before any imports so Metro/Jest
// resolves it to a stable sentinel value rather than trying to read the binary.
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { copySeedDatabaseIfNeeded, DB_PATH } from '@/services/offline/seed-manager';

jest.mock('@/assets/data/versemate-seed.db', () => 'mock-seed-asset-module', {
  virtual: true,
});

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///app/documents/',
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  copyAsync: jest.fn(),
}));

jest.mock('expo-asset', () => ({
  Asset: {
    fromModule: jest.fn(),
  },
}));

const mockGetInfoAsync = FileSystem.getInfoAsync as jest.Mock;
const mockMakeDirectoryAsync = FileSystem.makeDirectoryAsync as jest.Mock;
const mockCopyAsync = FileSystem.copyAsync as jest.Mock;
const mockFromModule = Asset.fromModule as jest.Mock;

const MOCK_LOCAL_URI = 'file:///bundle/assets/versemate-seed.db';

function makeAsset(localUri: string | null = MOCK_LOCAL_URI) {
  return {
    downloadAsync: jest.fn().mockResolvedValue(undefined),
    localUri,
  };
}

describe('seed-manager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMakeDirectoryAsync.mockResolvedValue(undefined);
    mockCopyAsync.mockResolvedValue(undefined);
  });

  describe('DB_PATH', () => {
    it('points into the expo-sqlite directory under documentDirectory', () => {
      expect(DB_PATH).toBe('file:///app/documents/SQLite/versemate_offline.db');
    });
  });

  describe('copySeedDatabaseIfNeeded()', () => {
    describe('when the database file already exists', () => {
      beforeEach(() => {
        mockGetInfoAsync.mockResolvedValue({ exists: true });
      });

      it('returns without copying the seed', async () => {
        await copySeedDatabaseIfNeeded();

        expect(mockCopyAsync).not.toHaveBeenCalled();
      });

      it('does not create the SQLite directory', async () => {
        await copySeedDatabaseIfNeeded();

        expect(mockMakeDirectoryAsync).not.toHaveBeenCalled();
      });

      it('does not attempt to resolve the asset', async () => {
        await copySeedDatabaseIfNeeded();

        expect(mockFromModule).not.toHaveBeenCalled();
      });
    });

    describe('when the database file does not exist (fresh install)', () => {
      beforeEach(() => {
        mockGetInfoAsync.mockResolvedValue({ exists: false });
        mockFromModule.mockReturnValue(makeAsset(MOCK_LOCAL_URI));
      });

      it('creates the SQLite directory with intermediates', async () => {
        await copySeedDatabaseIfNeeded();

        expect(mockMakeDirectoryAsync).toHaveBeenCalledWith('file:///app/documents/SQLite', {
          intermediates: true,
        });
      });

      it('downloads the seed asset', async () => {
        const asset = makeAsset(MOCK_LOCAL_URI);
        mockFromModule.mockReturnValue(asset);

        await copySeedDatabaseIfNeeded();

        expect(asset.downloadAsync).toHaveBeenCalled();
      });

      it('copies the asset to the correct DB path', async () => {
        await copySeedDatabaseIfNeeded();

        expect(mockCopyAsync).toHaveBeenCalledWith({
          from: MOCK_LOCAL_URI,
          to: DB_PATH,
        });
      });

      it('resolves successfully', async () => {
        await expect(copySeedDatabaseIfNeeded()).resolves.toBeUndefined();
      });
    });

    describe('error cases', () => {
      beforeEach(() => {
        mockGetInfoAsync.mockResolvedValue({ exists: false });
      });

      it('throws when the asset resolves with no localUri', async () => {
        mockFromModule.mockReturnValue(makeAsset(null));

        await expect(copySeedDatabaseIfNeeded()).rejects.toThrow(
          'Could not resolve local URI for seed database asset'
        );
      });

      it('propagates getInfoAsync errors', async () => {
        mockGetInfoAsync.mockRejectedValue(new Error('filesystem unavailable'));

        await expect(copySeedDatabaseIfNeeded()).rejects.toThrow('filesystem unavailable');
      });

      it('propagates copyAsync errors', async () => {
        mockFromModule.mockReturnValue(makeAsset(MOCK_LOCAL_URI));
        mockCopyAsync.mockRejectedValue(new Error('disk full'));

        await expect(copySeedDatabaseIfNeeded()).rejects.toThrow('disk full');
      });

      it('propagates makeDirectoryAsync errors', async () => {
        mockFromModule.mockReturnValue(makeAsset(MOCK_LOCAL_URI));
        mockMakeDirectoryAsync.mockRejectedValue(new Error('permission denied'));

        await expect(copySeedDatabaseIfNeeded()).rejects.toThrow('permission denied');
      });
    });
  });
});
