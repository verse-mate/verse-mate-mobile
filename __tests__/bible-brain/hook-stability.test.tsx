/**
 * Regression: the hooks' callbacks must keep a stable identity across renders.
 *
 * They previously defaulted `storage` to `createExpoScriptureStorage()` in the
 * parameter list, which built a new port on every render. Every returned
 * callback depends on the port, so all of them changed identity each render,
 * and any effect depending on one re-ran forever. The visible symptom was a
 * jest heap exhaustion, not a render loop, so this is asserted directly.
 */
import { renderHook } from '@testing-library/react-native';
import React, { type ReactNode } from 'react';
import { AudioPlayerProvider } from '@/contexts/AudioPlayerContext';
import { useScriptureAudio } from '@/hooks/bible-brain/use-scripture-audio';
import { useScriptureDownload } from '@/hooks/bible-brain/use-scripture-download';
import { StubAudioEngine } from '@/lib/audio/stubAudioEngine';
import type { ScriptureStoragePort } from '@/lib/bible-brain/scripture-storage';

jest.mock('@/lib/bible-brain/expo-scripture-storage', () => {
  const port = {
    rootUri: 'file:///documents',
    exists: async () => false,
    ensureDir: async () => {},
    download: async () => ({ size: null }),
    remove: async () => {},
    list: async () => [],
    sizeOf: async () => null,
  };
  return {
    // The point of the fix: the same object every call.
    getExpoScriptureStorage: () => port,
    createExpoScriptureStorage: () => port,
  };
});

describe('useScriptureDownload stability', () => {
  it('keeps its callbacks stable across re-renders with no override', () => {
    const { result, rerender } = renderHook(() => useScriptureDownload());
    const first = {
      download: result.current.download,
      removeFileset: result.current.removeFileset,
      downloadedChapters: result.current.downloadedChapters,
      bytesOnDisk: result.current.bytesOnDisk,
    };
    rerender({});
    rerender({});
    expect(result.current.download).toBe(first.download);
    expect(result.current.removeFileset).toBe(first.removeFileset);
    expect(result.current.downloadedChapters).toBe(first.downloadedChapters);
    expect(result.current.bytesOnDisk).toBe(first.bytesOnDisk);
  });

  it('keeps callbacks stable when given a stable override', () => {
    const port: ScriptureStoragePort = {
      rootUri: null,
      exists: async () => false,
      ensureDir: async () => {},
      download: async () => ({ size: null }),
      remove: async () => {},
      list: async () => [],
      sizeOf: async () => null,
    };
    const { result, rerender } = renderHook(() => useScriptureDownload(port));
    const first = result.current.downloadedChapters;
    rerender({});
    expect(result.current.downloadedChapters).toBe(first);
  });
});

describe('useScriptureAudio stability', () => {
  it('keeps playChapter stable across re-renders', () => {
    // useScriptureAudio reads the shared player, so it needs the provider.
    const engine = new StubAudioEngine();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <AudioPlayerProvider engine={engine}>{children}</AudioPlayerProvider>
    );
    const { result, rerender } = renderHook(() => useScriptureAudio(), { wrapper });
    const first = result.current.playChapter;
    rerender({});
    rerender({});
    expect(result.current.playChapter).toBe(first);
  });
});
