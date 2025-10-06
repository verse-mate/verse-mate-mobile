# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VerseMate Mobile is a React Native application built with Expo Router for Bible reading with AI-powered explanations. The app uses file-based routing and follows React Native best practices.

## Development Commands

### Running the Application
- `bun start` - Start Expo development server
- `bun run ios` - Run on iOS simulator
- `bun run android` - Run on Android emulator
- `bun run web` - Run in web browser

### Code Quality
- `bun run format` - Format code with Biome.js
- `bun run lint` - Run both Biome and ESLint linting
- `bun run lint:fix` - Auto-fix linting issues
- `bun run type-check` - Run TypeScript type checking

### Testing
- `npm run test` or `npm test` - Run Jest tests (use npm, not bun)
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report
- `npm run test:ci` - Run tests in CI mode with coverage
- `maestro test .maestro` - Run E2E tests with Maestro
- `maestro studio` - Open Maestro Studio for interactive E2E testing

**Important**: Always use `npm` for test commands, not `bun`, due to Expo compatibility requirements with the jest-expo preset.

### Storybook
- `bun run storybook:generate` - Generate Storybook stories
- `bun run chromatic:deploy` - Deploy Storybook to Chromatic

## Architecture

### Routing Structure
The app uses Expo Router's file-based routing system:
- `app/_layout.tsx` - Root layout with theme provider
- `app/(tabs)/` - Tab-based navigation screens
- `app/modal.tsx` - Modal screens
- Set `unstable_settings.anchor` in root layout to define initial route

### Component Organization
- `components/` - Reusable UI components
  - `components/ui/` - Base UI primitives
  - `components/*.stories.tsx` - Storybook stories for components
- `hooks/` - Custom React hooks (e.g., `use-color-scheme`, `use-theme-color`)
- `constants/` - Shared constants and theme definitions

### Testing Infrastructure
The project uses a comprehensive testing setup:

**Unit/Integration Tests (Jest)**:
- Test files in `__tests__/**/*.test.{ts,tsx}` or co-located `*.test.{ts,tsx}`
- Uses `jest-expo` preset with React Native Testing Library
- MSW (Mock Service Worker) for API mocking
- Mock handlers organized in `__tests__/mocks/handlers/`
- Mock data in `__tests__/mocks/data/`
- Test setup files: `test-setup.ts` (global setup) and `jest-env-setup.js` (environment)

**E2E Tests (Maestro)**:
- Test flows in `.maestro/` directory (YAML format)
- Platform-specific commands: `bun run maestro:test:ios` and `maestro:test:android`

**Key Testing Patterns**:
- MSW server started in `beforeAll`, reset in `afterEach`, closed in `afterAll`
- Fetch polyfills from `undici` for MSW v2 compatibility
- Console filtering to suppress known warnings (configured in test-setup.ts)
- Path alias `@/*` mapped to root directory in both tsconfig and jest config

### Code Quality Tools
The project uses a dual-linting setup:
- **Biome.js**: Primary formatter and core linting (fast, handles most cases)
- **ESLint**: React Native/React-specific rules (hooks, platform support)

**Configuration**:
- `biome.json`: Formatting (2 spaces, single quotes, semicolons, 100 line width)
- `eslint.config.js`: React hooks rules, platform-specific file handling
- Both run via `lint-staged` on pre-commit hooks

**Git Hooks**:
- Pre-commit: Runs `bun lint-staged` (Biome + ESLint on staged files)
- Pre-push: Runs `bun tsc --noEmit` (TypeScript type checking)

### Path Aliases
Use `@/` prefix to import from project root:
```typescript
import { useColorScheme } from '@/hooks/use-color-scheme';
```

### Platform-Specific Files
Use platform extensions for platform-specific code:
- `.ios.{ts,tsx}` - iOS-specific implementations
- `.android.{ts,tsx}` - Android-specific implementations
- `.web.{ts,tsx}` - Web-specific implementations

Example: `components/ui/icon-symbol.ios.tsx` provides iOS-specific icon implementation.

## Important Notes

- **Package Manager**: Use `bun` for all commands except tests (use `npm` for test commands)
- **TypeScript**: Strict mode enabled, all code must be properly typed
- **React Version**: Using React 19.1.0 with React Native 0.81.4
- **Expo SDK**: Version 54
- **API Mocking**: Always add MSW handlers in `__tests__/mocks/handlers/` for new API endpoints
- **Test Coverage**: Coverage thresholds currently at 0% (infrastructure phase), will increase to 60%+ minimum

## Environment Variables

Check `app.config.js` and `.env` files for environment-specific configuration (not committed to repo).
