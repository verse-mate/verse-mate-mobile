import AsyncStorage from '@react-native-async-storage/async-storage';
import { checkVersionPolicy } from '@/src/services/versionPolicy';

process.env.EXPO_PUBLIC_API_URL = 'http://localhost:4000';

jest.mock('@/lib/analytics', () => ({
  analytics: { track: jest.fn() },
  AnalyticsEvent: {
    VERSION_POLICY_FETCHED: 'version_policy_fetched',
    UPGRADE_PROMPT_SHOWN: 'upgrade_prompt_shown',
    UPGRADE_PROMPT_CTA_TAPPED: 'upgrade_prompt_cta_tapped',
    UPGRADE_PROMPT_DISMISSED: 'upgrade_prompt_dismissed',
  },
}));

function makeResponse(body: object, status = 200): Response {
  const bodyStr = JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(bodyStr),
    headers: {
      get: (name: string) => {
        if (name.toLowerCase() === 'content-type') return 'application/json';
        return null;
      },
    },
  } as unknown as Response;
}

let fetchSpy: jest.SpyInstance;

beforeEach(async () => {
  await AsyncStorage.clear();
  fetchSpy = jest.spyOn(global, 'fetch');
});

afterEach(() => {
  fetchSpy.mockRestore();
});

describe('checkVersionPolicy', () => {
  describe('mustUpgrade determination', () => {
    it('returns mustUpgrade: true when currentVersion < minVersion', async () => {
      fetchSpy.mockResolvedValueOnce(
        makeResponse({ minVersion: '2.0.0', version: '2.0.0', releaseNotes: 'Breaking changes' })
      );

      const result = await checkVersionPolicy('1.5.0');

      expect(result.mustUpgrade).toBe(true);
      expect(result.minVersion).toBe('2.0.0');
    });

    it('returns mustUpgrade: false when currentVersion equals minVersion', async () => {
      fetchSpy.mockResolvedValueOnce(
        makeResponse({ minVersion: '1.5.0', version: '1.5.0', releaseNotes: '' })
      );

      const result = await checkVersionPolicy('1.5.0');

      expect(result.mustUpgrade).toBe(false);
    });

    it('returns mustUpgrade: false when currentVersion > minVersion', async () => {
      fetchSpy.mockResolvedValueOnce(
        makeResponse({ minVersion: '1.0.0', version: '2.0.0', releaseNotes: '' })
      );

      const result = await checkVersionPolicy('2.1.0');

      expect(result.mustUpgrade).toBe(false);
    });

    it('handles prerelease correctly: 3.6.1-rc.1 < 3.6.1', async () => {
      fetchSpy.mockResolvedValueOnce(
        makeResponse({ minVersion: '3.6.1', version: '3.6.1', releaseNotes: '' })
      );

      const result = await checkVersionPolicy('3.6.1-rc.1');

      expect(result.mustUpgrade).toBe(true);
    });

    it('handles double-digit minor: 3.9.0 < 3.10.0', async () => {
      fetchSpy.mockResolvedValueOnce(
        makeResponse({ minVersion: '3.10.0', version: '3.10.0', releaseNotes: '' })
      );

      const result = await checkVersionPolicy('3.9.0');

      expect(result.mustUpgrade).toBe(true);
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
