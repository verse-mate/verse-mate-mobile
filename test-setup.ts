import '@testing-library/jest-dom';

// Mock fetch for global use
global.fetch = (() => {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  });
}) as any;

// Mock React Native components and modules
// @ts-expect-error - Jest will be available at runtime
global.jest = global.jest || {
  fn: () => () => {},
  mock: () => {},
  requireActual: (name: string) => require(name),
};

if (typeof jest !== 'undefined') {
  jest.mock('react-native', () => {
    const ReactNative = jest.requireActual('react-native');

    return {
      ...ReactNative,
      Dimensions: {
        get: jest.fn(() => ({ width: 375, height: 812 })),
      },
      Platform: {
        OS: 'ios',
        select: jest.fn((options: any) => options.ios || options.default),
      },
    };
  });

  jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  }));
}
