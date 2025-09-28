import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ErrorBoundary , NetworkErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorDisplay } from '@/components/ErrorDisplay';

// Component that throws an error for testing
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <Text testID="working-component">Working component</Text>;
};

describe('Error Handling Components', () => {
  describe('ErrorBoundary', () => {
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should render children when there are no errors', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(screen.getByTestId('working-component')).toBeTruthy();
      expect(screen.getByText('Working component')).toBeTruthy();
    });

    it('should catch errors and render error UI', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeTruthy();
      expect(screen.getByLabelText('Retry action')).toBeTruthy();
      expect(screen.queryByTestId('working-component')).toBeNull();
    });

    it('should reset error state when try again is pressed', () => {
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeTruthy();

      fireEvent.press(screen.getByLabelText('Retry action'));

      // Re-render with working component
      rerender(
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(screen.getByTestId('working-component')).toBeTruthy();
      expect(screen.queryByText('Something went wrong')).toBeNull();
    });

    it('should log error details', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(consoleSpy).toHaveBeenCalledWith('ErrorBoundary caught an error:', expect.any(Error));
    });

    it('should render custom error message when provided', () => {
      render(
        <ErrorBoundary fallbackMessage="Custom error message">
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Custom error message')).toBeTruthy();
    });

    it('should call onError callback when error occurs', () => {
      const onErrorMock = jest.fn();

      render(
        <ErrorBoundary onError={onErrorMock}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(onErrorMock).toHaveBeenCalledWith(expect.any(Error), expect.any(Object));
    });

    it('should have proper accessibility labels', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByLabelText('Error occurred')).toBeTruthy();
      expect(screen.getByLabelText('Retry action')).toBeTruthy();
    });
  });

  describe('ErrorDisplay', () => {
    it('should render error message and retry button', () => {
      const onRetry = jest.fn();

      render(
        <ErrorDisplay
          message="Failed to load data"
          onRetry={onRetry}
        />
      );

      expect(screen.getByLabelText('Error message')).toBeTruthy();
      expect(screen.getByLabelText('Retry button')).toBeTruthy();
    });

    it('should call onRetry when retry button is pressed', () => {
      const onRetry = jest.fn();

      render(
        <ErrorDisplay
          message="Network error"
          onRetry={onRetry}
        />
      );

      fireEvent.press(screen.getByText('Retry'));

      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('should hide retry button when onRetry is not provided', () => {
      render(
        <ErrorDisplay message="Error occurred" />
      );

      expect(screen.getByText('Error occurred')).toBeTruthy();
      expect(screen.queryByText('Retry')).toBeNull();
    });

    it('should render custom retry text', () => {
      const onRetry = jest.fn();

      render(
        <ErrorDisplay
          message="Connection failed"
          onRetry={onRetry}
          retryText="Try Again"
        />
      );

      expect(screen.getByText('Try Again')).toBeTruthy();
      expect(screen.queryByText('Retry')).toBeNull();
    });

    it('should render with icon when provided', () => {
      render(
        <ErrorDisplay
          message="Error occurred"
          showIcon={true}
        />
      );

      expect(screen.getByTestId('error-icon')).toBeTruthy();
    });

    it('should apply custom styles', () => {
      const customStyle = { backgroundColor: 'red' };

      render(
        <ErrorDisplay
          message="Error"
          style={customStyle}
        />
      );

      const errorContainer = screen.getByTestId('error-display');
      expect(errorContainer.props.style).toMatchObject(customStyle);
    });

    it('should have proper accessibility properties', () => {
      const onRetry = jest.fn();

      render(
        <ErrorDisplay
          message="Access error"
          onRetry={onRetry}
        />
      );

      expect(screen.getByLabelText('Error message')).toBeTruthy();
      expect(screen.getByLabelText('Retry button')).toBeTruthy();
    });
  });

  describe('NetworkErrorBoundary', () => {
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should render children when there are no network errors', () => {
      render(
        <NetworkErrorBoundary>
          <ThrowError shouldThrow={false} />
        </NetworkErrorBoundary>
      );

      expect(screen.getByTestId('working-component')).toBeTruthy();
    });

    it('should catch network errors specifically', () => {
      const NetworkError = () => {
        throw new Error('Network request failed');
      };

      render(
        <NetworkErrorBoundary>
          <NetworkError />
        </NetworkErrorBoundary>
      );

      expect(screen.getByText('Network connection error')).toBeTruthy();
      expect(screen.getByText('Please check your internet connection and try again.')).toBeTruthy();
    });

    it('should catch fetch errors', () => {
      const FetchError = () => {
        throw new Error('fetch failed');
      };

      render(
        <NetworkErrorBoundary>
          <FetchError />
        </NetworkErrorBoundary>
      );

      expect(screen.getByText('Network connection error')).toBeTruthy();
    });

    it('should catch timeout errors', () => {
      const TimeoutError = () => {
        throw new Error('Request timeout');
      };

      render(
        <NetworkErrorBoundary>
          <TimeoutError />
        </NetworkErrorBoundary>
      );

      expect(screen.getByText('Network connection error')).toBeTruthy();
    });

    it('should fall back to generic error for non-network errors', () => {
      const GenericError = () => {
        throw new Error('Generic error');
      };

      render(
        <NetworkErrorBoundary>
          <GenericError />
        </NetworkErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeTruthy();
    });

    it('should retry network request when retry is pressed', () => {
      const NetworkError = () => {
        throw new Error('Network request failed');
      };

      const { rerender } = render(
        <NetworkErrorBoundary>
          <NetworkError />
        </NetworkErrorBoundary>
      );

      expect(screen.getByLabelText('Retry action')).toBeTruthy();

      fireEvent.press(screen.getByLabelText('Retry action'));

      // Re-render with working component
      rerender(
        <NetworkErrorBoundary>
          <ThrowError shouldThrow={false} />
        </NetworkErrorBoundary>
      );

      expect(screen.getByTestId('working-component')).toBeTruthy();
    });

    it('should track retry attempts', () => {
      const NetworkError = () => {
        throw new Error('Network request failed');
      };

      render(
        <NetworkErrorBoundary>
          <NetworkError />
        </NetworkErrorBoundary>
      );

      // First retry
      fireEvent.press(screen.getByLabelText('Retry action'));

      // Should still show retry option
      expect(screen.getByLabelText('Retry action')).toBeTruthy();
    });

    it('should show offline message when device is offline', () => {
      // Mock network state
      const mockNetworkState = { isConnected: false };
      jest.doMock('@react-native-community/netinfo', () => ({
        useNetInfo: () => mockNetworkState,
      }));

      const NetworkError = () => {
        throw new Error('Network request failed');
      };

      render(
        <NetworkErrorBoundary>
          <NetworkError />
        </NetworkErrorBoundary>
      );

      expect(screen.getByText('You appear to be offline')).toBeTruthy();
      expect(screen.getByText('Please check your internet connection.')).toBeTruthy();
    });
  });

  describe('Error Recovery', () => {
    it('should recover from transient errors', () => {
      let shouldThrow = true;

      const FlakeyComponent = () => {
        if (shouldThrow) {
          shouldThrow = false; // Only throw once
          throw new Error('Transient error');
        }
        return <Text testID="recovered-component">Component recovered</Text>;
      };

      const { rerender } = render(
        <ErrorBoundary>
          <FlakeyComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeTruthy();

      fireEvent.press(screen.getByLabelText('Retry action'));

      rerender(
        <ErrorBoundary>
          <FlakeyComponent />
        </ErrorBoundary>
      );

      expect(screen.getByTestId('recovered-component')).toBeTruthy();
    });

    it('should maintain component state after error recovery', () => {
      let errorCount = 0;

      const StatefulComponent = () => {
        const [count, setCount] = React.useState(0);

        if (errorCount < 1) {
          errorCount++;
          throw new Error('Initial error');
        }

        return (
          <Text testID="stateful-component" onPress={() => setCount(count + 1)}>
            Count: {count}
          </Text>
        );
      };

      const { rerender } = render(
        <ErrorBoundary>
          <StatefulComponent />
        </ErrorBoundary>
      );

      fireEvent.press(screen.getByLabelText('Retry action'));

      rerender(
        <ErrorBoundary>
          <StatefulComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText('Count: 0')).toBeTruthy();
    });
  });
});