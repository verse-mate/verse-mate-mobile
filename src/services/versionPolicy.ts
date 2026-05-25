import AsyncStorage from '@react-native-async-storage/async-storage';

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

/** Compare two semver strings X.Y.Z. Returns true if a < b. */
function semverLessThan(a: string, b: string): boolean {
  const parsePart = (s: string) => s.split('.').map((n) => parseInt(n, 10) || 0);
  const [aMajor, aMinor, aPatch] = parsePart(a);
  const [bMajor, bMinor, bPatch] = parsePart(b);
  if (aMajor !== bMajor) return aMajor < bMajor;
  if (aMinor !== bMinor) return aMinor < bMinor;
  return aPatch < bPatch;
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
 * Returns mustUpgrade: true if appVersion < minVersion.
 * Fails open (mustUpgrade: false) on any network or parse error.
 */
export async function checkVersionPolicy(appVersion: string): Promise<VersionPolicyResult> {
  const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? '';
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
    const mustUpgrade = semverLessThan(appVersion, policy.minVersion);
    return { mustUpgrade, ...policy };
  } catch {
    return failOpen;
  }
}
