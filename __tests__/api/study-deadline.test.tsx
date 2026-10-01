/**
 * useStudy: a deadline, then the bundled study — and the fallback is not
 * pinned for the session.
 *
 * Plane Wi-Fi: NetInfo says online, the request neither fails nor finishes.
 * The deadline used to be cleared when the HEADERS arrived, so a body that
 * never finished still hung; and the query is `staleTime: Infinity`, so a
 * fallback taken on one slow response was kept as fresh data until restart.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { useStudy } from '@/src/api/hooks';

const BUNDLED = { steps: [], source: 'bundled' };
jest.mock('@versemate/studies', () => ({
  ...jest.requireActual('@versemate/studies'),
  getStudyFor: jest.fn(async () => BUNDLED),
}));
jest.mock('@/lib/auth/token-storage', () => ({
  getAccessToken: jest.fn(async () => null),
}));

/** A fetch that only ever settles by being aborted. */
function hangingFetch(body?: 'hang') {
  return jest.fn((_url: string, init?: { signal?: AbortSignal }) => {
    return new Promise((resolve, reject) => {
      const abort = () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      init?.signal?.addEventListener('abort', abort);
      if (body === 'hang') {
        // Headers arrive at once; the JSON never does, except by abort.
        resolve({
          ok: true,
          json: () =>
            new Promise((_r, rejectJson) =>
              init?.signal?.addEventListener('abort', () => rejectJson(new Error('aborted')))
            ),
        });
      }
    });
  });
}

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const realFetch = global.fetch;
beforeEach(() => {
  jest.useFakeTimers();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  global.fetch = realFetch;
  client.clear();
  jest.useRealTimers();
});

it('falls back to the bundled study when the request never answers', async () => {
  global.fetch = hangingFetch() as unknown as typeof fetch;
  const { result } = renderHook(() => useStudy(42, 2, 'en-US'), { wrapper });
  // The deadline timer only exists once the request has been made.
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  await act(async () => {
    jest.advanceTimersByTime(2600);
  });
  await waitFor(() => expect(result.current.data).toBe(BUNDLED));
});

it('falls back when the headers arrive but the body never finishes', async () => {
  global.fetch = hangingFetch('hang') as unknown as typeof fetch;
  const { result } = renderHook(() => useStudy(42, 2, 'en-US'), { wrapper });
  // The deadline timer only exists once the request has been made.
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  await act(async () => {
    jest.advanceTimersByTime(2600);
  });
  await waitFor(() => expect(result.current.data).toBe(BUNDLED));
});

it('keeps a fallback only briefly, so the server is asked again later', async () => {
  global.fetch = hangingFetch() as unknown as typeof fetch;
  const { result } = renderHook(() => useStudy(42, 2, 'en-US'), { wrapper });
  // The deadline timer only exists once the request has been made.
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  await act(async () => {
    jest.advanceTimersByTime(2600);
  });
  await waitFor(() => expect(result.current.data).toBe(BUNDLED));
  expect(result.current.isStale).toBe(false);
  await act(async () => {
    jest.advanceTimersByTime(61 * 1000);
  });
  await waitFor(() => expect(result.current.isStale).toBe(true));
});
