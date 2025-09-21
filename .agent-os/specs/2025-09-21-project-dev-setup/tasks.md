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
- [ ] Install husky package as dev dependency
- [ ] Initialize Husky with bun prepare script
- [ ] Create .husky directory structure
- [ ] Configure pre-commit hook to run lint-staged
- [ ] Configure pre-push hook to run TypeScript type checking
- [ ] Test git hooks functionality

#### Task 1.4: Configure Lint-staged
- [ ] Install lint-staged as dev dependency
- [ ] Add lint-staged configuration to package.json
- [ ] Configure staged file processing for TypeScript/JavaScript files
- [ ] Set up Biome.js check and format commands for staged files (run first)
- [ ] Set up ESLint check for React Native rules (run after Biome)
- [ ] Configure execution order: Biome first, then ESLint
- [ ] Test lint-staged with sample commits

### Phase 2: Testing Infrastructure

#### Task 2.1: Setup Bun Testing Framework
- [ ] Install @testing-library/react-native for component testing
- [ ] Install @testing-library/jest-dom for custom matchers (Bun compatible)
- [ ] Configure Bun test environment for React Native compatibility

#### Task 2.2: Configure Bun Test
- [ ] Configure Bun test settings in package.json
- [ ] Set up test environment for React Native
- [ ] Configure TypeScript support (built-in with Bun)
- [ ] Set up custom matchers and setup files
- [ ] Configure test file patterns and directories

#### Task 2.3: Create Example Tests
- [ ] Create sample component test to validate setup
- [ ] Create sample utility function test
- [ ] Verify test coverage reporting works correctly
- [ ] Test React Native Testing Library integration

### Phase 3: CI/CD Pipeline

#### Task 3.1: Create GitHub Actions Workflow
- [ ] Create .github/workflows/ci.yml file
- [ ] Configure workflow triggers (PR and push to main/develop)
- [ ] Set up Bun environment and caching
- [ ] Add dependency installation step

#### Task 3.2: Add Quality Check Steps
- [ ] Add TypeScript type checking step (tsc --noEmit)
- [ ] Add Biome.js formatting and core linting check (biome ci)
- [ ] Add ESLint React Native rules check (eslint .)
- [ ] Add Bun test execution step
- [ ] Configure proper error reporting and status checks for both linters

#### Task 3.3: Optimize CI Performance
- [ ] Implement Bun cache strategy for faster builds
- [ ] Configure parallel job execution where possible
- [ ] Set up proper failure handling and reporting
- [ ] Test complete CI pipeline with sample pull request

### Phase 4: Documentation and Integration

#### Task 4.1: Update Package.json Scripts
- [ ] Add "format" script for running Biome.js formatting
- [ ] Add "lint" script for running both Biome and ESLint checks
- [ ] Add "lint:fix" script for auto-fixing issues (biome + eslint --fix)
- [ ] Add "type-check" script for TypeScript validation
- [ ] Add "test" script for running Bun tests
- [ ] Add "prepare" script for Husky installation

#### Task 4.2: Create Development Documentation
- [ ] Update README with development setup instructions
- [ ] Document available bun scripts and their purposes
- [ ] Create troubleshooting guide for common setup issues
- [ ] Document code style and contribution guidelines

#### Task 4.3: VS Code Integration Setup
- [ ] Create .vscode/settings.json for workspace settings
- [ ] Configure Biome.js extension recommendations
- [ ] Set up format on save and other editor integrations
- [ ] Test complete developer experience workflow

### Phase 5: Testing and Validation

#### Task 5.1: End-to-End Testing
- [ ] Test complete workflow: clone → install → develop → commit → push
- [ ] Validate pre-commit hooks prevent bad commits
- [ ] Verify GitHub Actions workflow runs correctly on PRs
- [ ] Test emergency skip mechanisms for critical fixes

#### Task 5.2: Team Onboarding Validation
- [ ] Document new developer onboarding process
- [ ] Test setup process on clean environment
- [ ] Validate all tools work correctly after fresh install
- [ ] Gather feedback on developer experience

#### Task 5.3: Performance Verification
- [ ] Measure and document build times
- [ ] Verify lint-staged performance with large changesets
- [ ] Test CI pipeline performance and optimize if needed
- [ ] Document expected performance benchmarks