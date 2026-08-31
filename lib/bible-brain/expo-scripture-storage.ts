/**
 * ScriptureStoragePort backed by expo-file-system's SDK 54 class API
 * (`File` / `Directory` / `Paths`), not the deprecated `legacy` entry point.
 *
 * The class API exposes `exists` and `size` as synchronous properties; the port
 * is async so the same interface can be satisfied on other platforms, hence the
 * trivial wrapping here.
 */
import { Directory, File, Paths } from 'expo-file-system';
import type { ScriptureStoragePort } from './scripture-storage';

/**
 * Module-level singleton.
 *
 * Hooks must not build a fresh port per render: the port is a dependency of
 * every callback they return, so a new object each render makes those callbacks
 * unstable, and any effect depending on them re-runs forever. That showed up as
 * an out-of-memory crash rather than as a visible loop, so it is worth being
 * explicit about.
 */
let singleton: ScriptureStoragePort | null = null;

export function getExpoScriptureStorage(): ScriptureStoragePort {
  if (!singleton) singleton = createExpoScriptureStorage();
  return singleton;
}

export function createExpoScriptureStorage(): ScriptureStoragePort {
  return {
    get rootUri() {
      // Paths.document throws on platforms with no document dir (web).
      try {
        return Paths.document.uri;
      } catch {
        return null;
      }
    },

    async exists(uri) {
      try {
        return new File(uri).exists;
      } catch {
        return false;
      }
    },

    async ensureDir(uri) {
      const dir = new Directory(uri);
      if (!dir.exists) dir.create({ intermediates: true });
    },

    async download(url, destUri) {
      const file = await File.downloadFileAsync(url, new File(destUri));
      return { size: file.size ?? null };
    },

    async remove(uri) {
      const file = new File(uri);
      if (file.exists) file.delete();
    },

    async list(dirUri) {
      try {
        const dir = new Directory(dirUri);
        if (!dir.exists) return [];
        return dir.list().map((entry) => entry.name);
      } catch {
        return [];
      }
    },

    async sizeOf(uri) {
      try {
        const file = new File(uri);
        return file.exists ? (file.size ?? null) : null;
      } catch {
        return null;
      }
    },
  };
}
