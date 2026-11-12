import { type Dirent, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { resolveApiBaseUrl } from '@/lib/api/base-url';

const PRODUCTION_HOST = 'api.versemate.org';
const ROOT = path.resolve(__dirname, '../../..');
const SKIPPED_DIRS = new Set([
  'node_modules',
  '__tests__',
  '__mocks__',
  'generated',
  'agent-os',
  'assets',
  'docs',
  'e2e',
  'locales',
  'public',
  'reports',
  'scripts',
  'ios',
  'android',
  'dist',
]);
const SKIPPED_FILES = new Set(['api-url-guard.js']);

function sourceFiles(dir: string): string[] {
  const entries: Dirent[] = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    if (entry.name.startsWith('.')) return [];
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return SKIPPED_DIRS.has(entry.name) ? [] : sourceFiles(full);
    if (SKIPPED_FILES.has(entry.name) || /\.test\./.test(entry.name)) return [];
    return /\.(ts|tsx|js|jsx)$/.test(entry.name) ? [full] : [];
  });
}

type BuildProfile = {
  extends?: string;
  distribution?: string;
  env?: Record<string, string>;
};

function resolvedEnv(profiles: Record<string, BuildProfile>, name: string): Record<string, string> {
  const profile = profiles[name];
  const inherited = profile.extends ? resolvedEnv(profiles, profile.extends) : {};
  return { ...inherited, ...profile.env };
}

function resolvedDistribution(
  profiles: Record<string, BuildProfile>,
  name: string
): string | undefined {
  const profile = profiles[name];
  return (
    profile.distribution ??
    (profile.extends ? resolvedDistribution(profiles, profile.extends) : undefined)
  );
}

describe('API base URL', () => {
  const original = process.env.EXPO_PUBLIC_API_URL;

  afterEach(() => {
    if (original === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = original;
  });

  it('defaults to the local backend when no URL is configured', () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    expect(resolveApiBaseUrl()).toBe('http://localhost:4000');
    process.env.EXPO_PUBLIC_API_URL = '';
    expect(resolveApiBaseUrl()).toBe('http://localhost:4000');
  });

  it('uses the URL a release build sets explicitly', () => {
    process.env.EXPO_PUBLIC_API_URL = `https://${PRODUCTION_HOST}`;
    expect(resolveApiBaseUrl()).toBe(`https://${PRODUCTION_HOST}`);
  });

  it('ships an .env.example that points at the local backend', () => {
    const example = readFileSync(path.join(ROOT, '.env.example'), 'utf8');
    const line = example.split('\n').find((l) => l.startsWith('EXPO_PUBLIC_API_URL='));
    expect(line).toBeDefined();
    expect(new URL(line!.slice('EXPO_PUBLIC_API_URL='.length).trim()).hostname).not.toBe(
      PRODUCTION_HOST
    );
  });

  it('gives every store build profile an explicit https API URL', () => {
    const profiles: Record<string, BuildProfile> = JSON.parse(
      readFileSync(path.join(ROOT, 'eas.json'), 'utf8')
    ).build;
    const storeProfiles = Object.keys(profiles).filter(
      (name) => resolvedDistribution(profiles, name) === 'store'
    );
    expect(storeProfiles).toEqual(expect.arrayContaining(['preview', 'production']));
    for (const name of storeProfiles) {
      expect({ name, url: resolvedEnv(profiles, name).EXPO_PUBLIC_API_URL }).toEqual({
        name,
        url: `https://${PRODUCTION_HOST}`,
      });
    }
  });

  it('has no production fallback hardcoded in app code', () => {
    const files = sourceFiles(ROOT);
    expect(files).toEqual(
      expect.arrayContaining([
        path.join(ROOT, 'lib/api/base-url.ts'),
        path.join(ROOT, 'constants/bible-versions.ts'),
      ])
    );
    const offenders = files
      .filter((file) => readFileSync(file, 'utf8').includes(PRODUCTION_HOST))
      .map((file) => path.relative(ROOT, file));
    expect(offenders).toEqual([]);
  });
});
