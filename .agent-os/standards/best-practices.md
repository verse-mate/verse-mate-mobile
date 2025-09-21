# Development Best Practices

## Context

Global development guidelines for Agent OS projects.

<conditional-block context-check="core-principles">
IF this Core Principles section already read in current context:
  SKIP: Re-reading this section
  NOTE: "Using Core Principles already in context"
ELSE:
  READ: The following principles

## Core Principles

### Keep It Simple
- Implement code in the fewest lines possible
- Avoid over-engineering solutions
- Choose straightforward approaches over clever ones

### Optimize for Readability
- Prioritize code clarity over micro-optimizations
- Write self-documenting code with clear variable names
- Add comments for "why" not "what"

### DRY (Don't Repeat Yourself)
- Extract repeated business logic to custom hooks
- Extract repeated UI markup to reusable components
- Create utility functions for common operations
- Use TypeScript interfaces to avoid repeating type definitions

### File Structure
- Keep files focused on a single responsibility
- Group related functionality together
- Use consistent naming conventions
</conditional-block>

<conditional-block context-check="dependencies" task-condition="choosing-external-library">
IF current task involves choosing an external library:
  IF Dependencies section already read in current context:
    SKIP: Re-reading this section
    NOTE: "Using Dependencies guidelines already in context"
  ELSE:
    READ: The following guidelines
ELSE:
  SKIP: Dependencies section not relevant to current task

## Dependencies

### Choose Libraries Wisely
When adding third-party dependencies:
- Prefer React Native/Expo compatible libraries
- Check React Native compatibility and iOS/Android support
- Verify Expo managed workflow compatibility when applicable
- Select the most popular and actively maintained option
- Check the library's GitHub repository for:
  - Recent commits (within last 6 months)
  - Active issue resolution
  - Number of stars/downloads
  - Clear documentation
  - React Native version compatibility
</conditional-block>

## React Native Best Practices

### Performance Optimization
- Use FlatList for large datasets instead of ScrollView
- Implement proper key props for list items
- Use useMemo and useCallback for expensive operations
- Avoid inline styles and functions in render methods
- Use Image caching with expo-image for better performance

### Platform Considerations
- Test on both iOS and Android regularly
- Use Platform.select() for platform-specific styling
- Handle different screen sizes and orientations
- Consider platform-specific UI patterns and guidelines

### Accessibility
- Always provide accessibilityLabel for interactive elements
- Use accessibilityRole to define semantic meaning
- Test with screen readers on both platforms
- Maintain proper focus management for navigation

### State Management
- Keep component state local when possible
- Use Context for app-wide state sparingly
- Implement proper loading and error states
- Handle async operations with proper cleanup

### Navigation
- Use typed navigation parameters with TypeScript
- Implement proper screen transitions and gestures
- Handle deep linking and state restoration
- Consider navigation performance for complex stacks

### Security
- Never store sensitive data in AsyncStorage without encryption
- Validate all user inputs
- Use HTTPS for all network requests
- Handle authentication tokens securely
