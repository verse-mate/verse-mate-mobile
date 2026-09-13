/**
 * Narration follows the translation being read. These tests pin the two
 * decisions that behaviour rests on: which language we ask for, and which
 * voice we default to.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import React, { type ReactNode } from 'react';
import { useScriptureForVersion } from '@/hooks/bible-brain/use-scripture-for-version';

jest.setTimeout(20_000);

let mockVersion = 'NASB1995';
jest.mock('@/hooks/use-bible-version', () => ({
  useBibleVersion: () => ({ bibleVersion: mockVersion, setBibleVersion: jest.fn() }),
}));

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useScriptureForVersion', () => {
  it('derives eng from a regional en-US version tag', async () => {
    mockVersion = 'NASB1995';
    const { result } = renderHook(() => useScriptureForVersion(), { wrapper });
    await waitFor(() => expect(result.current.language).toBe('eng'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.versions.length).toBeGreaterThan(0);
  });

  it('prefers the SAME translation as the one being read', async () => {
    // Reading KJV should narrate KJV, not the "best" voice available.
    mockVersion = 'KJV';
    const { result } = renderHook(() => useScriptureForVersion(), { wrapper });
    await waitFor(() => expect(result.current.preferred).not.toBeNull());
    expect(result.current.preferred?.abbr).toBe('ENGKJV');
    expect(result.current.preferredMatchesReading).toBe(true);
  });

  it('falls back to the most capable voice when the translation has no audio', async () => {
    // NASB has no narration on this key; the fallback must be timed AND
    // downloadable rather than simply first in the list.
    mockVersion = 'NASB1995';
    const { result } = renderHook(() => useScriptureForVersion(), { wrapper });
    await waitFor(() => expect(result.current.preferred).not.toBeNull());
    expect(result.current.preferredMatchesReading).toBe(false);
    expect(result.current.preferred?.has_verse_timing).toBe(true);
    expect(result.current.preferred?.offline_capable).toBe(true);
  });

  it('reports German as having no narration rather than an empty list', async () => {
    mockVersion = 'SCH51';
    const { result } = renderHook(() => useScriptureForVersion(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.language).toBe('deu');
    expect(result.current.preferred).toBeNull();
    expect(result.current.unavailableForLanguage).toBe(true);
  });

  it('maps a Romanian version to ron', async () => {
    mockVersion = 'VDC';
    const { result } = renderHook(() => useScriptureForVersion(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.language).toBe('ron');
  });
});
