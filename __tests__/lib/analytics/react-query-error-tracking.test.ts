import { MutationCache, onlineManager, QueryCache, QueryClient } from '@tanstack/react-query';
import { onMutationError, onQueryError } from '@/lib/analytics/react-query-error-tracking';
import { setPostHogInstance, setupClientInterceptors } from '@/lib/api/client-interceptors';
import { queryClient } from '@/lib/query-client';
import { postBibleBookChapterLastReadMutation } from '@/src/api/generated/@tanstack/react-query.gen';
import { client } from '@/src/api/generated/client.gen';
import { mockPostHog } from '../../mocks/posthog-mock';

jest.mock('@/lib/analytics/posthog-provider', () => ({
  getPostHogInstance: () => jest.requireActual('../../mocks/posthog-mock').mockPostHog,
}));
jest.mock('@/lib/auth/token-storage', () => ({
  getAccessToken: jest.fn().mockResolvedValue(null),
}));
jest.mock('@react-native-community/netinfo', () => {
  const listeners: ((state: { isConnected: boolean }) => void)[] = [];
  return {
    addEventListener: (fn: (state: { isConnected: boolean }) => void) => {
      listeners.push(fn);
      return () => {};
    },
    emit: (state: { isConnected: boolean }) => {
      for (const fn of listeners) fn(state);
    },
  };
});

const networkFailure = () => Promise.reject(new TypeError('Network request failed'));

function trackedClient() {
  return new QueryClient({
    queryCache: new QueryCache({ onError: onQueryError }),
    mutationCache: new MutationCache({ onError: onMutationError }),
    defaultOptions: { queries: { gcTime: 0 }, mutations: { gcTime: 0 } },
  });
}

async function failQuery(queryKey: readonly unknown[], queryFn: () => Promise<unknown>) {
  await trackedClient()
    .fetchQuery({ queryKey, queryFn, retry: false, networkMode: 'always' })
    .catch(() => {});
}

describe('react-query error reports', () => {
  const originalFetch = global.fetch;

  beforeAll(() => setupClientInterceptors());

  beforeEach(() => {
    mockPostHog.captureException.mockClear();
    onlineManager.setOnline(true);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    onlineManager.setOnline(true);
    setPostHogInstance(null);
  });

  it('names a failed query by the start of its key, never its user values', async () => {
    await failQuery(['jesus', 'search', 'my private term', 'NIV'], networkFailure);
    expect(mockPostHog.captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Network request failed' }),
      expect.objectContaining({ source: 'react-query', query_key: 'jesus/search' })
    );
    expect(JSON.stringify(mockPostHog.captureException.mock.calls)).not.toContain(
      'my private term'
    );
  });

  it('names a generated API query by its operation, never its query values', async () => {
    await failQuery(
      [{ _id: 'getBibleBookByBookIdByChapterNumber', path: { bookId: 1 }, query: { q: 'secret' } }],
      networkFailure
    );
    expect(mockPostHog.captureException).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ query_key: 'getBibleBookByBookIdByChapterNumber' })
    );
    expect(JSON.stringify(mockPostHog.captureException.mock.calls)).not.toContain('secret');
  });

  it('names a failed mutation by its key', async () => {
    const queryClient = trackedClient();
    await queryClient
      .getMutationCache()
      .build(queryClient, { mutationKey: ['notes', 'sync'], mutationFn: networkFailure })
      .execute(undefined)
      .catch(() => {});
    expect(mockPostHog.captureException).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ source: 'react-query', mutation_key: 'notes/sync' })
    );
  });

  it('reports no network failure while the device is offline', async () => {
    onlineManager.setOnline(false);
    await failQuery(['study'], networkFailure);
    expect(mockPostHog.captureException).not.toHaveBeenCalled();
  });

  it('still reports an offline read that fails on the device', async () => {
    onlineManager.setOnline(false);
    await failQuery(['bible-chapter'], () => Promise.reject(new Error('no such table: chapters')));
    expect(mockPostHog.captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'no such table: chapters' }),
      expect.objectContaining({ query_key: 'bible-chapter' })
    );
  });

  it('names the endpoint of a request that never reached the server, without its query string', async () => {
    global.fetch = jest.fn(networkFailure) as unknown as typeof fetch;
    await failQuery(['getBibleVersions'], () =>
      client.get({ url: '/bible/versions', query: { lang: 'pt-BR' }, throwOnError: true })
    );
    expect(mockPostHog.captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Network request failed' }),
      expect.objectContaining({ endpoint: '/bible/versions', method: 'GET' })
    );
    expect(JSON.stringify(mockPostHog.captureException.mock.calls)).not.toContain('pt-BR');
  });

  it('keeps the query string out of an HTTP error report', async () => {
    global.fetch = jest.fn(
      async () => new Response('{}', { status: 500 })
    ) as unknown as typeof fetch;
    setPostHogInstance(mockPostHog);
    await client.get({ url: '/bible/versions', query: { lang: 'pt-BR' } });
    expect(mockPostHog.captureException).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ endpoint: '/bible/versions', statusCode: 500 })
    );
    expect(JSON.stringify(mockPostHog.captureException.mock.calls)).not.toContain('pt-BR');
  });

  it('names the user preferences query without the user id', async () => {
    await failQuery(
      ['user-theme-preferences', '7f3c2a10-1111-4222-8333-944455556666'],
      networkFailure
    );
    expect(mockPostHog.captureException).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ query_key: 'user-theme-preferences' })
    );
    expect(JSON.stringify(mockPostHog.captureException.mock.calls)).not.toContain('7f3c2a10');
  });

  it('names a generated mutation by its endpoint when it never reaches the server', async () => {
    global.fetch = jest.fn(networkFailure) as unknown as typeof fetch;
    const tracked = trackedClient();
    await tracked
      .getMutationCache()
      .build(tracked, postBibleBookChapterLastReadMutation())
      .execute({ body: { user_id: 'u-1' } } as never)
      .catch(() => {});
    expect(mockPostHog.captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Network request failed' }),
      expect.objectContaining({ endpoint: '/bible/book/chapter/last-read', method: 'POST' })
    );
  });

  it.each([
    [401, 0],
    [500, 1],
  ])(
    'reports an HTTP %i from a query %i time(s), from the request itself',
    async (status, times) => {
      global.fetch = jest.fn(
        async () => new Response('{"error":"x"}', { status })
      ) as unknown as typeof fetch;
      setPostHogInstance(mockPostHog);
      await failQuery(['getBibleVersions'], () =>
        client.get({ url: '/bible/versions', throwOnError: true })
      );
      expect(mockPostHog.captureException).toHaveBeenCalledTimes(times);
      if (times) {
        expect(mockPostHog.captureException).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ endpoint: '/bible/versions', statusCode: status })
        );
      }
    }
  );

  it('never sends a response body as the exception', async () => {
    global.fetch = jest.fn(
      async () => new Response('<html>502 from 203.0.113.9</html>', { status: 502 })
    ) as unknown as typeof fetch;
    await failQuery(['getBibleVersions'], () =>
      client.get({ url: '/bible/versions', throwOnError: true })
    );
    expect(JSON.stringify(mockPostHog.captureException.mock.calls)).not.toContain('203.0.113.9');
  });

  it('passes a rejection with no value through untouched', async () => {
    const result = await trackedClient()
      .fetchQuery({ queryKey: ['x'], queryFn: () => Promise.reject(undefined), retry: false })
      .then(
        () => 'resolved',
        (reason: unknown) => reason
      );
    expect(result).toBeUndefined();
    expect(mockPostHog.captureException).not.toHaveBeenCalled();
  });

  it('reports again once the device is back online', async () => {
    onlineManager.setOnline(false);
    await failQuery(['study'], networkFailure);
    onlineManager.setOnline(true);
    await failQuery(['study'], networkFailure);
    expect(mockPostHog.captureException).toHaveBeenCalledTimes(1);
  });
});

describe('the app query client', () => {
  it('reports through the tracking handlers', () => {
    expect(queryClient.getQueryCache().config.onError).toBe(onQueryError);
    expect(queryClient.getMutationCache().config.onError).toBe(onMutationError);
  });

  it('follows the connection NetInfo reports', () => {
    const netInfo = jest.requireMock('@react-native-community/netinfo') as {
      emit: (state: { isConnected: boolean }) => void;
    };
    onlineManager.subscribe(() => {})();
    netInfo.emit({ isConnected: false });
    expect(onlineManager.isOnline()).toBe(false);
    netInfo.emit({ isConnected: true });
    expect(onlineManager.isOnline()).toBe(true);
  });
});
