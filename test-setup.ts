import '@testing-library/jest-dom';

// Mock fetch for global use
global.fetch = (() => {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  });
}) as any;
