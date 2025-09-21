# TypeScript/React Native Style Guide

## TypeScript Standards

### Type Definitions
- Use `interface` for object shapes and component props
- Use `type` for unions, primitives, and computed types
- Prefer explicit types over `any`
- Use strict TypeScript configuration

```typescript
// Good
interface UserProps {
  name: string;
  age: number;
  isActive: boolean;
}

// Good
type Status = 'loading' | 'success' | 'error';

// Avoid
const user: any = getData();
```

### Function Types
- Use arrow functions for inline functions
- Use function declarations for main component functions
- Always type function parameters and return values

```typescript
// Component
export default function UserProfile({ name, age }: UserProps): JSX.Element {
  return <Text>{name}</Text>;
}

// Hook
const useAuth = (): AuthState => {
  // ...
};

// Inline function
const handlePress = useCallback((id: string): void => {
  // ...
}, []);
```

## React Native Patterns

### Component Structure
- Use functional components with hooks
- Define props interface above component
- Export component as default

```typescript
interface HomeScreenProps {
  title: string;
  onPress: () => void;
}

export default function HomeScreen({ title, onPress }: HomeScreenProps): JSX.Element {
  const [isLoading, setIsLoading] = useState(false);

  return (
    <View style={styles.container}>
      <Text>{title}</Text>
    </View>
  );
}
```

### Hooks Usage
- Use dependency arrays properly in useEffect
- Prefer useCallback for functions passed to children
- Use useMemo for expensive calculations

```typescript
// Good
useEffect(() => {
  fetchData();
}, [userId]); // Include dependencies

// Good
const handleSubmit = useCallback((data: FormData) => {
  submitForm(data);
}, [submitForm]);

// Good
const expensiveValue = useMemo(() => {
  return calculateExpensive(data);
}, [data]);
```

### State Management
- Use useState for local component state
- Use useReducer for complex state logic
- Use Context for app-wide state

```typescript
// Local state
const [user, setUser] = useState<User | null>(null);

// Complex state
const [state, dispatch] = useReducer(userReducer, initialState);

// Context
const { user, setUser } = useContext(AuthContext);
```

## Styling Patterns

### StyleSheet Usage
- Create styles with StyleSheet.create()
- Use camelCase for style property names
- Group related styles together

```typescript
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
  },
});
```

### Platform-Specific Code
- Use Platform.select() for different values
- Create separate files for major platform differences

```typescript
// Platform-specific values
const styles = StyleSheet.create({
  text: {
    fontFamily: Platform.select({
      ios: 'Helvetica',
      android: 'Roboto',
    }),
  },
});

// Platform check
if (Platform.OS === 'ios') {
  // iOS-specific code
}
```

## Import/Export Standards

### Import Order
1. React and React Native imports
2. Third-party library imports
3. Local component imports
4. Utility and type imports
5. Relative imports

```typescript
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import Button from '@/components/ui/button';
import { User } from '@/types/user';
import { fetchUser } from '@/services/api';

import { validateForm } from '../utils/validation';
```

### Export Patterns
- Default export for main component
- Named exports for utilities and types
- Re-export from index files when appropriate

```typescript
// Main component
export default function UserProfile() { ... }

// Utilities
export const formatDate = (date: Date): string => { ... };
export const validateEmail = (email: string): boolean => { ... };

// Types
export interface User {
  id: string;
  name: string;
}
```

## Async/Await Patterns

### API Calls
- Use async/await over Promise.then()
- Implement proper error handling
- Type API responses

```typescript
const fetchUserData = async (userId: string): Promise<User> => {
  try {
    const response = await fetch(`/api/users/${userId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch user');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching user:', error);
    throw error;
  }
};
```

### Loading States
- Handle loading and error states properly
- Use consistent patterns across components

```typescript
const [user, setUser] = useState<User | null>(null);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

const loadUser = async () => {
  setLoading(true);
  setError(null);
  try {
    const userData = await fetchUser(userId);
    setUser(userData);
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Unknown error');
  } finally {
    setLoading(false);
  }
};
```

## Performance Considerations

### List Rendering
- Use FlatList for large datasets
- Implement proper keyExtractor
- Use getItemLayout when possible

```typescript
<FlatList
  data={users}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => <UserItem user={item} />}
  getItemLayout={(data, index) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  })}
/>
```

### Memory Management
- Remove event listeners in cleanup
- Cancel async operations when component unmounts
- Use proper dependency arrays

```typescript
useEffect(() => {
  const subscription = eventEmitter.addListener('update', handleUpdate);

  return () => {
    subscription.remove();
  };
}, []);
```