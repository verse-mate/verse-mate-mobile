import '@testing-library/jest-native/extend-expect';
import { FormData, fetch, Headers, Request, Response } from 'undici';
import { server } from './__tests__/mocks/server';

// Polyfill fetch for Node.js environment (required for MSW v2)
global.fetch = fetch as any;
global.FormData = FormData as any;
global.Headers = Headers as any;
global.Request = Request as any;
global.Response = Response as any;

// Polyfill import.meta for Expo winter runtime without overwriting existing globals
const g: any = global as any;
g.import = g.import ?? {};
g.import.meta = g.import.meta ?? {};
g.import.meta.url = g.import.meta.url ?? '';
g.import.meta.resolve = g.import.meta.resolve ?? ((specifier: string) => specifier);

// Store original console methods to restore after tests
let originalError: typeof console.error;
let originalWarn: typeof console.warn;

beforeAll(() => {
  // Start MSW server
  server.listen({ onUnhandledRequest: 'error' });

  // Store original console methods
  originalError = console.error;
  originalWarn = console.warn;

  // Create filtered console methods
  const filteredError = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render') ||
        args[0].includes('Not implemented: HTMLFormElement.prototype.submit'))
    ) {
      return;
    }
    originalError(...args);
  };

  const filteredWarn = (...args: any[]) => {
    if (typeof args[0] === 'string' && args[0].includes('Animated: `useNativeDriver`')) {
      return;
    }
    originalWarn(...args);
  };

  console.error = filteredError as typeof console.error;
  console.warn = filteredWarn as typeof console.warn;
});

afterEach(() => {
  server.resetHandlers();
  // Restore console methods after each test in case tests modify them
  console.error = originalError;
  console.warn = originalWarn;
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
  server.close();
});
