# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/2025-09-21-project-dev-setup/spec.md

> Created: 2025-09-21
> Status: Ready for Implementation

## Tasks

### Phase 1: Core Development Tools Setup

#### Task 1.1: Install and Configure Biome.js
- [x] Install @biomejs/biome as dev dependency
- [x] Create biome.json configuration file with React Native/TypeScript rules
- [x] Configure formatting rules (2-space indentation, single quotes, trailing commas)
- [x] Set up import organization and sorting rules
- [x] Configure Biome for fast formatting and core linting (avoid conflicts with ESLint)
- [x] Test Biome.js integration with sample files

#### Task 1.2: Install and Configure ESLint
- [x] Install eslint, eslint-config-expo, and eslint-config-biome as dev dependencies
- [x] Create eslint.config.js with flat config format (Expo SDK 53+)
- [x] Configure eslint-config-expo for React Native platform support
- [x] Add eslint-config-biome as last config to prevent conflicts with Biome
- [x] Test ESLint configuration with platform-specific files (.ios.js, .android.js)
- [x] Verify no conflicts between Biome and ESLint rules

#### Task 1.3: Setup Husky Git Hooks
- [x] Install husky package as dev dependency
- [x] Initialize Husky with bun prepare script
- [x] Create .husky directory structure
- [x] Configure pre-commit hook to run lint-staged
- [x] Configure pre-push hook to run TypeScript type checking
- [x] Test git hooks functionality

#### Task 1.4: Configure Lint-staged
- [x] Install lint-staged as dev dependency
- [x] Add lint-staged configuration to package.json
- [x] Configure staged file processing for TypeScript/JavaScript files
- [x] Set up Biome.js check and format commands for staged files (run first)
- [x] Set up ESLint check for React Native rules (run after Biome)
- [x] Configure execution order: Biome first, then ESLint
- [x] Test lint-staged with sample commits

### Phase 2: Testing Infrastructure

#### Task 2.1: Setup Bun Testing Framework
- [x] Install @testing-library/react-native for component testing
- [x] Install @testing-library/jest-dom for custom matchers (Bun compatible)
- [x] Configure Bun test environment for React Native compatibility

#### Task 2.2: Configure Bun Test
- [x] Configure Bun test settings in package.json
- [x] Set up test environment for React Native
- [x] Configure TypeScript support (built-in with Bun)
- [x] Set up custom matchers and setup files
- [x] Configure test file patterns and directories

#### Task 2.3: Create Example Tests
- [x] Create sample component test to validate setup
- [x] Create sample utility function test
- [x] Verify test coverage reporting works correctly
- [x] Test React Native Testing Library integration

### Phase 3: CI/CD Pipeline

#### Task 3.1: Create GitHub Actions Workflow
- [x] Create .github/workflows/ci.yml file
- [x] Configure workflow triggers (PR and push to main/develop)
- [x] Set up Bun environment and caching
- [x] Add dependency installation step

#### Task 3.2: Add Quality Check Steps
- [x] Add TypeScript type checking step (tsc --noEmit)
- [x] Add Biome.js formatting and core linting check (biome ci)
- [x] Add ESLint React Native rules check (eslint .)
- [x] Add Bun test execution step
- [x] Configure proper error reporting and status checks for both linters

#### Task 3.3: Optimize CI Performance
- [x] Implement Bun cache strategy for faster builds
- [x] Configure parallel job execution where possible
- [x] Set up proper failure handling and reporting
- [x] Test complete CI pipeline with sample pull request

### Phase 4: Documentation and Integration

#### Task 4.1: Update Package.json Scripts
- [x] Add "format" script for running Biome.js formatting
- [x] Add "lint" script for running both Biome and ESLint checks
- [x] Add "lint:fix" script for auto-fixing issues (biome + eslint --fix)
- [x] Add "type-check" script for TypeScript validation
- [x] Add "test" script for running Bun tests
- [x] Add "prepare" script for Husky installation

#### Task 4.2: Create Development Documentation
- [x] Update README with development setup instructions
- [x] Document available bun scripts and their purposes
- [x] Create troubleshooting guide for common setup issues
- [x] Document code style and contribution guidelines

#### Task 4.3: VS Code Integration Setup
- [x] Create .vscode/settings.json for workspace settings
- [x] Configure Biome.js extension recommendations
- [x] Set up format on save and other editor integrations
- [x] Test complete developer experience workflow

### Phase 5: Testing and Validation

#### Task 5.1: End-to-End Testing
- [x] Test complete workflow: clone → install → develop → commit → push
- [x] Validate pre-commit hooks prevent bad commits
- [x] Verify GitHub Actions workflow runs correctly on PRs
- [x] Test emergency skip mechanisms for critical fixes

#### Task 5.2: Team Onboarding Validation
- [x] Document new developer onboarding process
- [x] Test setup process on clean environment
- [x] Validate all tools work correctly after fresh install
- [x] Gather feedback on developer experience

#### Task 5.3: Performance Verification
- [x] Measure and document build times
- [x] Verify lint-staged performance with large changesets
- [x] Test CI pipeline performance and optimize if needed
- [x] Document expected performance benchmarks