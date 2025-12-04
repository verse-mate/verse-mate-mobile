/**
 * PostHog Mock Tests
 *
 * Verifies that the PostHog mock correctly tracks method calls and arguments.
 */

import { mockPostHog, resetPostHogMock } from './posthog-mock';

describe('PostHog Mock', () => {
  afterEach(() => {
    resetPostHogMock();
  });

  it('tracks identify calls with user data', () => {
    const userId = 'user-123';
    const userProperties = {
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
    };

    mockPostHog.identify(userId, userProperties);

    expect(mockPostHog.identify).toHaveBeenCalledTimes(1);
    expect(mockPostHog.identify).toHaveBeenCalledWith(userId, userProperties);
  });

  it('tracks reset calls', () => {
    mockPostHog.reset();

    expect(mockPostHog.reset).toHaveBeenCalledTimes(1);
    expect(mockPostHog.reset).toHaveBeenCalledWith();
  });

  it('tracks captureException calls with error context', () => {
    const error = new Error('Test error');
    const context = { componentStack: 'at Component (Component.tsx:10)' };

    mockPostHog.captureException(error, context);

    expect(mockPostHog.captureException).toHaveBeenCalledTimes(1);
    expect(mockPostHog.captureException).toHaveBeenCalledWith(error, context);
  });

  it('resets all mock functions when resetPostHogMock is called', () => {
    // Make some calls
    mockPostHog.identify('user-1', { email: 'test@example.com' });
    mockPostHog.reset();
    mockPostHog.capture('test_event');

    expect(mockPostHog.identify).toHaveBeenCalledTimes(1);
    expect(mockPostHog.reset).toHaveBeenCalledTimes(1);
    expect(mockPostHog.capture).toHaveBeenCalledTimes(1);

    // Reset all mocks
    resetPostHogMock();

    // Verify all mocks are cleared
    expect(mockPostHog.identify).not.toHaveBeenCalled();
    expect(mockPostHog.reset).not.toHaveBeenCalled();
    expect(mockPostHog.capture).not.toHaveBeenCalled();
  });
});
