import { type Dirent, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { LOCAL_API_URL, resolveApiBaseUrl } from '@/lib/api/base-url';

const PRODUCTION_HOST = 'api.versemate.org';
const ROOT = path.resolve(__dirname, '../../..');
const SOURCE_DIRS = [
  'app',
  'components',
  'contexts',
  'hooks',
  'lib',
  'services',
  'src',
  'utils',
  'widgets',
];
const SKIPPED_DIRS = new Set(['node_modules', '__tests__', 'generated']);

function sourceFiles(dir: string): string[] {
  const entries: Dirent[] = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return SKIPPED_DIRS.has(entry.name) ? [] : sourceFiles(full);
    return /\.(ts|tsx|js|jsx)$/.test(entry.name) && !/\.test\./.test(entry.name) ? [full] : [];
  });
}

describe('API base URL', () => {
  const original = process.env.EXPO_PUBLIC_API_URL;

  afterEach(() => {
    if (original === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = original;
  });

  it('defaults to the local backend when no URL is configured', () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    expect(resolveApiBaseUrl()).toBe(LOCAL_API_URL);
    expect(new URL(resolveApiBaseUrl()).hostname).not.toBe(PRODUCTION_HOST);
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

  it('has no production fallback hardcoded in app code', () => {
    const files = SOURCE_DIRS.flatMap((dir) => sourceFiles(path.join(ROOT, dir)));
    expect(files).toContain(path.join(ROOT, 'lib/api/base-url.ts'));
    const offenders = files
      .filter((file) => readFileSync(file, 'utf8').includes(PRODUCTION_HOST))
      .map((file) => path.relative(ROOT, file));
    expect(offenders).toEqual([]);
  });
});
