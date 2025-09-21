# Technical Stack

## Mobile Framework
- **Application Framework:** React Native 0.81.4 with Expo ~54.0.9
- **Navigation:** Expo Router ~6.0.7 with React Navigation 7.x
- **Development Platform:** Expo managed workflow for cross-platform development

## Frontend Technologies
- **JavaScript Framework:** React 19.1.0
- **Type System:** TypeScript 5.9.2
- **State Management:** React built-in state (Context API, useState, useReducer)
- **UI Components:** React Native core components with Expo UI elements
- **Styling:** React Native StyleSheet with expo-system-ui for system integration

## Mobile-Specific Libraries
- **Icons:** @expo/vector-icons 15.0.2
- **Images:** expo-image 3.0.8 for optimized image handling
- **Gestures:** react-native-gesture-handler 2.28.0
- **Animations:** react-native-reanimated 4.1.0 with react-native-worklets 0.5.1
- **Safe Areas:** react-native-safe-area-context 5.6.0
- **Haptics:** expo-haptics 15.0.7 for tactile feedback
- **Status Bar:** expo-status-bar 3.0.8 for status bar management
- **Screen Orientation:** expo-screen-orientation (if needed for reading modes)

## Backend Integration
- **API Communication:** React Native Fetch API or axios for HTTP requests
- **Backend Connection:** Existing VerseMate backend APIs
- **Authentication:** Integration with existing VerseMate user system
- **Data Storage:** @react-native-async-storage/async-storage for local data and offline content

## Development Tools
- **Linting:** ESLint 9.25.0 with eslint-config-expo 10.0.0
- **Code Quality:** (To be added: Biome.js as mentioned in user context)
- **Git Hooks:** (To be added: Husky and lint-staged as mentioned in user context)
- **Testing:** (To be added: Jest with @testing-library/react-native and React Native Testing Library)

## Deployment & Distribution
- **Application Hosting:** Expo Application Services (EAS) for builds and updates
- **App Stores:** Apple App Store and Google Play Store distribution
- **Code Repository:** Git repository (current project)
- **CI/CD:** EAS Build and Submit for automated deployment

## External Services
- **Font Provider:** @expo-google-fonts or system fonts
- **Asset Hosting:** Expo CDN for bundled assets
- **Database System:** Connects to existing VerseMate backend database
- **AI Services:** Integration with existing VerseMate AI explanation and explanation translation APIs

## React Native Considerations
- **Platform Differences:** iOS and Android platform-specific code when needed
- **Bundle Size:** Metro bundler for React Native with tree shaking
- **Performance:** Native modules for heavy operations, JavaScript thread optimization
- **Offline Support:** Local storage with AsyncStorage and file system access via expo-file-system

## Import Strategy
- **Module System:** ES6 modules with TypeScript imports
- **Asset Imports:** Expo asset resolution and bundling
- **Dynamic Imports:** Limited React.lazy support in React Native; prefer static imports
- **Platform Imports:** Platform.select() for platform-specific imports