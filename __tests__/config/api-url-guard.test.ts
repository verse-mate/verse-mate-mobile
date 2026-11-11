const { checkApiUrl } = require('../../config/api-url-guard');

const PRODUCTION = 'https://api.versemate.org';
const run = (args: string[], env: Record<string, string | undefined> = {}) =>
  checkApiUrl({ argv: ['node', 'expo', ...args], env });

describe('API URL guard in app config', () => {
  it.each([
    [['export', '--platform', 'ios', '--platform', 'android'], undefined],
    [['export', '--platform=android'], 'http://localhost:4000'],
    [['export'], 'http://127.0.0.1:4000'],
    [['export', '-p', 'ios'], 'not a url'],
  ])('refuses a native export of %j with API URL %s', (args, url) => {
    expect(run(args, { EXPO_PUBLIC_API_URL: url }).error).toMatch(/EXPO_PUBLIC_API_URL/);
  });

  it('lets the e2e-test update and the release exports through with an explicit URL', () => {
    const env = { EXPO_PUBLIC_API_URL: PRODUCTION, APP_ENV: 'e2e-test' };
    expect(run(['export', '--platform', 'ios', '--platform', 'android'], env)).toEqual({});
    expect(
      run(['export', '--platform', 'web'], { EXPO_PUBLIC_API_URL: PRODUCTION, CI: 'true' })
    ).toEqual({});
  });

  it('lets a local web export or dev server run against the local default', () => {
    expect(run(['export', '--platform', 'web'])).toEqual({});
    expect(run(['start', '--web'])).toEqual({});
  });

  it('warns when a local run points at the production API', () => {
    expect(run(['start', '--web'], { EXPO_PUBLIC_API_URL: PRODUCTION }).warning).toMatch(
      /production API/
    );
    expect(run(['start'], { EXPO_PUBLIC_API_URL: PRODUCTION, APP_ENV: 'development' })).toEqual({});
  });
});
