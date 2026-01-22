// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const reactCompilerPlugin = require('eslint-plugin-react-compiler');
const biomeConfig = require('eslint-config-biome');

module.exports = defineConfig([
  // Apply Expo configuration for React Native platform support
  expoConfig,

  // Custom configuration for React Native specific rules
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      'react-compiler': reactCompilerPlugin,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      // React Native specific rules that complement Biome
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/rules-of-hooks': 'error',
      // React Compiler rules for Rules of React violations
      'react-compiler/react-compiler': 'error',
    },
  },

  // Platform-specific files configuration (.ios.js, .android.js, .web.js)
  {
    files: ['**/*.ios.{js,jsx,ts,tsx}', '**/*.android.{js,jsx,ts,tsx}', '**/*.web.{js,jsx,ts,tsx}'],
    rules: {
      // Allow platform-specific code patterns
      'no-console': 'off', // Platform-specific debugging might need console
    },
  },

  // Config files (Node.js environment globals)
  {
    files: [
      'app.config.js',
      'metro.config.js',
      'babel.config.js',
      'eslint.config.js',
      '*.config.js',
    ],
    languageOptions: {
      globals: {
        __dirname: 'readonly',
        process: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
      },
    },
  },

  // Test files configuration
  {
    files: [
      '__tests__/**/*.{ts,tsx,js,jsx}',
      '**/*.test.{ts,tsx,js,jsx}',
      '**/*.spec.{ts,tsx,js,jsx}',
    ],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      // Disable React Compiler rules for test files - they don't go through the compiler
      'react-compiler/react-compiler': 'off',
    },
  },

  // Ignore files
  {
    ignores: ['dist/*', 'node_modules/**', '.expo/**', 'ios/**', 'android/**', 'build/**'],
  },

  // IMPORTANT: Add Biome config last to prevent conflicts with Biome.js
  biomeConfig,
]);
