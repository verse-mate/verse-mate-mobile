# Technical Stack

## Framework & Runtime

- **Application Framework:** React Native 0.81.4 with Expo SDK 54
- **Navigation Framework:** Expo Router 6.0.10 (file-based routing)
- **Language/Runtime:** TypeScript 5.9.2 (strict mode)
- **Package Manager:** Bun (development), npm (testing only due to jest-expo compatibility)
- **JavaScript Version:** React 19.1.0

## Frontend

- **UI Framework:** React Native with Expo managed workflow
- **UI Components:** Custom components in `components/` directory, Expo UI elements
- **Styling:** React Native StyleSheet with expo-system-ui for system integration
- **State Management:** React built-in state (Context API, useState, useReducer)
- **Data Fetching:** TanStack React Query 5.90.2 with generated hooks from OpenAPI spec
- **Icons:** @expo/vector-icons 15.0.2, expo-symbols 1.0.7

## Mobile-Specific Libraries

- **Navigation:** React Navigation 7.x (@react-navigation/native, @react-navigation/bottom-tabs)
- **Gestures:** react-native-gesture-handler 2.28.0
- **Animations:** react-native-reanimated 4.1.0 with react-native-worklets 0.5.1
- **Images:** expo-image 3.0.8 for optimized image handling
- **Safe Areas:** react-native-safe-area-context 5.6.0
- **Screen Management:** react-native-screens 4.16.0
- **Haptics:** expo-haptics 15.0.7 for tactile feedback
- **Status Bar:** expo-status-bar 3.0.8
- **Date/Time:** @react-native-community/datetimepicker 8.4.4
- **Sliders:** @react-native-community/slider 5.0.1
- **Web Browser:** expo-web-browser 15.0.8
- **Linking:** expo-linking 8.0.8

## Database & Storage

- **Local Storage:** @react-native-async-storage/async-storage 2.2.0
- **Backend API:** VerseMate REST API (api.verse-mate.apegro.dev)
- **API Client:** Axios 1.12.2
- **API Schema:** OpenAPI/Swagger spec with automated code generation

## Testing & Quality

- **Test Framework:** Jest 29.7.0 with jest-expo 54.0.12 preset
- **React Testing:** @testing-library/react-native 13.3.3
- **Testing Utilities:** @testing-library/jest-native 5.4.3, @testing-library/jest-dom 6.8.0
- **API Mocking:** MSW (Mock Service Worker) 2.11.3 with undici 7.16.0 for fetch polyfills
- **E2E Testing:** Maestro CLI for mobile flow testing
- **Visual Reference:** Playwright 1.55.1 for web app screenshot capture
- **Code Formatting:** Biome.js 2.2.4 (primary formatter)
- **Linting:**
  - Biome.js for core linting
  - ESLint 9.25.0 with eslint-config-expo 10.0.0 for React Native specific rules
  - eslint-config-biome 2.1.3 for integration
- **Type Checking:** TypeScript compiler (tsc)
- **Git Hooks:** Husky 9.1.7
- **Pre-commit:** lint-staged 16.1.6 (runs Biome + ESLint on staged files)
- **Test Renderer:** react-test-renderer 19.1.0

## Code Generation

- **OpenAPI Client:** @hey-api/openapi-ts 0.85.0 for TypeScript types generation
- **React Query Hooks:** @7nohe/openapi-react-query-codegen 1.6.2 for automatic hook generation from OpenAPI spec

## Component Documentation

- **Storybook:** @storybook/react-native 9.1.4
- **Storybook Addons:**
  - @storybook/addon-ondevice-actions 9.1.4
  - @storybook/addon-ondevice-backgrounds 9.1.4
  - @storybook/addon-ondevice-controls 9.1.4
  - @storybook/addon-ondevice-notes 9.1.4
- **Visual Testing:** Chromatic 13.3.0

## Development Tools

- **Build System:** Metro bundler (React Native default)
- **Hot Reload:** Expo Fast Refresh
- **Cross-Platform Support:** React Native Web 0.21.0
- **Environment Variables:** Expo Constants 18.0.9
- **Font Loading:** expo-font 14.0.8
- **Splash Screen:** expo-splash-screen 31.0.10
- **Environment Utilities:** cross-env 10.1.0

## Deployment & Infrastructure

- **Application Hosting:** Expo Application Services (EAS) for builds and updates
- **App Distribution:** Apple App Store and Google Play Store
- **Version Control:** Git
- **CI/CD:** GitHub Actions (planned) with EAS Build and Submit
- **Asset Hosting:** Expo CDN for bundled assets

## Third-Party Services

- **Backend Services:** VerseMate API for Bible content, AI explanations, and user data
- **Authentication:** Integration with VerseMate authentication system (planned)
- **AI Services:** VerseMate AI explanation and translation APIs (planned integration)
- **Fonts:** System fonts and @expo-google-fonts (if needed)

## Architecture Patterns

- **Routing:** File-based routing with Expo Router in `app/` directory
- **Component Organization:** Reusable components in `components/`, UI primitives in `components/ui/`
- **Hooks:** Custom React hooks in `hooks/` directory
- **Constants:** Shared constants and theme definitions in `constants/`
- **API Layer:** Generated API clients and hooks in `src/api/generated/`
- **Testing:** Test files in `__tests__/` or co-located with components as `*.test.{ts,tsx}`
- **Mocks:** MSW handlers in `__tests__/mocks/handlers/`, mock data in `__tests__/mocks/data/`
- **Path Aliases:** `@/` prefix for imports from project root

## Platform Considerations

- **Cross-Platform:** iOS, Android, and Web support
- **Platform-Specific Files:** `.ios.{ts,tsx}`, `.android.{ts,tsx}`, `.web.{ts,tsx}` extensions
- **Platform Detection:** Platform.select() for conditional logic
- **Bundle Optimization:** Metro bundler with tree shaking
- **Performance:** Native modules for heavy operations, JavaScript thread optimization
- **Offline Support:** AsyncStorage and expo-file-system (when needed)

## Import Strategy

- **Module System:** ES6 modules with TypeScript imports
- **Asset Resolution:** Expo asset system and bundling
- **Static Imports:** Preferred over dynamic imports (limited React.lazy support in React Native)
- **Platform Imports:** Platform.select() for platform-specific imports
- **Path Aliases:** TypeScript path mapping with @/ prefix

## Rationale for Key Choices

### React Native + Expo
- **Cross-platform development** with single codebase for iOS, Android, and Web
- **Faster iteration** with Expo's managed workflow and OTA updates
- **Rich ecosystem** of libraries and native modules
- **File-based routing** with Expo Router for intuitive navigation structure

### Bun as Package Manager
- **Faster installs** and better performance than npm/yarn
- **Built-in TypeScript** support without additional configuration
- **Compatible** with React Native ecosystem (with npm fallback for jest-expo)

### Biome.js + ESLint Dual Setup
- **Biome.js** for fast formatting and core linting (primary tool)
- **ESLint** for React Native/React-specific rules (hooks, platform support)
- **Pre-commit hooks** ensure code quality before commits
- **Consistent style** across team with automated fixes

### MSW for API Mocking
- **Realistic testing** by intercepting actual fetch calls
- **Reusable handlers** shared between tests
- **Type-safe mocks** using generated TypeScript types
- **Works seamlessly** with React Query and async operations

### OpenAPI Code Generation
- **Automatic type generation** from Swagger spec reduces manual work
- **Type-safe API calls** with generated React Query hooks
- **Single source of truth** for API contracts
- **Reduced errors** from manual API client maintenance

### Playwright Visual Reference
- **Design consistency** between web and mobile apps
- **Automated capture** of web app screenshots and metadata
- **Design token extraction** for matching colors, typography, spacing
- **Journey documentation** for understanding user flows before mobile implementation
