import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import * as SQLite from 'expo-sqlite';

const DB_NAME = 'versemate_offline.db';

/** Absolute path where expo-sqlite stores the database file. */
export const DB_PATH = `${FileSystem.documentDirectory}SQLite/${DB_NAME}`;

/**
 * On a fresh install the SQLite database file won't exist yet.
 * Copy the pre-populated seed database from the app bundle so users
 * immediately have NASB1995 + English content without needing a download.
 *
 * Safe to call on every startup — skips if the DB already contains verse data.
 *
 * We deliberately check for actual verse data rather than just file existence.
 * On startup, getDatabaseSync() may be called concurrently while this function
 * is awaiting getInfoAsync(). That call opens the DB file (creating it empty)
 * before our existence check resolves — meaning info.exists would return true
 * for a completely empty DB. Checking row count prevents skipping the seed in
 * that race condition.
 *
 * NOTE: The require() is intentionally inside this function (not at module
 * level). A missing or unbundled asset would throw at module evaluation time
 * and crash the entire import chain (sqlite-manager → OfflineContext → whole
 * app). Keeping it here means a failure throws inside the try-catch in
 * initDatabase() and is handled gracefully. Metro still detects require()
 * calls inside functions for static bundling analysis.
 */
export async function copySeedDatabaseIfNeeded(): Promise<void> {
  console.log('[Seed] Checking DB path:', DB_PATH);

  const info = await FileSystem.getInfoAsync(DB_PATH);
  console.log('[Seed] DB file exists:', info.exists);

  if (info.exists) {
    // File exists — but it may be an empty DB created by a concurrent
    // getDatabaseSync() call racing with getInfoAsync() above. Check for
    // actual verse data before deciding to skip the seed.
    let hasVerseData = false;
    try {
      const checkDb = SQLite.openDatabaseSync(DB_NAME);
      try {
        const tableRow = checkDb.getFirstSync<{ n: number }>(
          "SELECT COUNT(*) as n FROM sqlite_master WHERE type='table' AND name='offline_verses'"
        );
        if ((tableRow?.n ?? 0) > 0) {
          const verseRow = checkDb.getFirstSync<{ n: number }>(
            'SELECT COUNT(*) as n FROM offline_verses LIMIT 1'
          );
          hasVerseData = (verseRow?.n ?? 0) > 0;
        }
      } finally {
        checkDb.closeSync();
      }
    } catch (checkErr) {
      // If we can't open/query the DB, assume it has data to avoid wiping a
      // real install that happens to be unreadable at this moment.
      console.warn('[Seed] Could not check DB contents, assuming data exists:', checkErr);
      hasVerseData = true;
    }

    if (hasVerseData) {
      console.log('[Seed] DB exists with verse data — skipping seed copy');
      return;
    }

    console.log('[Seed] DB file exists but is empty (race condition) — overwriting with seed');
  } else {
    console.log('[Seed] Fresh install — beginning seed copy');
  }

  // biome-ignore lint/suspicious/noExplicitAny: dynamic asset require — type is number (asset registry ID)
  const seedModule: any = require('@/assets/data/versemate-seed.db');
  console.log('[Seed] Asset module type:', typeof seedModule, '| value:', seedModule);

  const dirPath = DB_PATH.substring(0, DB_PATH.lastIndexOf('/'));
  await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
  console.log('[Seed] SQLite directory ensured:', dirPath);

  const asset = Asset.fromModule(seedModule);
  console.log('[Seed] Asset before download — localUri:', asset.localUri, '| uri:', asset.uri);

  await asset.downloadAsync();
  console.log('[Seed] Asset after download — localUri:', asset.localUri, '| uri:', asset.uri);

  if (!asset.localUri) {
    throw new Error('[Seed] Could not resolve local URI for seed database asset');
  }

  console.log('[Seed] Copying from', asset.localUri, 'to', DB_PATH);
  await FileSystem.copyAsync({ from: asset.localUri, to: DB_PATH });

  const finalInfo = await FileSystem.getInfoAsync(DB_PATH);
  console.log(
    '[Seed] Copy complete — DB exists:',
    finalInfo.exists,
    '| size:',
    (finalInfo as { size?: number }).size ?? 'unknown'
  );
}
