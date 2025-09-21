# Tech Stack

## Context

Global tech stack defaults for Agent OS projects, overridable in project-specific `.agent-os/product/tech-stack.md`.

- App Framework: React Native 0.81.4+ with Expo 54.0.9+
- Language: TypeScript 5.9.2+
- Mobile Platform: iOS and Android via Expo managed workflow
- Navigation: Expo Router 6.0.7+
- JavaScript Framework: React 19.1.0+
- Build Tool: Metro bundler (React Native)
- Import Strategy: ES6 modules with React Native resolution
- Package Manager: npm or bun
- Node Version: 18+ LTS
- Styling: React Native StyleSheet with expo-system-ui
- UI Components: React Native core components + Expo UI elements
- Icons: @expo/vector-icons
- Font Provider: @expo-google-fonts or system fonts
- Font Loading: Expo font loading with expo-font
- Backend Connection: Existing VerseMate API
- Local Storage: @react-native-async-storage/async-storage
- Image Handling: expo-image for optimized performance
- Animations: react-native-reanimated with worklets
- Gestures: react-native-gesture-handler
- Application Distribution: Apple App Store and Google Play Store
- Build Platform: Expo Application Services (EAS)
- CI/CD Platform: GitHub Actions
- CI/CD Triggers: Push to main/develop branches, pull requests
- Build & Deploy: GitHub Actions + EAS Build and Submit
- Expo Updates: EAS Update for over-the-air updates
- Testing: Jest with @testing-library/react-native (run in GitHub Actions)
- Development: Expo development build workflow
