/**
 * queryPhase
 *
 * This exists because of a real bug caught on the simulator: the Jesus hub
 * reported "Nothing here yet." over a corpus of 207 events. React Query pauses
 * a query when `onlineManager` says offline — this app bridges that to NetInfo
 * — and a paused query has `isLoading: false` with `data: undefined`, so every
 * screen branching on `isLoading` fell through to its empty state and told the
 * reader the section was empty when the request had never been made.
 */
import { queryPhase } from '@/components/jesus/JesusParts';

describe('queryPhase', () => {
  it('calls a paused query offline, not empty', () => {
    // The exact shape that produced the bug: not loading, no data, never ran.
    expect(queryPhase({ isPending: true, fetchStatus: 'paused' })).toBe('offline');
  });

  it('reports a paused query as offline even once it holds data', () => {
    expect(queryPhase({ isPending: false, fetchStatus: 'paused' })).toBe('offline');
  });

  it('is loading while the request is in flight', () => {
    expect(queryPhase({ isPending: true, fetchStatus: 'fetching' })).toBe('loading');
  });

  it('is loading while a disabled query waits for its parameter', () => {
    // Better a spinner than an empty state for a query that has not been asked.
    expect(queryPhase({ isPending: true, fetchStatus: 'idle' })).toBe('loading');
  });

  it('is ready once the query has settled', () => {
    expect(queryPhase({ isPending: false, fetchStatus: 'idle' })).toBe('ready');
  });

  it('is ready during a background refetch, so the screen keeps its content', () => {
    expect(queryPhase({ isPending: false, fetchStatus: 'fetching' })).toBe('ready');
  });
});
