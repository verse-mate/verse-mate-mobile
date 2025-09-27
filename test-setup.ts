import '@testing-library/jest-dom';

// Mock fetch for global use
(global as any).fetch = (jest.fn as any)();
