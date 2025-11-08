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
- `npm run test:slow` - Run slow/memory-intensive tests (skipped by default)
- `maestro test .maestro` - Run E2E tests with Maestro
- `maestro studio` - Open Maestro Studio for interactive E2E testing

**Important**: Always use `npm` for test commands, not `bun`, due to Expo compatibility requirements with the jest-expo preset.

**Slow Tests**: Tests in files matching `*.slow.test.{ts,tsx}` are skipped by default to prevent memory issues. They run only when `RUN_SLOW_TESTS=1` is set. Use `npm run test:slow` to run them with proper heap configuration. These tests may still cause OOM errors due to unresolved timer leak issues.

### API Code Generation

The project uses `@hey-api/openapi-ts` to generate TypeScript API client code from the OpenAPI schema.

**Commands**:
- `bun generate:api` - Generate API client from `openapi.json`
- `curl https://api.verse-mate.apegro.dev/openapi/json -o openapi.json` - Download latest OpenAPI schema

**When to Regenerate**:
1. When backend API changes (new endpoints, modified request/response schemas)
2. After downloading updated `openapi.json` from the backend
3. When API types become out of sync with backend

**Post-Regeneration Steps**:
1. **Update MSW Mock Handlers**: After regenerating the API client, MSW mock handlers in `__tests__/mocks/handlers/` must be updated to match:
   - New endpoint paths (e.g., `/bible/book/{bookId}/{chapterNumber}`)
   - Updated request/response types from `src/api/generated/types.gen.ts`
   - Query parameter formats
   - Base URL (handlers must use `http://localhost:4000` to match `client.gen.ts`)
2. **Run Tests**: Execute `npm test` to identify any handlers that need updates
3. **Fix Handler Mismatches**: Look for MSW errors like "no matching request handler" and update handlers accordingly

**Generated Files** (do not edit manually):
- `src/api/generated/types.gen.ts` - TypeScript type definitions
- `src/api/generated/client.gen.ts` - API client configuration
- `src/api/generated/sdk.gen.ts` - API SDK methods
- `src/api/generated/@tanstack/react-query.gen.ts` - React Query hooks

### Storybook
- `bun run storybook:generate` - Generate Storybook stories
- `bun run chromatic:deploy` - Deploy Storybook to Chromatic

### Visual Reference Tooling (Playwright)

**Purpose**: This tooling enables AI to "see" the VerseMate web application by capturing on-demand screenshots and metadata from https://app.versemate.org. This helps maintain visual consistency and understand web app functionality when developing the mobile version.

**Capture Commands**:
- `npm run capture:page -- --url=/ --name=home-page` - Capture single page with metadata
- `npm run capture:journey -- --journey=homepage-exploration` - Replay and capture user journey
- `npx playwright test scripts/visual-reference/` - Run all visual reference tests (105 tests)

**Testing Commands**:
- `npx playwright test` - Run Playwright verification tests
- `npx playwright test --headed` - Run tests in headed mode (visible browser)
- `npx playwright test --project=desktop` - Run tests for specific viewport

**What Gets Captured**:
- Multi-viewport screenshots (desktop 1920x1080, tablet 768x1024, mobile 375x667)
- HTML structure (recursive tree traversal)
- Computed CSS styles (typography, colors, spacing, layout)
- Design tokens (CSS custom properties)
- Generated reference markdown with visual documentation

**File Structure**:
- `scripts/visual-reference/` - Core capture utilities and test files
- `scripts/visual-reference/types/index.ts` - TypeScript type definitions
- `.agent-os/references/examples/` - Captured page examples (gitignored except examples)
- `.agent-os/references/journeys/` - Journey definition files (TypeScript)
- `playwright.config.ts` - Playwright configuration

**Journey System**:
- Define user flows as TypeScript files in `.agent-os/references/journeys/`
- Journey format: TypeScript objects with steps (navigate, click, type, scroll)
- Automated replay captures screenshots at each step
- See `.agent-os/commands/capture-journey.md` for journey creation guide

**Use Cases**:
1. Capture web app pages before implementing mobile equivalent
2. Compare web vs mobile design consistency
3. Extract design tokens and styling information
4. Document user flows for mobile implementation
5. Provide visual context to AI during development

### Web Repository Reference

**Purpose**: The main VerseMate web application repository is available as a git submodule for AI reference when implementing mobile features. This allows accurate translation of web features to React Native.

**Location**: `.agent-os/web-repo/` (gitignored, not committed to mobile repo)

**Setup for new developers**:
```bash
git submodule update --init
```

**Update to latest web code**:
```bash
git submodule update --remote
```

**Current web repo version**: The submodule tracks the main branch of [verse-mate/verse-mate](https://github.com/verse-mate/verse-mate)

**Usage**:
- AI can directly read web implementation code when implementing mobile features
- Reference web components, hooks, services, and business logic
- Ensure feature parity between web and mobile versions
- Web repo is read-only reference - no modifications needed

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
- Pre-commit: Runs `bun lint-staged` (Biome + ESLint on staged files) + `bun tsc --noEmit` (TypeScript type checking)
- Pre-push: Available for additional checks (tests disabled by default)

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
