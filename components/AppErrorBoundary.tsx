/**
 * App Error Boundary
 *
 * Catches React errors globally to prevent full app crashes.
 * Displays a friendly error UI with recovery options.
 */

import { router } from 'expo-router';
import { usePostHog } from 'posthog-react-native';
import { Component, type ErrorInfo, type ReactNode, useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

interface Props {
  children: ReactNode;
  posthog?: ReturnType<typeof usePostHog> | null;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Wrapper component to inject PostHog into error boundary
 */
export function AppErrorBoundary({ children }: Omit<Props, 'posthog'>) {
  const posthog = usePostHog();
  const posthogRef = useRef(posthog);

  useEffect(() => {
    posthogRef.current = posthog;
  }, [posthog]);

  return <AppErrorBoundaryClass posthog={posthogRef.current}>{children}</AppErrorBoundaryClass>;
}

class AppErrorBoundaryClass extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details to console
    console.error('AppErrorBoundary caught an error:', error);
    console.error('Error Info:', errorInfo);
    console.error('Component Stack:', errorInfo.componentStack);

    // Update state with error info
    this.setState({
      error,
      errorInfo,
    });

    // Capture error with PostHog analytics
    // Cast componentStack to string since it may be null/undefined in some cases
    this.props.posthog?.captureException(error, {
      componentStack: errorInfo.componentStack ?? '',
    });
  }

  handleReset = () => {
    // Reset error boundary state
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleGoHome = () => {
    // Reset state and navigate to home
    this.handleReset();
    router.replace('/');
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.content}>
            <Text style={styles.title}>Oops! Something went wrong</Text>

            <Text style={styles.message}>
              {this.state.error?.message || 'An unexpected error occurred'}
            </Text>

            <View style={styles.buttonContainer}>
              <Pressable style={[styles.button, styles.primaryButton]} onPress={this.handleReset}>
                <Text style={styles.buttonText}>Try Again</Text>
              </Pressable>

              <Pressable
                style={[styles.button, styles.secondaryButton]}
                onPress={this.handleGoHome}
              >
                <Text style={[styles.buttonText, styles.secondaryButtonText]}>Go to Home</Text>
              </Pressable>
            </View>

            {__DEV__ && this.state.errorInfo && (
              <ScrollView style={styles.debugContainer}>
                <Text style={styles.debugTitle}>Error Stack (Development Only):</Text>
                <Text style={styles.debugText}>{this.state.error?.stack}</Text>
                <Text style={styles.debugTitle}>Component Stack:</Text>
                <Text style={styles.debugText}>{this.state.errorInfo.componentStack}</Text>
              </ScrollView>
            )}
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    width: '100%',
    maxWidth: 500,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#ccc',
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 24,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#C19A6B',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#C19A6B',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  secondaryButtonText: {
    color: '#C19A6B',
  },
  debugContainer: {
    marginTop: 32,
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    maxHeight: 300,
    width: '100%',
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#C19A6B',
    marginTop: 12,
    marginBottom: 8,
  },
  debugText: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'monospace',
    lineHeight: 18,
  },
});
