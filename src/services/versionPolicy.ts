import AsyncStorage from '@react-native-async-storage/async-storage';
import { lt as semverLt } from 'semver';

import { AnalyticsEvent, analytics } from '@/lib/analytics';

const CACHE_KEY = 'VERSION_POLICY_CACHE';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const FETCH_TIMEOUT_MS = 5000;

interface VersionPolicyResponse {
  minVersion: string;
  version: string;
  releaseNotes: string;
}

interface CachedVersionPolicy {
  data: VersionPolicyResponse;
  fetchedAt: number;
}

export interface VersionPolicyResult {
  mustUpgrade: boolean;
  minVersion: string;
  version: string;
  releaseNotes: string;
}

async function fetchVersionPolicy(baseUrl: string): Promise<VersionPolicyResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(`${baseUrl}/api/version-policy`, {
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as VersionPolicyResponse;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function getCachedPolicy(): Promise<VersionPolicyResponse | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached: CachedVersionPolicy = JSON.parse(raw);
    if (Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.data;
    return null;
  } catch {
    return null;
  }
}

async function setCachedPolicy(data: VersionPolicyResponse): Promise<void> {
  try {
    const cached: CachedVersionPolicy = { data, fetchedAt: Date.now() };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch {
    // Cache write failure is non-fatal
  }
}

/**
 * Check the version policy against the running app version.
 * Returns mustUpgrade: true if appVersion < minVersion (uses semver.lt).
 * Fails open (mustUpgrade: false) on any network or parse error.
 * Fires version_policy_fetched analytics event with result: success|error.
 */
export async function checkVersionPolicy(currentVersion: string): Promise<VersionPolicyResult> {
  const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? '';
  if (__DEV__ && !baseUrl) {
    console.warn('[versionPolicy] EXPO_PUBLIC_API_URL is not set — version check will fail open');
  }

  const failOpen: VersionPolicyResult = {
    mustUpgrade: false,
    minVersion: '0.0.0',
    version: '0.0.0',
    releaseNotes: '',
  };

  try {
    let policy = await getCachedPolicy();
    if (!policy) {
      policy = await fetchVersionPolicy(baseUrl);
      await setCachedPolicy(policy);
    }
    const mustUpgrade = semverLt(currentVersion, policy.minVersion) ?? false;
    analytics.track(AnalyticsEvent.VERSION_POLICY_FETCHED, {
      result: 'success',
      currentVersion,
      minVersion: policy.minVersion,
    });
    return { mustUpgrade, ...policy };
  } catch {
    analytics.track(AnalyticsEvent.VERSION_POLICY_FETCHED, {
      result: 'error',
      currentVersion,
      minVersion: '0.0.0',
    });
    return failOpen;
  }
}
