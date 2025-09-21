# Development Standards

## Code Style & Formatting

### TypeScript Standards
- **Strict Mode:** Use strict TypeScript configuration
- **Type Safety:** Prefer explicit types over `any`
- **Interfaces:** Use interfaces for object shapes, types for unions/primitives
- **Naming:** PascalCase for components/interfaces, camelCase for variables/functions

### React Native Standards
- **Components:** Functional components with hooks over class components
- **Props:** Use TypeScript interfaces for component props
- **State:** useState/useReducer for local state, Context for shared state
- **Effects:** useEffect with proper dependency arrays

### File Organization
```
/app/                 # Expo Router pages
/components/          # Reusable UI components
  /ui/               # Basic UI components (Button, Text, etc.)
  /features/         # Feature-specific components
/hooks/              # Custom React hooks
/utils/              # Utility functions
/types/              # TypeScript type definitions
/constants/          # App constants (colors, sizes, etc.)
/services/           # API and external service integrations
```

### Naming Conventions
- **Files:** kebab-case for files (`user-profile.tsx`)
- **Components:** PascalCase (`UserProfile.tsx`)
- **Hooks:** camelCase starting with `use` (`useAuth.ts`)
- **Types:** PascalCase with descriptive names (`UserProfile`, `ApiResponse`)

## React Native Specific Standards

### Platform Handling
- Use `Platform.OS` for platform-specific logic
- Create `.ios.tsx` and `.android.tsx` files for significant platform differences
- Prefer platform-agnostic solutions when possible

### Performance
- Use `FlatList` for large lists instead of `ScrollView`
- Implement proper key props for list items
- Use `useMemo` and `useCallback` for expensive operations
- Avoid inline styles and functions in render methods

### Styling
- Use StyleSheet.create() for component styles
- Follow React Native style naming (camelCase)
- Prefer Flexbox for layouts
- Use relative units (percentages) over absolute pixels when possible

### Navigation
- Use Expo Router file-based routing
- Implement proper TypeScript typing for route parameters
- Use meaningful route names and organize in logical directory structure

## API & Data Standards

### API Communication
- Use React Native Fetch API or axios consistently
- Implement proper error handling with try/catch
- Create typed interfaces for API responses
- Use async/await over Promises.then()

### Data Storage
- Use AsyncStorage for simple key-value storage
- Implement proper serialization/deserialization
- Handle storage errors gracefully
- Clear sensitive data appropriately

### State Management
- Use React Context for app-wide state
- Keep component-specific state local
- Implement proper loading and error states
- Use reducers for complex state logic

## Testing Standards

### Unit Testing
- Use Jest with @testing-library/react-native
- Test component behavior, not implementation details
- Mock external dependencies and APIs
- Aim for meaningful test descriptions

### Test Organization
- Co-locate test files with components (`component.test.tsx`)
- Use descriptive test names and group related tests
- Test both happy path and error scenarios
- Mock native modules appropriately

## Accessibility Standards

### ARIA Standards
- Use accessibilityLabel for screen readers
- Implement accessibilityHint for complex interactions
- Use accessibilityRole for semantic meaning
- Test with screen readers on both platforms

### Visual Accessibility
- Maintain sufficient color contrast ratios
- Support system font scaling
- Implement focus management for navigation
- Test with accessibility features enabled

## Git & Development Workflow

### Commit Standards
- Use conventional commit format: `feat:`, `fix:`, `docs:`, etc.
- Write descriptive commit messages
- Keep commits atomic and focused
- Reference issues/tickets when applicable

### Branch Strategy
- Use feature branches for new development
- Follow naming: `feature/description`, `fix/description`
- Keep branches focused and short-lived
- Squash commits before merging

### Code Review Standards
- Review for TypeScript compliance
- Check React Native best practices
- Verify accessibility implementation
- Test on both iOS and Android when possible

## Security Standards

### Data Protection
- Never store sensitive data in AsyncStorage without encryption
- Implement proper authentication token handling
- Use HTTPS for all API communications
- Validate all user inputs

### Dependencies
- Keep dependencies up to date
- Review security advisories regularly
- Use official React Native and Expo packages when available
- Avoid packages with known vulnerabilities

## Documentation Standards

### Code Documentation
- Use JSDoc for complex functions and components
- Document component props with TypeScript interfaces
- Include usage examples for custom hooks
- Document any platform-specific behavior

### README Updates
- Keep installation instructions current
- Document environment setup requirements
- Include troubleshooting common issues
- Maintain changelog for significant updates