# AI Testing Standards

This is the AI testing standards documentation for the spec detailed in @.agent-os/specs/2025-10-03-testing-infrastructure/spec.md

> Created: 2025-10-03
> Version: 1.0.0

## AI Test Generation Prompts

### Component Test Generation Prompt

```
Generate comprehensive tests for the [ComponentName] component located at [file-path].

Requirements:
1. Test all props and their variations
2. Test user interactions (press, input, gestures)
3. Validate accessibility (labels, roles, states)
4. Test conditional rendering and edge cases
5. Use descriptive test names following "should [expected behavior] when [condition]" pattern
6. Include visual snapshot test
7. Mock all external dependencies

Follow the patterns in @src/test-utils/examples/component.test.tsx
```

### Screen Test Generation Prompt

```
Generate tests for the [ScreenName] screen located at [file-path].

Requirements:
1. Test initial render and loading states
2. Test user interactions and navigation
3. Test error states and edge cases
4. Mock API calls with MSW handlers
5. Validate accessibility for all interactive elements
6. Test form validation (if applicable)
7. Use realistic user scenarios

Follow the patterns in @src/test-utils/examples/screen.test.tsx
```

### Hook Test Generation Prompt

```
Generate tests for the [hookName] custom hook located at [file-path].

Requirements:
1. Test all return values and their types
2. Test state changes and side effects
3. Test with various input parameters
4. Test error handling
5. Use @testing-library/react-hooks renderHook utility
6. Mock dependencies and external calls

Follow the patterns in @src/test-utils/examples/hook.test.tsx
```

### Utility Test Generation Prompt

```
Generate tests for the utility functions in [file-path].

Requirements:
1. Test all exported functions
2. Test edge cases and error conditions
3. Test with various input types (valid, invalid, null, undefined)
4. Use descriptive test names
5. Achieve 100% coverage for utility functions
6. No mocking required unless function has external dependencies

Follow the patterns in @src/test-utils/examples/util.test.ts
```

## Test Naming Conventions

### File Naming

**Pattern:** `[ComponentName].test.tsx` or `[functionName].test.ts`

**Examples:**
- `Button.test.tsx` (component)
- `LoginScreen.test.tsx` (screen)
- `useAuth.test.ts` (hook)
- `formatDate.test.ts` (utility)

**Location:**
- Co-located with source: `src/components/Button/Button.test.tsx`
- Or in `__tests__` directory: `src/components/Button/__tests__/Button.test.tsx`

### Test Suite Naming

**Pattern:** `describe('[ComponentName/FunctionName]', () => { ... })`

**Examples:**
```typescript
describe('Button', () => { ... })
describe('LoginScreen', () => { ... })
describe('useAuth', () => { ... })
describe('formatDate', () => { ... })
```

### Test Case Naming

**Pattern:** `it('should [expected behavior] when [condition]', () => { ... })`

**Examples:**
```typescript
it('should render with primary variant when variant prop is "primary"', () => { ... })
it('should call onPress when button is pressed', () => { ... })
it('should display error message when login fails', () => { ... })
it('should be accessible with correct label', () => { ... })
```

**Alternative Pattern (Nested Describe):**
```typescript
describe('when user is authenticated', () => {
  it('should display logout button', () => { ... })
  it('should navigate to home screen', () => { ... })
})
```

## File Organization Standards

### Directory Structure

```
src/
├── components/
│   ├── Button/
│   │   ├── Button.tsx
│   │   ├── Button.test.tsx
│   │   ├── Button.stories.tsx
│   │   └── index.ts
│   └── ...
├── screens/
│   ├── LoginScreen/
│   │   ├── LoginScreen.tsx
│   │   ├── LoginScreen.test.tsx
│   │   └── index.ts
│   └── ...
├── hooks/
│   ├── useAuth.ts
│   ├── useAuth.test.ts
│   └── ...
├── utils/
│   ├── formatters.ts
│   ├── formatters.test.ts
│   └── ...
└── test-utils/
    ├── examples/
    │   ├── component.test.tsx
    │   ├── screen.test.tsx
    │   ├── hook.test.tsx
    │   └── util.test.ts
    ├── mocks/
    │   ├── handlers/
    │   │   ├── auth.handlers.ts
    │   │   ├── verses.handlers.ts
    │   │   └── index.ts
    │   └── data/
    │       ├── users.ts
    │       ├── verses.ts
    │       └── index.ts
    ├── custom-render.tsx
    └── test-setup.ts
```

### Import Organization

```typescript
// 1. External imports (React, testing libraries)
import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';

// 2. Internal imports (components, hooks, utils)
import { Button } from './Button';
import { useAuth } from '@/hooks/useAuth';

// 3. Test utilities and mocks
import { customRender } from '@/test-utils/custom-render';
import { mockUser } from '@/test-utils/mocks/data/users';

// 4. Types
import type { ButtonProps } from './Button.types';
```

## Example Test Patterns

### UI Component Test Pattern

```typescript
import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { Button } from './Button';

describe('Button', () => {
  // Default props for reuse
  const defaultProps = {
    onPress: jest.fn(),
    children: 'Click me',
  };

  // Reset mocks between tests
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render with children text', () => {
      render(<Button {...defaultProps} />);
      expect(screen.getByText('Click me')).toBeTruthy();
    });

    it('should render with primary variant styling', () => {
      render(<Button {...defaultProps} variant="primary" />);
      const button = screen.getByRole('button');
      expect(button).toHaveStyle({ backgroundColor: '#007AFF' });
    });

    it('should match snapshot', () => {
      const { toJSON } = render(<Button {...defaultProps} />);
      expect(toJSON()).toMatchSnapshot();
    });
  });

  describe('Interactions', () => {
    it('should call onPress when button is pressed', () => {
      render(<Button {...defaultProps} />);
      const button = screen.getByRole('button');
      fireEvent.press(button);
      expect(defaultProps.onPress).toHaveBeenCalledTimes(1);
    });

    it('should not call onPress when button is disabled', () => {
      render(<Button {...defaultProps} disabled />);
      const button = screen.getByRole('button');
      fireEvent.press(button);
      expect(defaultProps.onPress).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should be accessible with correct role', () => {
      render(<Button {...defaultProps} />);
      expect(screen.getByRole('button')).toBeTruthy();
    });

    it('should have accessible label', () => {
      render(<Button {...defaultProps} accessibilityLabel="Submit form" />);
      expect(screen.getByLabelText('Submit form')).toBeTruthy();
    });

    it('should have disabled state when disabled prop is true', () => {
      render(<Button {...defaultProps} disabled />);
      expect(screen.getByRole('button')).toHaveAccessibilityState({ disabled: true });
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined children gracefully', () => {
      render(<Button onPress={jest.fn()} />);
      expect(screen.getByRole('button')).toBeTruthy();
    });

    it('should handle rapid successive presses', () => {
      render(<Button {...defaultProps} />);
      const button = screen.getByRole('button');
      fireEvent.press(button);
      fireEvent.press(button);
      fireEvent.press(button);
      expect(defaultProps.onPress).toHaveBeenCalledTimes(3);
    });
  });
});
```

### Screen Test Pattern

```typescript
import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { LoginScreen } from './LoginScreen';
import { server } from '@/test-utils/mocks/server';
import { rest } from 'msw';

describe('LoginScreen', () => {
  describe('Initial Render', () => {
    it('should display login form', () => {
      render(<LoginScreen />);
      expect(screen.getByLabelText('Email')).toBeTruthy();
      expect(screen.getByLabelText('Password')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Log In' })).toBeTruthy();
    });

    it('should have login button disabled when form is empty', () => {
      render(<LoginScreen />);
      const loginButton = screen.getByRole('button', { name: 'Log In' });
      expect(loginButton).toHaveAccessibilityState({ disabled: true });
    });
  });

  describe('User Interactions', () => {
    it('should enable login button when form is valid', () => {
      render(<LoginScreen />);

      fireEvent.changeText(screen.getByLabelText('Email'), 'user@example.com');
      fireEvent.changeText(screen.getByLabelText('Password'), 'password123');

      const loginButton = screen.getByRole('button', { name: 'Log In' });
      expect(loginButton).not.toHaveAccessibilityState({ disabled: true });
    });

    it('should submit form and navigate to home on successful login', async () => {
      const mockNavigate = jest.fn();
      render(<LoginScreen navigation={{ navigate: mockNavigate }} />);

      fireEvent.changeText(screen.getByLabelText('Email'), 'user@example.com');
      fireEvent.changeText(screen.getByLabelText('Password'), 'password123');
      fireEvent.press(screen.getByRole('button', { name: 'Log In' }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('Home');
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message when login fails', async () => {
      server.use(
        rest.post('/api/auth/login', (req, res, ctx) => {
          return res(ctx.status(401), ctx.json({ error: 'Invalid credentials' }));
        })
      );

      render(<LoginScreen />);

      fireEvent.changeText(screen.getByLabelText('Email'), 'wrong@example.com');
      fireEvent.changeText(screen.getByLabelText('Password'), 'wrongpass');
      fireEvent.press(screen.getByRole('button', { name: 'Log In' }));

      await waitFor(() => {
        expect(screen.getByText('Invalid credentials')).toBeTruthy();
      });
    });
  });

  describe('Accessibility', () => {
    it('should announce error to screen readers', async () => {
      server.use(
        rest.post('/api/auth/login', (req, res, ctx) => {
          return res(ctx.status(401), ctx.json({ error: 'Invalid credentials' }));
        })
      );

      render(<LoginScreen />);

      fireEvent.changeText(screen.getByLabelText('Email'), 'wrong@example.com');
      fireEvent.changeText(screen.getByLabelText('Password'), 'wrongpass');
      fireEvent.press(screen.getByRole('button', { name: 'Log In' }));

      await waitFor(() => {
        const errorMessage = screen.getByText('Invalid credentials');
        expect(errorMessage).toHaveAccessibilityLiveRegion('polite');
      });
    });
  });
});
```

### Hook Test Pattern

```typescript
import { renderHook, act } from '@testing-library/react-hooks';
import { useAuth } from './useAuth';
import { server } from '@/test-utils/mocks/server';
import { rest } from 'msw';

describe('useAuth', () => {
  describe('Initial State', () => {
    it('should return default state', () => {
      const { result } = renderHook(() => useAuth());

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('Login', () => {
    it('should set user and authenticated state on successful login', async () => {
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.login('user@example.com', 'password123');
      });

      expect(result.current.user).toEqual({
        id: '1',
        email: 'user@example.com',
        name: 'Test User',
      });
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('should set error state on failed login', async () => {
      server.use(
        rest.post('/api/auth/login', (req, res, ctx) => {
          return res(ctx.status(401), ctx.json({ error: 'Invalid credentials' }));
        })
      );

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.login('wrong@example.com', 'wrongpass');
      });

      expect(result.current.user).toBeNull();
      expect(result.current.error).toBe('Invalid credentials');
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('Logout', () => {
    it('should clear user state on logout', async () => {
      const { result } = renderHook(() => useAuth());

      // First login
      await act(async () => {
        await result.current.login('user@example.com', 'password123');
      });

      // Then logout
      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });
});
```

### Utility Function Test Pattern

```typescript
import { formatDate, parseDate, isValidEmail } from './formatters';

describe('formatDate', () => {
  it('should format date to YYYY-MM-DD', () => {
    const date = new Date('2025-10-03T12:00:00Z');
    expect(formatDate(date)).toBe('2025-10-03');
  });

  it('should handle invalid date', () => {
    expect(formatDate(new Date('invalid'))).toBe('Invalid Date');
  });

  it('should handle null', () => {
    expect(formatDate(null)).toBe('');
  });
});

describe('isValidEmail', () => {
  it('should return true for valid email', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
  });

  it('should return false for invalid email', () => {
    expect(isValidEmail('invalid-email')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isValidEmail('')).toBe(false);
  });

  it('should return false for null', () => {
    expect(isValidEmail(null)).toBe(false);
  });
});
```

## Self-Documenting Test Structure

### Principle: Tests as Documentation

Tests should serve as living documentation of how the code works. They should be readable by non-technical stakeholders and clearly communicate intent.

**Example:**
```typescript
describe('VerseMemorization', () => {
  describe('when user starts memorizing a new verse', () => {
    it('should save verse to their memorization list', () => { ... })
    it('should schedule first review for tomorrow', () => { ... })
    it('should display confirmation message', () => { ... })
  })

  describe('when user practices a verse', () => {
    it('should show the verse reference but hide the text', () => { ... })
    it('should allow user to reveal the verse progressively', () => { ... })
    it('should mark as practiced when completed', () => { ... })
  })

  describe('when verse is mastered (5 successful recalls)', () => {
    it('should update review interval to weekly', () => { ... })
    it('should display mastery badge', () => { ... })
    it('should update user statistics', () => { ... })
  })
})
```

### AAA Pattern (Arrange, Act, Assert)

Structure tests with clear sections:

```typescript
it('should update review interval when verse is mastered', () => {
  // Arrange: Set up test data and state
  const verse = createMockVerse();
  const user = createMockUser();
  const { result } = renderHook(() => useMemorization(user));

  // Act: Perform the action being tested
  act(() => {
    result.current.completeReview(verse, { correct: true });
  });

  // Assert: Verify the expected outcome
  expect(result.current.getReviewInterval(verse)).toBe(7); // 7 days
});
```

## Mock Data Management Guidelines

### Mock Data Structure

**Location:** `src/test-utils/mocks/data/`

**File Organization:**
- One file per entity type
- Export factory functions for creating mock data
- Export predefined fixtures for common scenarios

**Example (`users.ts`):**
```typescript
import type { User } from '@/types/user';

export const createMockUser = (overrides?: Partial<User>): User => ({
  id: '1',
  email: 'testuser@example.com',
  name: 'Test User',
  createdAt: new Date('2025-01-01'),
  settings: {
    theme: 'light',
    notifications: true,
  },
  ...overrides,
});

// Predefined fixtures
export const mockAuthenticatedUser = createMockUser({
  id: 'auth-user-1',
  email: 'authenticated@example.com',
  name: 'Authenticated User',
});

export const mockGuestUser = createMockUser({
  id: 'guest-1',
  email: 'guest@example.com',
  name: 'Guest User',
  settings: {
    theme: 'system',
    notifications: false,
  },
});
```

### MSW Handlers

**Location:** `src/test-utils/mocks/handlers/`

**Pattern:**
```typescript
import { rest } from 'msw';
import { mockAuthenticatedUser } from '../data/users';

export const authHandlers = [
  rest.post('/api/auth/login', (req, res, ctx) => {
    const { email, password } = req.body as { email: string; password: string };

    if (email === 'testuser@example.com' && password === 'password123') {
      return res(
        ctx.status(200),
        ctx.json({
          user: mockAuthenticatedUser,
          token: 'mock-jwt-token',
        })
      );
    }

    return res(
      ctx.status(401),
      ctx.json({ error: 'Invalid credentials' })
    );
  }),

  rest.post('/api/auth/logout', (req, res, ctx) => {
    return res(ctx.status(200), ctx.json({ success: true }));
  }),
];
```

### Versioning Mock Data

When API schemas change:
1. Update the mock data factory functions
2. Update affected MSW handlers
3. Run tests to identify breaking changes
4. Update tests to match new schema

**Version tracking:**
```typescript
// users.ts
/**
 * Mock user data factory
 * @version 2.0.0 - Added 'settings.language' field (2025-10-03)
 * @version 1.1.0 - Added 'settings' object (2025-09-15)
 * @version 1.0.0 - Initial version (2025-09-01)
 */
export const createMockUser = (overrides?: Partial<User>): User => ({ ... });
```

### Best Practices

1. **DRY Principle**: Use factory functions, don't duplicate mock data
2. **Realistic Data**: Mirror production data structures exactly
3. **Minimal Overrides**: Only override what's necessary for the specific test
4. **Type Safety**: Ensure mock data matches TypeScript types
5. **Centralized Management**: All mock data in `test-utils/mocks/data/`
6. **Handler Reusability**: Share MSW handlers across tests, override when needed
7. **Clear Naming**: Use descriptive names like `mockAuthenticatedUser`, not `user1`
8. **Documentation**: Comment complex mock scenarios and edge cases

---

## MSW (Mock Service Worker) Integration

### Overview

MSW intercepts network requests at the network level, providing realistic API mocking for tests. This enables testing components and screens with realistic async behavior without hitting real APIs.

### MSW Setup Pattern

**Location:** `__tests__/mocks/`

**Directory Structure:**
```
__tests__/
├── mocks/
│   ├── data/
│   │   ├── verses.ts          # Verse mock data factories
│   │   ├── aiResponses.ts     # AI response mock data
│   │   ├── users.ts           # User mock data
│   │   └── index.ts           # Re-export all data
│   ├── handlers/
│   │   ├── verses.ts          # Verse API handlers
│   │   ├── ai.ts              # AI API handlers
│   │   ├── auth.ts            # Auth API handlers
│   │   └── index.ts           # Combine all handlers
│   └── server.ts              # MSW server setup
└── utils/
    └── mockHelpers.test.ts
```

### Mock Data Factory Pattern

**VerseMate Example (`__tests__/mocks/data/verses.ts`):**
```typescript
import type { Verse } from '@/types/verse';

/**
 * Creates a mock Bible verse with optional overrides
 * @param overrides - Partial verse properties to override defaults
 * @returns Complete mock verse object
 */
export const createMockVerse = (overrides?: Partial<Verse>): Verse => ({
  id: 'verse-1',
  book: 'John',
  chapter: 3,
  verse: 16,
  text: 'For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.',
  translation: 'NIV',
  createdAt: new Date('2025-01-01').toISOString(),
  ...overrides,
});

/**
 * Predefined fixture: John 3:16
 * Most commonly used verse in tests
 */
export const mockJohn316 = createMockVerse();

/**
 * Predefined fixture: Psalm 23:1
 * Used for testing different book/chapter combinations
 */
export const mockPsalm231 = createMockVerse({
  id: 'verse-2',
  book: 'Psalms',
  chapter: 23,
  verse: 1,
  text: 'The Lord is my shepherd, I lack nothing.',
});

/**
 * Predefined fixture: Long verse text
 * Tests UI handling of lengthy content
 */
export const mockLongVerse = createMockVerse({
  id: 'verse-long',
  book: 'Revelation',
  chapter: 21,
  verse: 2,
  text: 'I saw the Holy City, the new Jerusalem, coming down out of heaven from God, prepared as a bride beautifully dressed for her husband. And I heard a loud voice from the throne saying, "Look! God\'s dwelling place is now among the people, and he will dwell with them."',
});

/**
 * Creates a list of mock verses for pagination tests
 * @param count - Number of verses to generate
 * @returns Array of mock verses
 */
export const createMockVerseList = (count: number): Verse[] => {
  return Array.from({ length: count }, (_, index) =>
    createMockVerse({
      id: `verse-${index + 1}`,
      verse: index + 1,
    })
  );
};
```

### MSW Handler Pattern

**API Handler Structure (`__tests__/mocks/handlers/verses.ts`):**
```typescript
import { http, HttpResponse } from 'msw';
import { mockJohn316, mockPsalm231, createMockVerseList } from '../data/verses';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.verse-mate.apegro.dev';

export const verseHandlers = [
  // IMPORTANT: Specific routes MUST come before parameterized routes
  // /api/verses/daily must be listed BEFORE /api/verses/:id
  http.get(`${API_BASE_URL}/api/verses/daily`, () => {
    return HttpResponse.json({
      verse: mockJohn316,
      date: new Date().toISOString().split('T')[0],
    });
  }),

  // Parameterized route - comes AFTER specific routes
  http.get(`${API_BASE_URL}/api/verses/:id`, ({ params }) => {
    const { id } = params;

    if (id === 'verse-1') {
      return HttpResponse.json({ verse: mockJohn316 });
    }
    if (id === 'verse-2') {
      return HttpResponse.json({ verse: mockPsalm231 });
    }

    return new HttpResponse(null, { status: 404 });
  }),

  // Search endpoint with query params
  http.get(`${API_BASE_URL}/api/verses/search`, ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('q');
    const limit = Number(url.searchParams.get('limit')) || 10;

    if (!query) {
      return HttpResponse.json(
        { error: 'Query parameter required' },
        { status: 400 }
      );
    }

    return HttpResponse.json({
      results: createMockVerseList(limit),
      total: 100,
      query,
    });
  }),

  // POST request with body validation
  http.post(`${API_BASE_URL}/api/verses/save`, async ({ request }) => {
    const body = await request.json() as { verseId: string; userId: string };

    if (!body.verseId || !body.userId) {
      return HttpResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    return HttpResponse.json({
      success: true,
      savedVerse: { id: body.verseId, userId: body.userId },
    });
  }),

  // Error simulation endpoint
  http.get(`${API_BASE_URL}/api/verses/error`, () => {
    return HttpResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }),
];
```

### MSW Server Setup

**Server Configuration (`__tests__/mocks/server.ts`):**
```typescript
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/**
 * MSW server for Node.js (Jest) tests
 * Intercepts all HTTP requests during test execution
 */
export const server = setupServer(...handlers);
```

**Handler Index (`__tests__/mocks/handlers/index.ts`):**
```typescript
import { verseHandlers } from './verses';
import { aiHandlers } from './ai';
import { authHandlers } from './auth';

/**
 * Combined MSW handlers for all API endpoints
 * Order matters: specific routes before parameterized routes
 */
export const handlers = [
  ...verseHandlers,
  ...aiHandlers,
  ...authHandlers,
];
```

### Test Setup Integration

**Jest Setup (`test-setup.ts`):**
```typescript
import '@testing-library/jest-native/extend-expect';
import { server } from './__tests__/mocks/server';

// Mock fetch for global use
global.fetch = fetch;

// Suppress React Native console warnings during tests
beforeAll(() => {
  // Start MSW server
  server.listen({ onUnhandledRequest: 'error' });

  // Suppress console noise (optional)
  const originalError = console.error;
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

// Reset handlers after each test to prevent test pollution
afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
```

### Using MSW in Tests

**Basic Test Example:**
```typescript
import { render, waitFor, screen } from '@testing-library/react-native';
import { VerseScreen } from './VerseScreen';

describe('VerseScreen', () => {
  it('should fetch and display daily verse', async () => {
    render(<VerseScreen />);

    // MSW intercepts the fetch request automatically
    await waitFor(() => {
      expect(screen.getByText('John 3:16')).toBeTruthy();
      expect(screen.getByText(/For God so loved the world/)).toBeTruthy();
    });
  });
});
```

**Override Handler in Specific Test:**
```typescript
import { render, waitFor, screen } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { server } from '@/__tests__/mocks/server';
import { VerseScreen } from './VerseScreen';

describe('VerseScreen Error Handling', () => {
  it('should display error message when API fails', async () => {
    // Override handler for this test only
    server.use(
      http.get('https://api.verse-mate.apegro.dev/api/verses/daily', () => {
        return HttpResponse.json(
          { error: 'Service unavailable' },
          { status: 503 }
        );
      })
    );

    render(<VerseScreen />);

    await waitFor(() => {
      expect(screen.getByText('Service unavailable')).toBeTruthy();
    });
  });
});
```

### MSW Handler Route Ordering

**CRITICAL RULE:** Specific routes MUST come before parameterized routes.

**❌ WRONG ORDER:**
```typescript
export const handlers = [
  http.get('/api/verses/:id', ({ params }) => { ... }),  // This catches ALL /api/verses/* requests
  http.get('/api/verses/daily', () => { ... }),          // Never reached!
];
```

**✅ CORRECT ORDER:**
```typescript
export const handlers = [
  http.get('/api/verses/daily', () => { ... }),          // Specific route first
  http.get('/api/verses/:id', ({ params }) => { ... }),  // Parameterized route after
];
```

### Common MSW Patterns

**Query Parameters:**
```typescript
http.get('/api/verses/search', ({ request }) => {
  const url = new URL(request.url);
  const query = url.searchParams.get('q');
  const page = Number(url.searchParams.get('page')) || 1;

  return HttpResponse.json({ results: [...], page });
});
```

**Request Body Validation:**
```typescript
http.post('/api/verses/save', async ({ request }) => {
  const body = await request.json() as { verseId: string };

  if (!body.verseId) {
    return HttpResponse.json(
      { error: 'Missing verseId' },
      { status: 400 }
    );
  }

  return HttpResponse.json({ success: true });
});
```

**Delayed Response (Simulate Network Latency):**
```typescript
http.get('/api/verses/:id', async ({ params }) => {
  await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay

  return HttpResponse.json({ verse: mockJohn316 });
});
```

**Authentication Headers:**
```typescript
http.get('/api/verses/saved', ({ request }) => {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return HttpResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  return HttpResponse.json({ verses: [...] });
});
```

### MSW Testing Best Practices

1. **Centralize Mock Data**: Use factory functions in `__tests__/mocks/data/`
2. **Realistic Responses**: Mirror production API responses exactly
3. **Error Scenarios**: Create handlers for 4xx and 5xx errors
4. **Reset Handlers**: Always call `server.resetHandlers()` in `afterEach`
5. **Route Ordering**: Specific routes before parameterized routes
6. **Type Safety**: Type request bodies and responses
7. **Environment Variables**: Use `process.env.EXPO_PUBLIC_API_URL` for base URL
8. **Consistent Data**: Use predefined fixtures for common scenarios
9. **Handler Overrides**: Use `server.use()` for test-specific overrides
10. **Unhandled Requests**: Configure `onUnhandledRequest: 'error'` to catch missing handlers

### AI Prompt for MSW Handler Generation

```
Generate MSW handlers for the [API endpoint group] located at [file-path].

Requirements:
1. Create handlers for all CRUD operations (GET, POST, PUT, DELETE)
2. Use mock data factories from __tests__/mocks/data/
3. Handle query parameters and request bodies
4. Include error scenarios (400, 401, 404, 500)
5. Validate request payloads
6. Return realistic response shapes matching production API
7. Order specific routes before parameterized routes
8. Add JSDoc comments explaining each handler's purpose
9. Use environment variable for API base URL
10. Follow the patterns in @__tests__/mocks/handlers/verses.ts

Example response format:
- Success: { data: {...}, meta?: {...} }
- Error: { error: string, details?: {...} }
```

### MSW Debugging Tips

**Check if MSW is intercepting requests:**
```typescript
beforeAll(() => {
  server.listen({
    onUnhandledRequest: 'warn' // Log unhandled requests instead of erroring
  });
});
```

**Log all intercepted requests:**
```typescript
server.events.on('request:start', ({ request }) => {
  console.log('MSW intercepted:', request.method, request.url);
});
```

**Verify handler is called:**
```typescript
http.get('/api/verses/:id', ({ params }) => {
  console.log('Handler called with params:', params);
  return HttpResponse.json({ verse: mockJohn316 });
});
```

---

## Storybook Visual Testing

### Overview

Storybook is used for component-driven development and visual regression testing. Stories showcase component variations and states, enabling visual review and automated snapshot comparison via Chromatic.

### Story File Structure

**Location:** Co-located with components (e.g., `components/Button.stories.tsx`)

**Naming Convention:** `[ComponentName].stories.tsx`

### Story Generation Prompt

```
Generate Storybook stories for the [ComponentName] component located at [file-path].

Requirements:
1. Create stories for all component variants and states
2. Use descriptive story names that explain the use case
3. Include interactive controls for key props
4. Add JSDoc comments explaining when to use each variant
5. Cover edge cases (long text, empty states, etc.)
6. Use realistic VerseMate app data
7. Follow CSF 3.0 format with TypeScript

Example structure:
- Default: Standard component state
- [Variant]s: All component variants (e.g., Primary, Secondary, Outline)
- [State]s: Different states (e.g., Disabled, Loading, Error)
- Edge Cases: Long text, empty content, etc.
```

### Story Pattern

```typescript
import type { Meta, StoryObj } from '@storybook/react-native';
import { Button } from './Button';

/**
 * Button Stories
 *
 * Primary button component used for main actions throughout VerseMate.
 * Use primary variant for main CTAs like "Read Verse" or "Get Explanation".
 */
const meta = {
  title: 'Components/Button',
  component: Button,
  argTypes: {
    onPress: { action: 'pressed' },
    variant: {
      control: { type: 'select' },
      options: ['primary', 'secondary', 'outline'],
      description: 'Visual style variant',
    },
    disabled: {
      control: { type: 'boolean' },
      description: 'Disabled state',
    },
  },
  args: {
    // Default args applied to all stories
    title: 'Read Verse',
    disabled: false,
    variant: 'primary',
  },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Primary variant
 *
 * Use for primary actions like "Read Verse", "Get Explanation"
 */
export const Primary: Story = {
  args: {
    title: 'Read Verse',
    variant: 'primary',
  },
};

/**
 * Disabled state
 *
 * Shows how button appears when action is unavailable
 */
export const Disabled: Story = {
  args: {
    title: 'Read Verse',
    variant: 'primary',
    disabled: true,
  },
};

/**
 * Long text handling
 *
 * Demonstrates button with longer text content
 */
export const LongText: Story = {
  args: {
    title: 'Request AI Explanation in Multiple Languages',
    variant: 'primary',
  },
};
```

### Story Organization

**Title Convention:**
- Format: `Category/ComponentName`
- Categories: `Components`, `Screens`, `Layouts`, `Primitives`
- Examples:
  - `Components/Button`
  - `Components/VerseCard`
  - `Screens/BibleReader`
  - `Layouts/TabLayout`

### Story Naming Best Practices

1. **Descriptive Names**: Use names that explain the use case
   - ✅ `PrimaryActionButton`
   - ✅ `HighlightedVerse`
   - ❌ `Story1`
   - ❌ `Example`

2. **State-Based Names**: For different states
   - `Default`, `Loading`, `Error`, `Empty`, `Disabled`

3. **Variant-Based Names**: For visual variants
   - `Primary`, `Secondary`, `Outline`

4. **Edge Case Names**: For edge cases
   - `LongText`, `EmptyContent`, `MaximumItems`

### Controls Configuration

Use controls to make stories interactive:

```typescript
argTypes: {
  // Actions
  onPress: { action: 'pressed' },
  onChange: { action: 'changed' },

  // Select controls
  variant: {
    control: { type: 'select' },
    options: ['primary', 'secondary', 'outline'],
  },

  // Boolean controls
  disabled: { control: { type: 'boolean' } },
  isLoading: { control: { type: 'boolean' } },

  // Text controls
  title: { control: { type: 'text' } },

  // Number controls
  maxLength: { control: { type: 'number', min: 0, max: 1000 } },
},
```

### Running Storybook

**Local Development (On-Device):**
```bash
# Generate story index
npm run storybook:generate

# Then import and render Storybook in your app
import StorybookUI from './.rnstorybook/Storybook';

// Use StorybookUI as your root component during development
export default StorybookUI;
```

**Chromatic Integration:**
```bash
# Publish stories for visual regression
npm run chromatic:deploy

# Auto-accept all changes (use with caution)
npm run chromatic:deploy -- --auto-accept-changes
```

See `.rnstorybook/CHROMATIC_SETUP.md` for Chromatic configuration details.

### Visual Regression Testing Workflow

1. **Create/Update Stories**: Add or modify component stories
2. **Generate Stories**: Run `npm run storybook:generate`
3. **Local Review**: Check stories in app during development
4. **Publish to Chromatic**: Run `npm run chromatic:deploy` before PR
5. **Review Changes**: Approve or reject visual changes in Chromatic UI
6. **Merge**: Once approved, merge PR with new visual baseline

### AI Story Generation Guidelines

When AI generates stories:
1. Analyze component props and variants
2. Create at least 3-5 stories covering main use cases
3. Include one story for disabled/error state
4. Include one story for edge case (long text, empty, etc.)
5. Use realistic VerseMate data (Bible verses, user names, etc.)
6. Add descriptive JSDoc comments explaining each story's purpose
7. Configure interactive controls for key props
8. Follow the naming conventions and organization patterns above

### Storybook Best Practices

1. **One Component Per Story File**: Don't combine multiple components
2. **Exhaustive Coverage**: Cover all variants and states
3. **Realistic Data**: Use production-like data, not "Lorem ipsum"
4. **Self-Documenting**: Stories should explain component usage
5. **Interactive**: Enable controls for props that change behavior/appearance
6. **Accessibility**: Test with accessibility tools in Storybook
7. **Performance**: Keep stories lightweight, avoid heavy computations
8. **Maintenance**: Update stories when component API changes

---

## Maestro E2E Testing

### Overview

Maestro is a mobile UI testing framework that allows writing end-to-end tests in simple YAML format. It tests complete user flows across iOS and Android simulators/devices, ensuring critical paths work correctly from the user's perspective.

### Flow File Structure

**Location:** `.maestro/` at project root

**Naming Convention:** `[feature-name]-flow.yaml`

**Examples:**
- `bible-reading-flow.yaml` - Core Bible reading journey
- `ai-explanation-flow.yaml` - AI explanation feature
- `verse-search-flow.yaml` - Search functionality
- `memorization-flow.yaml` - Verse memorization feature

### Flow File Pattern

**YAML Structure:**
```yaml
---
appId: com.versemate.mobile
name: Flow Name
description: Brief description of what this flow tests
tags:
  - critical  # or feature-specific tags
  - feature-name

---

# Flow Title
#
# This flow tests: [description]
#
# User Journey:
# 1. Step one
# 2. Step two
# 3. Step three

- launchApp:
    appId: com.versemate.mobile
    clearState: true

# Step 1: Description
- assertVisible: "Screen Title"

# Step 2: Description
- tapOn:
    id: "element-id"

# Step 3: Description
- assertVisible:
    id: "result-element"
```

### Maestro Flow Generation Prompt

```
Generate a Maestro E2E test flow for [feature name] in VerseMate mobile app.

Requirements:
1. Use YAML format with proper frontmatter (appId, name, description, tags)
2. Include detailed comments explaining the user journey
3. Test the complete critical path from start to finish
4. Use testID attributes for element selection when possible
5. Include accessibility assertions (traits, labels)
6. Add appropriate timeouts for async operations (API calls, animations)
7. Test both success and error states when applicable
8. Use realistic user actions (tap, scroll, swipe, input)
9. Verify visual feedback and state changes
10. Follow the patterns in @.maestro/bible-reading-flow.yaml

User Journey to test:
[Describe the step-by-step user flow]

Expected elements (with testIDs):
[List key UI elements and their testID values]
```

### Common Maestro Commands

**Launch App:**
```yaml
- launchApp:
    appId: com.versemate.mobile
    clearState: true  # Resets app state
```

**Assert Element Visible:**
```yaml
# By testID
- assertVisible:
    id: "verse-card"

# By text (supports regex)
- assertVisible:
    text: ".*John.*"

# By accessibility traits
- assertVisible:
    traits: ["button", "text"]
    id: "submit-button"

# With timeout for async elements
- assertVisible:
    id: "loading-spinner"
    timeout: 5000  # milliseconds
```

**Tap Element:**
```yaml
# By testID
- tapOn:
    id: "daily-verse-card"

# By text
- tapOn:
    text: "Get Explanation"

# Optional tap (won't fail if element doesn't exist)
- tapOn:
    id: "optional-button"
    optional: true
```

**Scroll Actions:**
```yaml
# Scroll until element is visible
- scrollUntilVisible:
    element:
      id: "target-element"
    direction: DOWN  # or UP, LEFT, RIGHT

# Simple scroll
- scroll:
    direction: DOWN

# Swipe gesture
- swipe:
    direction: UP
    duration: 500  # milliseconds
```

**Text Input:**
```yaml
- tapOn:
    id: "search-input"

- inputText: "John 3:16"

# Or combined
- inputText:
    id: "search-input"
    text: "Psalm 23"
```

**Wait Commands:**
```yaml
# Wait for element
- assertVisible:
    id: "result"
    timeout: 10000

# Manual delay
- runScript:
    script: sleep 2
```

**Navigation:**
```yaml
# Go back
- back

# Press hardware button
- pressKey: "Home"
```

**Conditional Logic:**
```yaml
# Optional actions (won't fail test)
- tapOn:
    id: "optional-element"
    optional: true

# Assert not visible
- assertNotVisible:
    id: "error-message"
```

### VerseMate Flow Conventions

#### Element Identification

**Priority Order:**
1. **testID** (most reliable): `id: "verse-card"`
2. **Accessibility Label**: `text: "Daily Verse"`
3. **Text Content** (last resort): `text: "John 3:16"`

**Naming Convention for testIDs:**
- Use kebab-case: `daily-verse-card`, `ai-explanation-button`
- Be descriptive: `verse-reference` not `ref`
- Include context: `home-screen-title` not just `title`

#### Flow Organization

**Critical Flows (must always pass):**
- `bible-reading-flow.yaml` - Reading verses
- `ai-explanation-flow.yaml` - Getting AI explanations
- `verse-search-flow.yaml` - Searching verses (when implemented)

**Feature Flows:**
- `memorization-flow.yaml` - Memorization features
- `settings-flow.yaml` - App settings
- `offline-flow.yaml` - Offline functionality

#### Tagging Strategy

```yaml
tags:
  - critical  # Must pass for PR merge
  - bible     # Feature category
  - reading   # Sub-feature
```

**Tag Categories:**
- **Criticality**: `critical`, `important`, `optional`
- **Feature**: `bible`, `ai`, `memorization`, `search`, `settings`
- **Platform**: `ios-only`, `android-only` (if platform-specific)

### Running Maestro Tests

**Local Execution:**
```bash
# Run all flows
npm run maestro:test

# Run specific flow
maestro test .maestro/bible-reading-flow.yaml

# Run on specific device (iOS)
npm run maestro:test:ios

# Run on specific device (Android)
npm run maestro:test:android

# Run with Maestro Studio (interactive mode)
npm run maestro:studio
```

**Device Selection:**
```bash
# iOS Simulators
maestro test flow.yaml --device "iPhone 15"
maestro test flow.yaml --device "iPhone 15 Pro Max"
maestro test flow.yaml --device "iPad Pro"

# Android Emulators
maestro test flow.yaml --device emulator-5554
maestro test flow.yaml --device "Pixel 7"
```

### Maestro Best Practices

1. **Clear State**: Always use `clearState: true` to ensure consistent test runs
2. **Meaningful Waits**: Use `assertVisible` with timeout instead of arbitrary `sleep`
3. **Descriptive Comments**: Document each step of the user journey
4. **Accessibility**: Use accessibility traits to verify screen reader compatibility
5. **Error States**: Test error scenarios, not just happy paths
6. **Optional Elements**: Use `optional: true` for non-critical elements to avoid flaky tests
7. **Realistic Data**: Use production-like data (real Bible verses, not "Test Verse")
8. **Atomic Flows**: Each flow should test one complete user journey
9. **Idempotent**: Flows should be repeatable and not depend on previous runs
10. **Fast Feedback**: Keep flows focused and under 2 minutes when possible

### Accessibility Testing with Maestro

**Verify Accessibility Traits:**
```yaml
- assertVisible:
    id: "verse-card"
    traits: ["text"]  # Text content

- assertVisible:
    id: "read-button"
    traits: ["button"]  # Interactive button

- assertVisible:
    id: "verse-heading"
    traits: ["header"]  # Heading/title
```

**Common Traits:**
- `button` - Interactive buttons
- `text` - Text content
- `header` - Headings/titles
- `link` - Links
- `image` - Images
- `search` - Search fields
- `adjustable` - Adjustable controls (sliders, pickers)

**Verify Accessibility Labels:**
```yaml
# Check that important elements have labels
- assertVisible:
    id: "share-button"
    text: "Share Verse"  # Accessibility label
```

### Debugging Maestro Flows

**View App Hierarchy:**
```bash
maestro hierarchy
```

**Run Flow with Verbose Output:**
```bash
maestro test flow.yaml --debug-output
```

**Interactive Testing (Maestro Studio):**
```bash
maestro studio
# Then select your flow and run interactively
```

**Common Issues:**

1. **Element Not Found**
   - Check testID spelling
   - Verify element is actually rendered
   - Add timeout for async elements
   - Use `maestro hierarchy` to inspect

2. **Timing Issues**
   - Use `assertVisible` with timeout instead of `sleep`
   - Increase timeout for slow network operations
   - Check for loading states before asserting content

3. **Flaky Tests**
   - Always use `clearState: true`
   - Avoid hardcoded delays
   - Use `optional: true` for non-critical elements
   - Test on slower devices/simulators

### AI Flow Generation Guidelines

When AI generates Maestro flows:
1. Analyze the user journey and break it into discrete steps
2. Identify all UI elements and their testIDs (create testIDs if missing)
3. Add descriptive comments for each step explaining the user's intent
4. Include accessibility assertions for interactive elements
5. Test both success and error scenarios
6. Use realistic VerseMate data (actual Bible verses, realistic user input)
7. Add appropriate timeouts for API calls and animations
8. Follow the flow patterns in `.maestro/` directory
9. Tag flows appropriately (critical, feature-specific)
10. Keep flows focused and atomic (one user journey per flow)

### Maestro + Jest Integration

Maestro tests complement Jest unit/integration tests:

- **Jest**: Test individual components, hooks, utilities
- **Maestro**: Test complete user flows end-to-end

**Coverage Overlap:**
- Both should test accessibility (Jest via jest-native, Maestro via traits)
- Both should test error states (Jest via error props, Maestro via error UI)
- Maestro provides final validation that everything works together

### CI/CD Integration (Future)

While Maestro is currently local-only, future CI/CD integration will:
1. Run Maestro flows on every PR
2. Block merge if critical flows fail
3. Generate flow execution recordings
4. Report test results to PR comments

**Preparation:**
- Tag critical flows with `critical` tag
- Keep critical flows fast (< 2 min each)
- Ensure flows are deterministic and not flaky
- Document any device-specific requirements
