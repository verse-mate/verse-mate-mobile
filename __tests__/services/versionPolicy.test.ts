import AsyncStorage from '@react-native-async-storage/async-storage';
import { checkVersionPolicy } from '@/src/services/versionPolicy';

process.env.EXPO_PUBLIC_API_URL = 'http://localhost:4000';

function makeResponse(body: object, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

let fetchSpy: jest.SpyInstance;

beforeEach(async () => {
  await AsyncStorage.clear();
  // Spy after MSW has wrapped global.fetch so we intercept at the right layer
  fetchSpy = jest.spyOn(global, 'fetch');
});

afterEach(() => {
  fetchSpy.mockRestore();
});

describe('checkVersionPolicy', () => {
  describe('mustUpgrade determination', () => {
    it('returns mustUpgrade: true when appVersion < minVersion', async () => {
      fetchSpy.mockResolvedValueOnce(
        makeResponse({ minVersion: '2.0.0', version: '2.0.0', releaseNotes: 'Breaking changes' })
      );

      const result = await checkVersionPolicy('1.5.0');

      expect(result.mustUpgrade).toBe(true);
      expect(result.minVersion).toBe('2.0.0');
    });

    it('returns mustUpgrade: false when appVersion equals minVersion', async () => {
      fetchSpy.mockResolvedValueOnce(
        makeResponse({ minVersion: '1.5.0', version: '1.5.0', releaseNotes: '' })
      );

      const result = await checkVersionPolicy('1.5.0');

      expect(result.mustUpgrade).toBe(false);
    });

    it('returns mustUpgrade: false when appVersion > minVersion', async () => {
      fetchSpy.mockResolvedValueOnce(
        makeResponse({ minVersion: '1.0.0', version: '2.0.0', releaseNotes: '' })
      );

      const result = await checkVersionPolicy('2.1.0');

      expect(result.mustUpgrade).toBe(false);
    });
  });

  describe('fail-open on errors', () => {
    it('returns mustUpgrade: false on network error', async () => {
      fetchSpy.mockRejectedValueOnce(new TypeError('Network request failed'));

      const result = await checkVersionPolicy('1.0.0');

      expect(result.mustUpgrade).toBe(false);
    });

    it('returns mustUpgrade: false on 5xx response', async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse({ error: 'Internal server error' }, 500));

      const result = await checkVersionPolicy('1.0.0');

      expect(result.mustUpgrade).toBe(false);
    });
  });

  describe('AsyncStorage cache', () => {
    it('returns cached result within 5-minute TTL without re-fetching', async () => {
      fetchSpy.mockResolvedValue(
        makeResponse({ minVersion: '3.0.0', version: '3.0.0', releaseNotes: '' })
      );

      // First call — populates cache
      const first = await checkVersionPolicy('2.0.0');
      expect(first.mustUpgrade).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Second call within TTL — uses cache, no additional fetch
      const second = await checkVersionPolicy('2.0.0');
      expect(second.mustUpgrade).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('re-fetches after cache TTL expires', async () => {
      fetchSpy.mockResolvedValue(
        makeResponse({ minVersion: '1.0.0', version: '1.0.0', releaseNotes: '' })
      );

      // Seed an expired cache entry
      await AsyncStorage.setItem(
        'VERSION_POLICY_CACHE',
        JSON.stringify({
          data: { minVersion: '1.0.0', version: '1.0.0', releaseNotes: '' },
          fetchedAt: 0,
        })
      );

      await checkVersionPolicy('2.0.0');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });
});
