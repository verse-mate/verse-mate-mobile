/**
 * Global type declarations for test files
 *
 * Extends globalThis to include __DEV__ which is set by React Native
 * at runtime but needs to be declared for TypeScript in test files.
 */

declare global {
  // React Native's development mode flag - available on globalThis
  var __DEV__: boolean;
}

export {};
