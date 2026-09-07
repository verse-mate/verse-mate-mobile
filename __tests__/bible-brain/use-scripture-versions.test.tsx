/**
 * Version listing: the split that decides what the download UI offers.
 *
 * Bible Brain licenses downloads per fileset, so a version can be
 * (a) downloadable + timed, (b) downloadable but untimed, (c) timed but
 * stream-only, or (d) text-only. All four appear in the MSW fixture because all
 * four exist in production for English.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { pickAudioFileset, useScriptureVersions } from '@/hooks/bible-brain/use-scripture-versions';
import { mockScriptureVersions } from '../mocks/handlers/bible-brain.handlers';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useScriptureVersions', () => {
  it('loads versions for a language', async () => {
    const { result } = renderHook(() => useScriptureVersions('eng'), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.versions).toHaveLength(5);
  });

  it('buckets downloadable versions separately from stream-only ones', async () => {
    const { result } = renderHook(() => useScriptureVersions('eng'), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.offlineCapable.map((v) => v.abbr)).toEqual([
      'EN1ESV',
      'ENGESV',
      'ENGBER',
    ]);
    // NLT is timed but may only be streamed — it must be offered, just not
    // as a download.
    expect(result.current.streamOnly.map((v) => v.abbr)).toEqual(['ENGNLH']);
  });

  it('excludes a text-only version from both audio buckets', async () => {
    const { result } = renderHook(() => useScriptureVersions('eng'), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const asv = 'ENGASV';
    expect(result.current.offlineCapable.map((v) => v.abbr)).not.toContain(asv);
    expect(result.current.streamOnly.map((v) => v.abbr)).not.toContain(asv);
  });

  it('flags only downloadable AND timed versions as best for the reader', async () => {
    const { result } = renderHook(() => useScriptureVersions('eng'), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    // ENGBER is downloadable but untimed, so it must not appear here.
    expect(result.current.bestForReader.map((v) => v.abbr)).toEqual(['EN1ESV', 'ENGESV']);
  });

  it('returns empty buckets for a language with no content', async () => {
    const { result } = renderHook(() => useScriptureVersions('deu'), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.versions).toEqual([]);
    expect(result.current.offlineCapable).toEqual([]);
  });

  it('does not fetch when no language is given', async () => {
    const { result } = renderHook(() => useScriptureVersions(''), {
      wrapper: createWrapper(),
    });
    expect(result.current.versions).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });
});

describe('pickAudioFileset', () => {
  // By abbr, not index — the fixture order is not part of the contract.
  const byAbbr = (abbr: string) => {
    const found = mockScriptureVersions.find((v) => v.abbr === abbr);
    if (!found) throw new Error(`fixture missing ${abbr}`);
    return found;
  };
  const esv = byAbbr('ENGESV');

  it('picks the NT fileset for a New Testament book', () => {
    expect(pickAudioFileset(esv, 'NT')).toBe('ENGESVN1DA');
  });

  it('picks the OT fileset for an Old Testament book', () => {
    expect(pickAudioFileset(esv, 'OT')).toBe('ENGESVO1DA');
  });

  it('prefers the smaller opus variant when asked', () => {
    expect(pickAudioFileset(esv, 'NT', true)).toBe('ENGESVN1DA-opus16');
  });

  it('returns null when the testament has no audio', () => {
    // NLT ships an NT fileset only.
    expect(pickAudioFileset(byAbbr('ENGNLH'), 'OT')).toBeNull();
  });

  it('returns null for an undefined version', () => {
    expect(pickAudioFileset(undefined, 'NT')).toBeNull();
  });
});
