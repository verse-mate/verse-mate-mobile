// Test setup specifically for Bun test runner
import { beforeEach } from 'bun:test';

// Mock fetch for global use
global.fetch = (() => {
  const fn = (...args: any[]) =>
    fn._mockReturnValue ||
    Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
      blob: () => Promise.resolve(new Blob()),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    } as Response);
  fn.mockClear = () => {
    fn._calls = [];
    return fn;
  };
  fn.mockResolvedValue = (value: any) => {
    fn._mockReturnValue = Promise.resolve(value);
    return fn;
  };
  fn.mockResolvedValueOnce = (value: any) => {
    fn._mockReturnValue = Promise.resolve(value);
    return fn;
  };
  fn.mockRejectedValue = (error: any) => {
    fn._mockReturnValue = Promise.reject(error);
    return fn;
  };
  fn._calls = [];
  fn._mockReturnValue = Promise.resolve({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers(),
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    blob: () => Promise.resolve(new Blob()),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
  } as Response);
  return fn;
})() as any;

// Mock AsyncStorage
const mockAsyncStorage = {
  getItem: () => Promise.resolve(null),
  setItem: () => Promise.resolve(),
  removeItem: () => Promise.resolve(),
  clear: () => Promise.resolve(),
  getAllKeys: () => Promise.resolve([]),
  multiGet: () => Promise.resolve([]),
  multiSet: () => Promise.resolve(),
  multiRemove: () => Promise.resolve(),
};

// Mock React Native modules
const mockReactNative = {
  Dimensions: {
    get: () => ({ width: 375, height: 812 }),
    addEventListener: () => {},
    removeEventListener: () => {},
  },
  Platform: {
    OS: 'ios',
    Version: '14.0',
    select: (options: any) => options.ios || options.default,
  },
  StyleSheet: {
    create: (styles: any) => styles,
  },
  View: ({ children }: any) => children,
  Text: ({ children }: any) => children,
  ScrollView: ({ children }: any) => children,
  TouchableOpacity: ({ children }: any) => children,
  TextInput: ({ children }: any) => children,
};

// Override module resolution for Bun
const moduleMap = new Map([
  ['@react-native-async-storage/async-storage', { default: mockAsyncStorage }],
  ['react-native', mockReactNative],
]);

// Hook into Bun's module system
if (typeof globalThis.import === 'function') {
  const originalImport = globalThis.import;
  globalThis.import = new Proxy(originalImport, {
    apply(target, thisArg, args) {
      const moduleName = args[0];
      if (moduleMap.has(moduleName)) {
        return Promise.resolve(moduleMap.get(moduleName));
      }
      return target.apply(thisArg, args);
    },
  });
}

// Create global jest-like functions for compatibility
global.jest = {
  fn: () => {
    const fn = (...args: any[]) => {
      fn._calls.push(args);
      return fn._mockReturnValue;
    };
    fn._calls = [];
    fn._mockReturnValue = undefined;
    fn.mockClear = () => {
      fn._calls = [];
      return fn;
    };
    fn.mockReturnValue = (value: any) => {
      fn._mockReturnValue = value;
      return fn;
    };
    fn.mockResolvedValue = (value: any) => {
      fn._mockReturnValue = Promise.resolve(value);
      return fn;
    };
    fn.mockRejectedValue = (error: any) => {
      fn._mockReturnValue = Promise.reject(error);
      return fn;
    };
    return fn;
  },
  clearAllMocks: () => {},
} as any;
