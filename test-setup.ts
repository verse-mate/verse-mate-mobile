import '@testing-library/jest-dom';

// Mock fetch for global use
Object.defineProperty(global, 'fetch', {
  value: jest.fn(),
  writable: true,
});
