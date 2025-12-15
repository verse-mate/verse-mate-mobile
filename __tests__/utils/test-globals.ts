/**
 * Typed global object for Jest tests
 *
 * Use this instead of `global` directly to avoid TypeScript errors
 * when accessing React Native's __DEV__ flag in tests.
 *
 * @example
 * import { testGlobal } from '@/__tests__/utils/test-globals';
 *
 * beforeAll(() => {
 *   testGlobal.__DEV__ = false;
 * });
 */
export const testGlobal = global as typeof globalThis & { __DEV__: boolean };
