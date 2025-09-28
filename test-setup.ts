import { mock } from 'bun:test';

// Mock fetch for global use
global.fetch = mock(() => Promise.resolve(new Response())) as unknown as typeof fetch;

// Mock window for React Native AsyncStorage compatibility
Object.defineProperty(global, 'window', {
  value: {
    localStorage: {
      getItem: mock(() => null),
      setItem: mock(() => {}),
      removeItem: mock(() => {}),
      clear: mock(() => {}),
    },
  },
  writable: true,
});

// Mock React Native modules
const mockDimensions = {
  get: mock(() => ({ width: 375, height: 812 })),
  addEventListener: mock(() => {}),
  removeEventListener: mock(() => {}),
};

const mockPlatform = {
  OS: 'ios',
  Version: '14.0',
  select: mock((options: Record<string, unknown>) => options.ios || options.default),
};

const mockStyleSheet = {
  create: (styles: Record<string, unknown>) => styles,
  flatten: (styles: Record<string, unknown>) => styles,
};

// Export mocks for test files to use
export { mockDimensions, mockPlatform, mockStyleSheet };
