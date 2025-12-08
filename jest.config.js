module.exports = {
  preset: 'jest-expo',

  // Disable Expo winter runtime in tests
  testEnvironmentOptions: {
    customExportConditions: ['node', 'require'],
  },

  // Module name mapper for path aliases
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },

  // Test file patterns
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}', '**/*.test.{ts,tsx}'],

  // Files to exclude from testing
  testPathIgnorePatterns: ['/node_modules/', '/.expo/', '/coverage/', '/agent-os/'],

  // Transform Expo, React Native, and MSW packages
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|msw|@mswjs/.*|@bundled-es-modules/.*|until-async))',
  ],

  // Ignore flow type files
  modulePathIgnorePatterns: ['<rootDir>/node_modules/.*\\.flow$'],

  // Setup files
  setupFiles: [
    '<rootDir>/jest-env-setup.js',
    '<rootDir>/node_modules/jest-expo/src/preset/setup.js',
  ],
  setupFilesAfterEnv: ['<rootDir>/test-setup.ts'],

  // Coverage configuration
  collectCoverageFrom: [
    '**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/*.stories.{ts,tsx}',
    '!**/node_modules/**',
    '!**/.expo/**',
    '!**/coverage/**',
    '!**/agent-os/**',
    '!**/.rnstorybook/**',
    '!**/babel.config.js',
    '!**/jest.config.js',
    '!**/__tests__/**',
  ],

  // Coverage thresholds: Start low during infrastructure setup phase
  // TODO: Gradually increase to 60% minimum, 80% target as real tests are added
  coverageThreshold: {
    global: {
      statements: 0,
      branches: 0,
      functions: 0,
      lines: 0,
    },
  },

  // Test environment
  testEnvironment: 'node',

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // Verbose output for better debugging
  verbose: true,
};
