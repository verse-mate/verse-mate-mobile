/**
 * TASK-010: AudioResolver tests — local-file preference, download
 * dedup, delete by language, estimate size.
 */
import {
  type AudioDownloadDeps,
  type AudioManifestEntry,
  type FileSystemLike,
  deleteLanguageAudios,
  downloadAudios,
  estimateAudioBundleBytes,
  formatBytes,
  localAudioPath,
  resolveAudioUrl,
} from "../lib/audio/audioResolver";

function entry(overrides: Partial<AudioManifestEntry> = {}): AudioManifestEntry {
  return {
    explanation_id: 1,
    voice: "alloy",
    language_code: "en",
    content_hash: "abc",
    duration_seconds: 60,
    audio_url: "https://cdn.test/1/alloy/en/abc.mp3?sig=x",
    ...overrides,
  };
}

function makeFs(existing: Set<string>): AudioDownloadDeps["fs"] & { written: string[] } {
  return {
    documentDirectory: "/doc/",
    exists: async (p: string) => existing.has(p),
    makeDirectoryAsync: async () => {},
    downloadAsync: async (_url: string, localPath: string) => {
      existing.add(localPath);
      fs.written.push(localPath);
      return { uri: localPath };
    },
    deleteAsync: async (path: string) => {
      existing.delete(path);
    },
    written: [] as string[],
  } as any;
  // biome-ignore format: shape doesn't fit a narrower type
}

// Satisfy the forward reference inside makeFs
let fs: ReturnType<typeof makeFs>;

describe("audioResolver", () => {
  test("localAudioPath follows the documented schema", () => {
    const path = localAudioPath("/doc/", entry());
    expect(path).toBe("/doc/audio/explanation-audio/1/alloy/en/abc.mp3");
  });

  test("resolveAudioUrl picks local file when present", async () => {
    const local = new Set(["/doc/audio/explanation-audio/1/alloy/en/abc.mp3"]);
    const fsL: FileSystemLike = {
      documentDirectory: "/doc/",
      exists: async (p) => local.has(p),
    };
    const url = await resolveAudioUrl(entry(), fsL);
    expect(url).toBe("file:///doc/audio/explanation-audio/1/alloy/en/abc.mp3");
  });

  test("resolveAudioUrl falls back to streaming URL when no local cache", async () => {
    const fsL: FileSystemLike = {
      documentDirectory: "/doc/",
      exists: async () => false,
    };
    const url = await resolveAudioUrl(entry(), fsL);
    expect(url).toContain("https://cdn.test/");
  });

  test("resolveAudioUrl falls back when documentDirectory is unavailable", async () => {
    const fsL: FileSystemLike = {
      documentDirectory: null,
      exists: async () => true,
    };
    const url = await resolveAudioUrl(entry(), fsL);
    expect(url).toContain("https://");
  });

  test("downloadAudios skips existing files + counts downloaded vs skipped", async () => {
    const existing = new Set<string>([
      "/doc/audio/explanation-audio/1/alloy/en/abc.mp3",
    ]);
    fs = makeFs(existing);
    const result = await downloadAudios(
      [entry(), entry({ explanation_id: 2, content_hash: "xyz" })],
      { fs } as AudioDownloadDeps,
    );
    expect(result.skipped).toBe(1);
    expect(result.downloaded).toBe(1);
    expect(fs.written).toEqual([
      "/doc/audio/explanation-audio/2/alloy/en/xyz.mp3",
    ]);
  });

  test("deleteLanguageAudios deletes only the named language", async () => {
    const existing = new Set<string>([
      "/doc/audio/explanation-audio/1/alloy/en/abc.mp3",
      "/doc/audio/explanation-audio/1/alloy/pt/def.mp3",
    ]);
    fs = makeFs(existing);
    const removed = await deleteLanguageAudios(
      "en",
      [
        entry(),
        entry({ language_code: "pt", content_hash: "def" }),
      ],
      { fs } as AudioDownloadDeps,
    );
    expect(removed).toBe(1);
    expect(existing.has("/doc/audio/explanation-audio/1/alloy/en/abc.mp3")).toBe(
      false,
    );
    expect(existing.has("/doc/audio/explanation-audio/1/alloy/pt/def.mp3")).toBe(
      true,
    );
  });

  test("estimateAudioBundleBytes ≈ duration × 16 KB/s", () => {
    const size = estimateAudioBundleBytes([
      entry({ duration_seconds: 60 }),
      entry({ duration_seconds: 120 }),
    ]);
    // (60 + 120) × 16 × 1024 = 2,949,120
    expect(size).toBe(2_949_120);
  });

  test("formatBytes renders MB / GB", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(3 * 1024 * 1024)).toBe("3.0 MB");
    expect(formatBytes(2 * 1024 * 1024 * 1024)).toBe("2.00 GB");
  });
});
