module.exports = {
  preset: 'jest-expo',

  // Disable Expo winter runtime in tests
  testEnvironmentOptions: {
    customExportConditions: ['node', 'require'],
  },

  // Module name mapper for path aliases
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    // tsconfig maps msw/node to its type file for tsc (see tsconfig.json), and jest-expo applies
    // tsconfig paths too; Jest needs msw's Node build. Listed here, this wins.
    '^msw/node$': '<rootDir>/node_modules/msw/lib/node/index.js',
    // RN 0.88's renderer shims import `react-native/react-private-interface`, which exists only
    // as a package.json `exports` alias. The preset's `^react-native($|/.*)` mapper turns it into
    // a file path that is not there, so 115 suites failed to load; point it at the real file.
    '^react-native/react-private-interface$':
      '<rootDir>/node_modules/react-native/src/react-private-interface.js',
  },

  // Test file patterns
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}', '**/*.test.{ts,tsx}'],

  // Files to exclude from testing
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.expo/',
    '/coverage/',
    '/agent-os/',
    '/\\.agent-os/',
  ],

  // Transform Expo, React Native, and MSW packages
  transformIgnorePatterns: [
    // Whitelist the @versemate packages — they ship .ts
    // source via a github:/file: dep, so Jest needs to run them through
    // babel-jest like any project file.
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|standard-navigation|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|msw|@mswjs/.*|@bundled-es-modules/.*|until-async|@versemate/(studies|visuals|red-letter|bible-search)))',
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
    '!**/.agent-os/**',
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
