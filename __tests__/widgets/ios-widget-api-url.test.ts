import { readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const widgetSource = readFileSync(path.join(ROOT, 'targets/widget/index.swift'), 'utf8');

function iosInfoPlist(apiUrl: string | undefined): Record<string, unknown> {
  const argv = process.argv;
  const original = process.env.EXPO_PUBLIC_API_URL;
  process.argv = ['node', 'expo', 'config'];
  if (apiUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
  else process.env.EXPO_PUBLIC_API_URL = apiUrl;
  try {
    let infoPlist: Record<string, unknown> = {};
    jest.isolateModules(() => {
      infoPlist = require('../../app.config.js').expo.ios.infoPlist;
    });
    return infoPlist;
  } finally {
    process.argv = argv;
    if (original === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = original;
  }
}

function widgetInfoKey(): string {
  const match = widgetSource.match(/apiBaseURLInfoKey = "([A-Za-z]+)"/);
  if (!match) throw new Error('the widget no longer names the Info.plist key it reads');
  return match[1];
}

describe('iOS widget API base URL', () => {
  it('is written into the app Info.plist under the key the widget reads', () => {
    const key = widgetInfoKey();
    expect(iosInfoPlist('https://api.example.test')[key]).toBe('https://api.example.test');
  });

  it('points a build without an API URL at the local backend', () => {
    expect(iosInfoPlist(undefined)[widgetInfoKey()]).toBe('http://localhost:4000');
    expect(iosInfoPlist('')[widgetInfoKey()]).toBe('http://localhost:4000');
  });
});
