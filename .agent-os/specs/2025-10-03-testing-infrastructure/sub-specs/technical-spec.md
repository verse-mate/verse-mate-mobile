# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-10-03-testing-infrastructure/spec.md

> Created: 2025-10-03
> Version: 1.0.0

## Technical Requirements

### Jest Configuration

**Setup:**
- Install Jest with React Native preset (`@react-native/babel-preset`)
- Configure Expo compatibility with `jest-expo` preset
- Set up TypeScript support with `ts-jest` or babel TypeScript transform
- Configure module name mapping for `@/` path aliases
- Set up coverage collection with threshold enforcement
- Configure test environment as `node` for unit tests, `jsdom` for component tests

**Coverage Thresholds:**
```json
{
  "coverageThreshold": {
    "global": {
      "statements": 60,
      "branches": 60,
      "functions": 60,
      "lines": 60
    }
  }
}
```

**Target Coverage:** 80% (aspirational, enforced at 60%)

**File Patterns:**
- Test files: `**/__tests__/**/*.test.{ts,tsx}` or `**/*.test.{ts,tsx}`
- Exclude: `node_modules`, `.expo`, `coverage`, `.agent-os`

### React Native Testing Library

**Setup:**
- Install `@testing-library/react-native` for component testing
- Install `@testing-library/jest-native` for extended matchers (accessibility)
- Configure custom render function with providers (navigation, theme, etc.)
- Set up cleanup automation with `afterEach(cleanup)`

**Accessibility Matchers:**
- `toBeAccessible()`
- `toHaveAccessibilityState()`
- `toHaveAccessibilityValue()`
- All components must pass accessibility validation

### Storybook React Native

**Setup:**
- Install `@storybook/react-native` v6+ with Expo compatibility
- Configure `.storybook/main.js` with stories pattern
- Set up on-device UI for story browsing during development
- Create story index generation script
- Configure addons: controls, actions, viewport

**Story Patterns:**
- Component stories: `src/components/**/*.stories.tsx`
- Screen stories: `src/screens/**/*.stories.tsx`
- Use CSF3 (Component Story Format 3) for cleaner syntax

### Chromatic Integration

**Setup:**
- Install `chromatic` CLI tool
- Configure Chromatic project with GitHub repository link
- Set up build script for Storybook static export
- Configure baseline capture and visual diff settings
- Integrate with GitHub Actions for automatic builds on PR

**Visual Testing:**
- Capture snapshots on every PR
- Review and approve changes through Chromatic UI
- Block merges on unreviewed visual changes (optional, configurable)

### Maestro CLI

**Installation:**
- Global installation: `curl -Ls https://get.maestro.mobile.dev | bash`
- Verify installation: `maestro --version`
- Install Maestro Studio for flow creation: Built-in with CLI

**Flow Configuration:**
- Flows directory: `.maestro/` at project root
- Flow files: YAML format (`*.yaml`)
- Critical flows to implement:
  - User authentication (sign up, login, logout)
  - Bible verse navigation and search
  - Memorization flow (create, practice, review)
  - Settings and preferences

**Execution:**
- Local iOS: `maestro test .maestro/flow-name.yaml --device "iPhone 15"`
- Local Android: `maestro test .maestro/flow-name.yaml --device emulator-5554`

### MSW (Mock Service Worker)

**Setup:**
- Install `msw` for API mocking
- Create handlers directory: `src/test-utils/mocks/handlers/`
- Set up server instance for Node environment (Jest tests)
- Configure request interception for development (optional)

**Mock Data:**
- Use production-like data structures
- Store mock data in `src/test-utils/mocks/data/`
- Version mock data with API schema changes
- Support CRUD operations for realistic testing

**Integration Points:**
- Jest: Start server in `setupFilesAfterEnv`
- Storybook: Start server in `.storybook/preview.js`
- Reset handlers between tests

### CI/CD Integration

**GitHub Actions Workflow:**
- Trigger: Pull requests to `main` branch
- Jobs:
  1. **Unit & Integration Tests**: Run Jest with coverage
  2. **Visual Tests**: Build Storybook, publish to Chromatic
  3. **E2E Tests**: Run Maestro flows (iOS and Android simulators)
  4. **Coverage Report**: Upload to Codecov or similar service

**Merge Protection:**
- Require all test jobs to pass
- Require coverage to meet 60% minimum threshold
- Require Chromatic builds to complete (review optional based on team preference)

**Workflow File:** `.github/workflows/test.yml`

## Approach

1. **Phase 1: Jest Foundation** (Week 1)
   - Install and configure Jest with React Native preset
   - Set up Testing Library and accessibility matchers
   - Create example component and screen tests
   - Configure coverage thresholds and reporting

2. **Phase 2: Visual Testing** (Week 1-2)
   - Set up Storybook React Native
   - Create stories for existing components
   - Integrate Chromatic and capture baseline
   - Document story creation patterns

3. **Phase 3: API Mocking** (Week 2)
   - Install and configure MSW
   - Create handlers for existing API endpoints
   - Generate production-like mock data
   - Integrate with Jest and Storybook

4. **Phase 4: E2E Testing** (Week 2-3)
   - Install Maestro CLI
   - Create flows for critical user journeys
   - Document flow creation process
   - Set up local execution scripts

5. **Phase 5: CI/CD Integration** (Week 3)
   - Create GitHub Actions workflow
   - Configure merge protection rules
   - Set up coverage reporting
   - Test full pipeline with sample PR

6. **Phase 6: AI Standards Documentation** (Week 3-4)
   - Document test generation patterns
   - Create AI prompts and templates
   - Establish naming conventions
   - Publish comprehensive testing guide

## External Dependencies

**NPM Packages:**
- `jest` - Test runner
- `@testing-library/react-native` - Component testing utilities
- `@testing-library/jest-native` - Accessibility and native matchers
- `react-test-renderer` - React component rendering for Jest
- `@storybook/react-native` - Component development and visual testing
- `chromatic` - Visual regression testing service
- `msw` - API request mocking
- `jest-expo` - Expo-specific Jest configuration

**Global Tools:**
- `maestro-cli` - E2E testing framework (installed globally via curl)

**Services:**
- **Chromatic**: Visual regression testing service (requires account and project setup)
- **GitHub Actions**: CI/CD platform (included with GitHub repository)
- **Codecov** (optional): Coverage reporting service

**Development Tools:**
- Xcode + iOS Simulator (for iOS testing)
- Android Studio + Android Emulator (for Android testing)
