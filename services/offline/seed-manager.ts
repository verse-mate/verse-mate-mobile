import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';

// Referenced at module level so Metro bundles the asset at build time.

const SEED_ASSET = require('@/assets/data/versemate-seed.db');

const DB_NAME = 'versemate_offline.db';

/** Absolute path where expo-sqlite stores the database file. */
export const DB_PATH = `${FileSystem.documentDirectory}SQLite/${DB_NAME}`;

/**
 * On a fresh install the SQLite database file won't exist yet.
 * Copy the pre-populated seed database from the app bundle so users
 * immediately have NASB1995 + English content without needing a download.
 *
 * Safe to call on every startup — returns immediately if the file already
 * exists (existing installs are never touched).
 */
export async function copySeedDatabaseIfNeeded(): Promise<void> {
  const info = await FileSystem.getInfoAsync(DB_PATH);
  if (info.exists) return;

  const dirPath = DB_PATH.substring(0, DB_PATH.lastIndexOf('/'));
  await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });

  const asset = Asset.fromModule(SEED_ASSET);
  await asset.downloadAsync();

  if (!asset.localUri) {
    throw new Error('[Seed] Could not resolve local URI for seed database asset');
  }

  await FileSystem.copyAsync({ from: asset.localUri, to: DB_PATH });
  console.log('[Seed] Pre-populated seed database installed at', DB_PATH);
}
