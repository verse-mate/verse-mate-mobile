import React, { Component, type ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackMessage?: string;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary component to catch JavaScript errors anywhere in the child component tree
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error);

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View
          style={styles.container}
          accessible={true}
          accessibilityLabel="Error occurred"
          accessibilityRole="alert"
        >
          <Text style={styles.title}>{this.props.fallbackMessage || 'Something went wrong'}</Text>

          <TouchableOpacity
            style={styles.retryButton}
            onPress={this.handleReset}
            accessible={true}
            accessibilityLabel="Retry action"
            accessibilityRole="button"
          >
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

/**
 * Network-specific error boundary that provides better messaging for network errors
 */
export class NetworkErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('NetworkErrorBoundary caught an error:', error);

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  private isNetworkError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('timeout') ||
      message.includes('connection') ||
      message.includes('internet')
    );
  }

  render() {
    if (this.state.hasError && this.state.error) {
      const isNetworkError = this.isNetworkError(this.state.error);

      return (
        <View style={styles.container}>
          {isNetworkError ? (
            <>
              <Text style={styles.title}>Network connection error</Text>
              <Text style={styles.subtitle}>
                Please check your internet connection and try again.
              </Text>
            </>
          ) : (
            <Text style={styles.title}>{this.props.fallbackMessage || 'Something went wrong'}</Text>
          )}

          <TouchableOpacity
            style={styles.retryButton}
            onPress={this.handleReset}
            accessible={true}
            accessibilityLabel="Retry action"
            accessibilityRole="button"
          >
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#f6f3ec',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212531',
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: 'RobotoSerif',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
    fontFamily: 'RobotoSerif',
  },
  retryButton: {
    backgroundColor: '#b09a6d',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'RobotoSerif',
  },
});
