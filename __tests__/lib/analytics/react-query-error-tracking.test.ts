import { MutationCache, onlineManager, QueryCache, QueryClient } from '@tanstack/react-query';
import { onMutationError, onQueryError } from '@/lib/analytics/react-query-error-tracking';
import { setPostHogInstance, setupClientInterceptors } from '@/lib/api/client-interceptors';
import { client } from '@/src/api/generated/client.gen';
import { mockPostHog } from '../../mocks/posthog-mock';

jest.mock('@/lib/analytics/posthog-provider', () => ({
  getPostHogInstance: () => jest.requireActual('../../mocks/posthog-mock').mockPostHog,
}));
jest.mock('@/lib/auth/token-storage', () => ({
  getAccessToken: jest.fn().mockResolvedValue(null),
}));

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
    .fetchQuery({ queryKey, queryFn, retry: false })
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

  it('reports nothing while the device is offline', async () => {
    onlineManager.setOnline(false);
    await trackedClient()
      .fetchQuery({
        queryKey: ['study'],
        queryFn: networkFailure,
        retry: false,
        networkMode: 'always',
      })
      .catch(() => {});
    expect(mockPostHog.captureException).not.toHaveBeenCalled();
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
});
