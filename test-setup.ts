import '@testing-library/jest-native/extend-expect';
import { server } from './__tests__/mocks/server';

// Mock fetch for global use
global.fetch = fetch;

// Mock import.meta for Expo winter runtime
if (typeof (global as any).import === 'undefined') {
  (global as any).import = {
    meta: {
      url: '',
      resolve: (specifier: string) => specifier,
    },
  };
}

// Suppress React Native console warnings during tests
beforeAll(() => {
  // Start MSW server
  server.listen({ onUnhandledRequest: 'error' });

  // Suppress console noise
  const originalError = console.error;
  const originalWarn = console.warn;

  console.error = (...args: any[]) => {
    // Suppress known React Native errors
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render') ||
        args[0].includes('Not implemented: HTMLFormElement.prototype.submit'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };

  console.warn = (...args: any[]) => {
    // Suppress known React Native warnings
    if (typeof args[0] === 'string' && args[0].includes('Animated: `useNativeDriver`')) {
      return;
    }
    originalWarn.call(console, ...args);
  };
});

// Reset handlers after each test to prevent test pollution
afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
