/**
 * Offline storage + download planning for Bible Brain scripture audio.
 *
 * The licence-shaped behaviour is the important part: a stream-only fileset
 * must be reported, not treated as an error, and must never block the rest of
 * a batch.
 */
import {
  type ChapterRef,
  chapterFileUri,
  deleteFilesetDownloads,
  downloadChapters,
  estimateChapterBytes,
  filesetBytesOnDisk,
  filesetDirUri,
  listDownloadedChapters,
  parseChapterFileName,
  resolveScriptureAudioUrl,
  type ScriptureStoragePort,
} from '@/lib/bible-brain/scripture-storage';

const ROOT = 'file:///data/app/documents';

/** In-memory storage port; records what was written and requested. */
function makeStorage(
  seed: Record<string, number> = {},
  opts: { rootUri?: string | null; failOn?: string } = {}
): ScriptureStoragePort & { files: Map<string, number>; downloads: string[] } {
  const files = new Map<string, number>(Object.entries(seed));
  const downloads: string[] = [];
  const rootUri = opts.rootUri === undefined ? ROOT : opts.rootUri;
  return {
    files,
    downloads,
    get rootUri() {
      return rootUri;
    },
    async exists(uri) {
      return files.has(uri);
    },
    async ensureDir() {
      // no-op: the map is flat
    },
    async download(url, destUri) {
      if (opts.failOn && destUri.includes(opts.failOn)) {
        throw new Error('network unreachable');
      }
      downloads.push(url);
      files.set(destUri, 2_196_712);
      return { size: 2_196_712 };
    },
    async remove(uri) {
      files.delete(uri);
    },
    async list(dirUri) {
      const prefix = `${dirUri}/`;
      return [...files.keys()]
        .filter((key) => key.startsWith(prefix))
        .map((key) => key.slice(prefix.length));
    },
    async sizeOf(uri) {
      return files.get(uri) ?? null;
    },
  };
}

const ESV_JOHN_3: ChapterRef = {
  filesetId: 'ENGESVN1DA',
  book: 'JHN',
  chapter: 3,
};

describe('path helpers', () => {
  it('builds a per-fileset directory and per-chapter filename', () => {
    expect(filesetDirUri(ROOT, 'ENGESVN1DA')).toBe(`${ROOT}/scripture-audio/ENGESVN1DA`);
    expect(chapterFileUri(ROOT, ESV_JOHN_3)).toBe(`${ROOT}/scripture-audio/ENGESVN1DA/JHN-3.mp3`);
  });

  it('tolerates a root with a trailing slash', () => {
    expect(chapterFileUri(`${ROOT}/`, ESV_JOHN_3)).toBe(
      `${ROOT}/scripture-audio/ENGESVN1DA/JHN-3.mp3`
    );
  });

  it('round-trips the filename convention', () => {
    expect(parseChapterFileName('JHN-3.mp3')).toEqual({ book: 'JHN', chapter: 3 });
    expect(parseChapterFileName('GEN-150.mp3')).toEqual({
      book: 'GEN',
      chapter: 150,
    });
  });

  it('rejects names that are not chapter files', () => {
    expect(parseChapterFileName('.DS_Store')).toBeNull();
    expect(parseChapterFileName('JHN-3.tmp')).toBeNull();
    expect(parseChapterFileName('JHN-0.mp3')).toBeNull();
    expect(parseChapterFileName('partial.mp3')).toBeNull();
  });
});

describe('resolveScriptureAudioUrl', () => {
  it('prefers a downloaded file and reports it as offline', async () => {
    const local = chapterFileUri(ROOT, ESV_JOHN_3);
    const storage = makeStorage({ [local]: 1 });
    const result = await resolveScriptureAudioUrl(ESV_JOHN_3, 'https://cdn/signed.mp3', storage);
    expect(result).toEqual({ url: local, isOffline: true });
  });

  it('falls back to the signed stream when nothing is cached', async () => {
    const storage = makeStorage();
    const result = await resolveScriptureAudioUrl(ESV_JOHN_3, 'https://cdn/signed.mp3', storage);
    expect(result).toEqual({ url: 'https://cdn/signed.mp3', isOffline: false });
  });

  it('streams when there is no writable filesystem', async () => {
    const storage = makeStorage({}, { rootUri: null });
    const result = await resolveScriptureAudioUrl(ESV_JOHN_3, 'https://cdn/signed.mp3', storage);
    expect(result.isOffline).toBe(false);
  });
});

describe('downloadChapters', () => {
  const refs: ChapterRef[] = [
    { filesetId: 'ENGESVN1DA', book: 'JHN', chapter: 1 },
    { filesetId: 'ENGESVN1DA', book: 'JHN', chapter: 2 },
    { filesetId: 'ENGESVN1DA', book: 'JHN', chapter: 3 },
  ];

  it('downloads each chapter through a freshly minted url', async () => {
    const storage = makeStorage();
    const resolve = jest.fn(
      async (ref: ChapterRef) => `https://cdn/${ref.book}-${ref.chapter}.mp3?sig=fresh`
    );
    const outcome = await downloadChapters(refs, storage, resolve);
    expect(outcome.downloaded).toBe(3);
    expect(outcome.skipped).toBe(0);
    expect(outcome.notLicensed).toEqual([]);
    expect(outcome.failed).toEqual([]);
    expect(outcome.bytesWritten).toBe(3 * 2_196_712);
    // One signature per chapter — signed urls expire, so they are never reused.
    expect(resolve).toHaveBeenCalledTimes(3);
  });

  it('skips chapters already on disk without hitting the network', async () => {
    const storage = makeStorage({
      [chapterFileUri(ROOT, refs[0])]: 10,
      [chapterFileUri(ROOT, refs[1])]: 10,
    });
    const resolve = jest.fn(async () => 'https://cdn/x.mp3');
    const outcome = await downloadChapters(refs, storage, resolve);
    expect(outcome.skipped).toBe(2);
    expect(outcome.downloaded).toBe(1);
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it('records a stream-only fileset as notLicensed rather than failing', async () => {
    // This is what the backend does for NLT / NKJV / CSB: 404 -> null.
    const storage = makeStorage();
    const outcome = await downloadChapters(refs, storage, async () => null);
    expect(outcome.notLicensed).toHaveLength(3);
    expect(outcome.downloaded).toBe(0);
    expect(outcome.failed).toEqual([]);
    expect(storage.downloads).toEqual([]);
  });

  it('keeps going when one chapter fails, and reports which', async () => {
    const storage = makeStorage({}, { failOn: 'JHN-2' });
    const outcome = await downloadChapters(
      refs,
      storage,
      async (ref) => `https://cdn/${ref.chapter}`
    );
    expect(outcome.downloaded).toBe(2);
    expect(outcome.failed).toHaveLength(1);
    expect(outcome.failed[0].ref.chapter).toBe(2);
    expect(outcome.failed[0].reason).toContain('network unreachable');
  });

  it('reports progress for every chapter including failures', async () => {
    const storage = makeStorage({}, { failOn: 'JHN-2' });
    const seen: string[] = [];
    await downloadChapters(
      refs,
      storage,
      async () => 'https://cdn/x',
      (progress) => {
        seen.push(`${progress.completed}/${progress.total}:${progress.current.chapter}`);
      }
    );
    expect(seen).toEqual(['1/3:1', '2/3:2', '3/3:3']);
  });

  it('fails every chapter when there is no writable filesystem', async () => {
    const storage = makeStorage({}, { rootUri: null });
    const outcome = await downloadChapters(refs, storage, async () => 'https://cdn/x');
    expect(outcome.failed).toHaveLength(3);
    expect(outcome.downloaded).toBe(0);
  });

  it('does nothing for an empty request', async () => {
    const storage = makeStorage();
    const outcome = await downloadChapters([], storage, async () => 'https://cdn/x');
    expect(outcome).toMatchObject({ downloaded: 0, skipped: 0 });
  });
});

describe('bookkeeping', () => {
  it('lists downloaded chapters in book then chapter order', async () => {
    const storage = makeStorage({
      [`${ROOT}/scripture-audio/ENGESVN1DA/JHN-10.mp3`]: 1,
      [`${ROOT}/scripture-audio/ENGESVN1DA/JHN-2.mp3`]: 1,
      [`${ROOT}/scripture-audio/ENGESVN1DA/ACT-1.mp3`]: 1,
    });
    const listed = await listDownloadedChapters('ENGESVN1DA', storage);
    expect(listed).toEqual([
      { book: 'ACT', chapter: 1 },
      { book: 'JHN', chapter: 2 },
      { book: 'JHN', chapter: 10 },
    ]);
  });

  it('ignores stray files when listing and sizing', async () => {
    const storage = makeStorage({
      [`${ROOT}/scripture-audio/ENGESVN1DA/JHN-3.mp3`]: 100,
      [`${ROOT}/scripture-audio/ENGESVN1DA/.DS_Store`]: 9999,
    });
    expect(await listDownloadedChapters('ENGESVN1DA', storage)).toHaveLength(1);
    expect(await filesetBytesOnDisk('ENGESVN1DA', storage)).toBe(100);
  });

  it('deletes only the requested fileset', async () => {
    const storage = makeStorage({
      [`${ROOT}/scripture-audio/ENGESVN1DA/JHN-3.mp3`]: 1,
      [`${ROOT}/scripture-audio/ENGKJVN1DA/JHN-3.mp3`]: 1,
    });
    const removed = await deleteFilesetDownloads('ENGESVN1DA', storage);
    expect(removed).toBe(1);
    expect(await listDownloadedChapters('ENGESVN1DA', storage)).toEqual([]);
    expect(await listDownloadedChapters('ENGKJVN1DA', storage)).toHaveLength(1);
  });
});

describe('estimateChapterBytes', () => {
  it('uses 64 kbps for a standard mp3 fileset', () => {
    // ESV John 3 is 273s / 2,196,712 bytes on the wire — within ~1MB.
    expect(estimateChapterBytes(273, 'ENGESVN1DA')).toBe(2_184_000);
  });

  it('uses 16 kbps for an -opus16 fileset', () => {
    expect(estimateChapterBytes(273, 'ENGESVN1DA-opus16')).toBe(546_000);
  });
});
