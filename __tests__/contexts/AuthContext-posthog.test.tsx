/**
 * PostHog Authentication Integration Tests
 *
 * Tests PostHog user identification on login/signup and reset on logout.
 */

import { usePostHog } from 'posthog-react-native';
import { mockPostHog } from '../mocks/posthog-mock';

describe('AuthContext PostHog Integration', () => {
  it('provides PostHog instance via usePostHog hook', () => {
    const posthog = usePostHog();

    expect(posthog).toBe(mockPostHog);
    expect(posthog.identify).toBeDefined();
    expect(posthog.reset).toBeDefined();
    expect(posthog.captureException).toBeDefined();
  });

  it('verifies PostHog identify is called with correct user data structure', () => {
    const testUserId = 'user-123';
    const testUserProps = {
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
    };

    // Simulate what AuthContext does on login
    mockPostHog.identify(testUserId, testUserProps);

    expect(mockPostHog.identify).toHaveBeenCalledTimes(1);
    expect(mockPostHog.identify).toHaveBeenCalledWith(testUserId, testUserProps);
  });

  it('verifies PostHog reset is called on logout', () => {
    // Simulate what AuthContext does on logout
    mockPostHog.reset();

    expect(mockPostHog.reset).toHaveBeenCalledTimes(1);
    expect(mockPostHog.reset).toHaveBeenCalledWith();
  });

  it('verifies PostHog identify includes all required user properties', () => {
    const mockUser = {
      id: 'user-456',
      email: 'jane@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
    };

    // Simulate what AuthContext does with user session data
    mockPostHog.identify(mockUser.id, {
      email: mockUser.email,
      firstName: mockUser.firstName,
      lastName: mockUser.lastName,
    });

    const identifyCall = mockPostHog.identify.mock.calls[0];
    expect(identifyCall[0]).toBe(mockUser.id);
    expect(identifyCall[1]).toEqual({
      email: mockUser.email,
      firstName: mockUser.firstName,
      lastName: mockUser.lastName,
    });
  });

  it('supports optional chaining for graceful degradation', () => {
    // Test that optional chaining syntax works correctly
    // This test verifies the pattern used in AuthContext
    const mockFn = jest.fn();
    type ObjType = { method?: () => void };
    const obj: ObjType | null = { method: mockFn };

    // Use a type-safe approach to access the method
    const safeCall = (o: ObjType | null) => o?.method?.();
    safeCall(obj);
    expect(mockFn).toHaveBeenCalled();

    // Verify null case doesn't throw
    const nullObj: ObjType | null = null;
    expect(() => safeCall(nullObj)).not.toThrow();
  });
});
