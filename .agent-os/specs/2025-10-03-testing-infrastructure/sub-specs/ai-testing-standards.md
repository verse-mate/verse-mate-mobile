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
npm run chromatic

# Auto-accept all changes (use with caution)
npm run chromatic -- --auto-accept-changes
```

See `.rnstorybook/CHROMATIC_SETUP.md` for Chromatic configuration details.

### Visual Regression Testing Workflow

1. **Create/Update Stories**: Add or modify component stories
2. **Generate Stories**: Run `npm run storybook:generate`
3. **Local Review**: Check stories in app during development
4. **Publish to Chromatic**: Run `npm run chromatic` before PR
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
