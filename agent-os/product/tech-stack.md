# Tech Stack

## Framework & Runtime

### Mobile Application Framework
- **Framework:** React Native 0.81.4 with Expo SDK 54
- **Rationale:** Expo provides a managed workflow that accelerates development while maintaining full React Native capabilities. Version 54 offers stable production-ready features with excellent developer experience.

### Language & Runtime
- **Language:** TypeScript (strict mode enabled)
- **Runtime:** React 19.1.0
- **Rationale:** TypeScript's strict mode catches errors at compile time, reducing runtime bugs. React 19 provides the latest concurrent features and performance improvements.

### Package Manager
- **Primary:** Bun
- **Testing Exception:** npm (for test commands due to jest-expo preset compatibility)
- **Rationale:** Bun offers significantly faster install times and script execution. npm is maintained for testing to ensure compatibility with Expo's testing ecosystem.

## Frontend

### Navigation & Routing
- **System:** Expo Router (file-based routing)
- **Structure:**
  - `app/_layout.tsx` - Root layout with theme provider
  - `app/(tabs)/` - Tab-based navigation screens
  - `app/modal.tsx` - Modal screens
- **Rationale:** File-based routing provides intuitive navigation structure that mirrors the app's screen hierarchy, reducing boilerplate code and making the navigation graph immediately visible from file structure.

### UI Architecture
- **Component Organization:**
  - `components/` - Reusable UI components
  - `components/ui/` - Base UI primitives
  - `hooks/` - Custom React hooks (use-color-scheme, use-theme-color)
  - `constants/` - Shared constants and theme definitions
- **Path Aliases:** `@/` prefix for root-relative imports
- **Platform-Specific Code:** `.ios.tsx`, `.android.tsx`, `.web.tsx` extensions
- **Rationale:** Clear separation of concerns with path aliases reducing cognitive load. Platform-specific extensions allow optimized implementations per platform without cluttering core logic.

### Styling & Theming
- **System:** React Native StyleSheet with custom theme system
- **Features:** Light/dark mode support with system preference detection
- **Rationale:** Native StyleSheet API provides optimal performance while custom theme system enables consistent design language across the app.

## Backend

### API Layer
- **Backend:** Node.js backend (separate service)
- **Integration:** RESTful API endpoints
- **Rationale:** Node.js provides consistent JavaScript/TypeScript ecosystem across frontend and backend, simplifying development and type sharing.

## Testing & Quality

### Unit & Integration Testing
- **Framework:** Jest with jest-expo preset
- **Testing Library:** React Native Testing Library
- **API Mocking:** MSW (Mock Service Worker) v2
- **Configuration:**
  - Test files: `__tests__/**/*.test.{ts,tsx}` or co-located `*.test.{ts,tsx}`
  - Mock handlers: `__tests__/mocks/handlers/`
  - Mock data: `__tests__/mocks/data/`
  - Setup: `test-setup.ts` (global), `jest-env-setup.js` (environment)
- **Rationale:** jest-expo provides optimal React Native testing environment. MSW enables realistic API mocking without modifying application code. Path alias mapping in jest.config ensures tests match production imports.

### E2E Testing
- **Framework:** Maestro
- **Test Flows:** `.maestro/` directory (YAML format)
- **Platform Commands:**
  - `bun run maestro:test:ios` - iOS E2E tests
  - `bun run maestro:test:android` - Android E2E tests
  - `maestro studio` - Interactive E2E testing
- **Rationale:** Maestro provides simple, declarative E2E tests without complex setup. YAML format makes tests readable and maintainable by non-developers.

### Visual Testing & Reference
- **Framework:** Playwright
- **Purpose:** Capture screenshots and metadata from web version (https://app.versemate.org) for visual consistency
- **Commands:**
  - `npm run capture:page -- --url=/ --name=home-page` - Single page capture
  - `npm run capture:journey -- --journey=homepage-exploration` - User journey capture
- **Captures:**
  - Multi-viewport screenshots (desktop 1920x1080, tablet 768x1024, mobile 375x667)
  - HTML structure, computed CSS, design tokens
  - Reference markdown with visual documentation
- **Output:** `.agent-os/references/examples/` and `.agent-os/references/journeys/`
- **Rationale:** Ensures mobile app maintains visual consistency with web version. Provides AI-accessible visual context for development decisions.

### Code Quality Tools

#### Primary Linter & Formatter
- **Tool:** Biome.js
- **Configuration:** `biome.json`
- **Rules:** 2 spaces, single quotes, semicolons, 100 line width
- **Rationale:** Biome is significantly faster than ESLint+Prettier while handling most linting and formatting needs. Single tool reduces configuration complexity.

#### Secondary Linter
- **Tool:** ESLint
- **Configuration:** `eslint.config.js`
- **Focus:** React hooks rules, platform-specific file handling
- **Rationale:** ESLint provides specialized React Native and React-specific rules that Biome doesn't cover yet. Dual setup ensures comprehensive code quality.

### Git Hooks
- **Pre-commit:** `bun lint-staged` (Biome + ESLint on staged files)
- **Pre-push:** `bun tsc --noEmit` (TypeScript type checking)
- **Rationale:** Catches formatting and type errors before they reach CI, reducing feedback loop time and maintaining code quality standards.

## Development Tools

### Component Documentation
- **Tool:** Storybook
- **Story Files:** `components/*.stories.tsx`
- **Commands:**
  - `bun run storybook:generate` - Generate stories
  - `bun run chromatic:deploy` - Deploy to Chromatic
- **Rationale:** Storybook enables isolated component development and visual testing. Chromatic integration provides visual regression testing and component library hosting.

### Visual Regression Testing
- **Tool:** Chromatic
- **Integration:** Automated via Storybook deployment
- **Rationale:** Catches unintended visual changes in components before they reach production, ensuring design consistency.

## Testing Strategy

### Test Patterns
- **MSW Lifecycle:**
  - `beforeAll` - Start MSW server
  - `afterEach` - Reset handlers
  - `afterAll` - Close server
- **Fetch Polyfills:** undici for MSW v2 Node.js compatibility
- **Console Filtering:** Suppress known warnings (configured in test-setup.ts)
- **Path Aliases:** `@/*` mapped in both tsconfig and jest config

### Coverage Goals
- **Current:** 0% (infrastructure phase)
- **Target:** 60%+ minimum for production readiness
- **CI Mode:** `npm run test:ci` runs with coverage reporting

## Development Workflows

### Running the Application
- `bun start` - Expo development server
- `bun run ios` - iOS simulator
- `bun run android` - Android emulator
- `bun run web` - Web browser

### Code Quality Workflow
1. `bun run format` - Format code
2. `bun run lint` - Run all linting
3. `bun run lint:fix` - Auto-fix issues
4. `bun run type-check` - TypeScript validation

### Testing Workflow
1. `npm test` - Run all tests
2. `npm run test:watch` - Development mode
3. `npm run test:coverage` - Coverage report
4. `maestro test .maestro` - E2E validation

## Architecture Decisions

### File-Based Routing
**Decision:** Use Expo Router's file-based routing instead of manual navigation configuration.

**Rationale:** Reduces boilerplate, makes navigation structure immediately visible, and aligns with modern web frameworks (Next.js, Remix) that have proven this pattern at scale.

### TypeScript Strict Mode
**Decision:** Enable TypeScript strict mode across the entire codebase.

**Rationale:** Catches more errors at compile time, improves IDE autocomplete, and serves as living documentation. Initial investment pays off in reduced runtime errors and easier refactoring.

### Dual Linting Setup
**Decision:** Use both Biome.js and ESLint instead of ESLint+Prettier.

**Rationale:** Biome handles 90% of linting/formatting needs with 10-100x faster performance. ESLint covers React Native-specific edge cases. Combined approach provides comprehensive coverage with minimal performance impact.

### MSW for API Mocking
**Decision:** Use MSW instead of mocking fetch/axios directly in tests.

**Rationale:** MSW intercepts requests at the network level, making tests more realistic. Tests don't need to know about internal HTTP library implementation, making them more resilient to refactoring.

### Bun with npm Exception
**Decision:** Use Bun for all commands except testing (use npm for tests).

**Rationale:** Bun provides 2-10x faster install and script execution. jest-expo preset has specific compatibility requirements with npm. Pragmatic hybrid approach maximizes speed while maintaining compatibility.

### Platform-Specific Files
**Decision:** Use file extensions (`.ios.tsx`, `.android.tsx`) for platform-specific code instead of Platform.select().

**Rationale:** Clearer separation, better tree-shaking, easier to find platform-specific implementations. Metro bundler automatically picks the correct file per platform.

## Configuration Files

### Core Configuration
- `app.config.js` - Expo app configuration
- `tsconfig.json` - TypeScript compiler settings
- `biome.json` - Biome formatting and linting
- `eslint.config.js` - ESLint React Native rules
- `jest.config.js` - Jest testing configuration
- `playwright.config.ts` - Playwright visual reference configuration

### Environment Variables
- `.env` - Environment-specific configuration (not committed to repo)
- **Usage:** Accessed via `app.config.js` for Expo constants
- **Security:** Never commit secrets or API keys to version control

## Related Assets

### Web Application
- **URL:** https://app.versemate.org
- **Purpose:** Reference implementation for visual consistency and feature parity
- **Integration:** Playwright scripts capture web app screenshots and metadata for mobile development reference
