// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const reactCompilerPlugin = require('eslint-plugin-react-compiler');
const i18nextPlugin = require('eslint-plugin-i18next');
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

  // i18n: forbid raw English strings in user-facing UI (D-016 part 3).
  // Warn (not error) until the chapter-reader and remaining modal/component
  // screens are codemodded — escalate to error once coverage is complete.
  // Scoped to app/ and components/ where rendered strings live; lib/, hooks/,
  // utils/ are exempt because they don't render text directly.
  {
    files: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}', '**/*.stories.{ts,tsx}', 'components/ui/icons/**'],
    plugins: { i18next: i18nextPlugin },
    rules: {
      'i18next/no-literal-string': [
        'warn',
        {
          markupOnly: true,
          // Function args to skip — already wrapped in i18n or pure config.
          callees: { exclude: ['^(t|i18n\\.t|i18next\\.t)$'] },
          // JSX attributes that don't surface to users.
          'jsx-attributes': {
            exclude: [
              '^(testID|nativeID|accessibilityRole|placeholderTextColor|keyboardType|autoCapitalize|autoComplete|autoCorrect|textContentType|returnKeyType|secureTextEntry|spellCheck|name|source|style|className|key|color|size|variant|fullWidth|numberOfLines|ellipsizeMode)$',
            ],
          },
          // Words/phrases short enough to be technical or already-localized.
          words: { exclude: ['^[A-Z_]+$', '^\\d+$', '^\\s*$'] },
        },
      ],
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
