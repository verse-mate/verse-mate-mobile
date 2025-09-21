# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-09-21-project-dev-setup/spec.md

> Created: 2025-09-21
> Version: 1.0.0

## Technical Requirements

### Biome.js Configuration
- **Package**: @biomejs/biome (latest stable version)
- **Configuration File**: biome.json in project root
- **Primary Role**: Fast formatting, import organization, and core linting
- **Rules**: TypeScript, React optimized ruleset (non-conflicting with ESLint)
- **Formatting**: 2-space indentation, single quotes, trailing commas
- **Import Organization**: Automatic sorting and grouping
- **File Extensions**: .ts, .tsx, .js, .jsx support

### ESLint Configuration
- **Base Config**: eslint-config-expo for React Native/Expo platform support
- **Conflict Prevention**: eslint-config-biome to disable conflicting rules
- **Platform Support**: .ios.js, .android.js, .web.js file recognition
- **Environment Globals**: Node.js globals for config files (metro.config.js, etc.)
- **Configuration File**: eslint.config.js (flat config format for Expo SDK 53+)
- **Role**: React Native-specific linting rules that Biome doesn't cover

### Husky Git Hooks Setup
- **Package**: husky (latest v8.x)
- **Hooks Directory**: .husky/ in project root
- **Pre-commit Hook**: Run lint-staged validation
- **Pre-push Hook**: Run TypeScript type checking
- **Installation**: Automatic setup via bun prepare script

### Lint-staged Configuration
- **Package**: lint-staged (latest stable)
- **Configuration**: package.json lint-staged section
- **Staged Files Processing**:
  - TypeScript/JavaScript files: Biome.js check and format, then ESLint
  - Type checking: tsc --noEmit on staged TypeScript files
- **Execution Order**: Biome first (fast), then ESLint (React Native rules)
- **Performance**: Only process staged files for fast commits

### Bun Test Framework
- **Packages**:
  - @testing-library/react-native (latest)
  - @testing-library/jest-dom (for custom matchers, compatible with Bun)
- **Configuration**: Built-in Bun test configuration with custom settings in package.json
- **Test Files**: \_\_tests\_\_/ directory and .test.ts/.spec.ts files
- **Setup Files**: Custom matchers and React Native mock setup
- **TypeScript Support**: Native TypeScript support built into Bun test

### TypeScript Configuration
- **Strict Mode**: Enabled for maximum type safety
- **React Native Types**: @types/react-native integration
- **Path Mapping**: Support for absolute imports and aliases
- **Build Target**: ES2020 for modern React Native compatibility

## Approach

### Development Workflow Integration
1. **Developer Setup**: Single bun install configures entire development environment
2. **Real-time Feedback**: IDE integration with Biome.js for immediate formatting and linting
3. **Commit-time Validation**: Husky + lint-staged prevents problematic commits
4. **Push-time Safety**: Type checking on push prevents TypeScript errors in remote repository

### Performance Optimization
- **Incremental Validation**: lint-staged processes only changed files
- **Fast Tooling**: Biome.js chosen for superior speed over ESLint/Prettier combination
- **Parallel Processing**: Bun test and Biome.js utilize multiple CPU cores
- **Cache Optimization**: TypeScript incremental compilation and Bun's native caching enabled

### Error Handling Strategy
- **Graceful Degradation**: Development continues if tools are temporarily unavailable
- **Clear Error Messages**: Specific guidance when validation fails
- **Skip Mechanisms**: Emergency skip options for critical hotfixes
- **Logging**: Detailed logs for debugging tool configuration issues

## External Dependencies

### Required Bun Packages
```json
{
  "devDependencies": {
    "@biomejs/biome": "^1.8.0",
    "eslint": "^9.25.0",
    "eslint-config-expo": "^10.0.0",
    "eslint-config-biome": "^0.2.0",
    "husky": "^8.0.3",
    "lint-staged": "^15.0.0",
    "@testing-library/react-native": "^12.4.0",
    "@testing-library/jest-dom": "^6.1.0"
  }
}
```

### VS Code Integration
- **Extensions**: Biome.js official extension for IDE integration
- **Settings**: Workspace settings for consistent team experience
- **Format on Save**: Automatic formatting integration

### React Native Compatibility
- **Metro Bundler**: Bun test configuration compatible with Metro resolver and React Native
- **Native Modules**: Proper mocking setup for React Native APIs
- **Platform-specific Code**: Testing support for .ios.ts and .android.ts files