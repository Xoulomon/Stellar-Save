import React from 'react';

import { ErrorBoundaryFallback } from './ErrorBoundaryFallback';
import './ErrorBoundary.css';

export interface ErrorBoundaryProps {
  fallback?: React.ReactNode;
  onError?: (error: Error, info: React.ErrorInfo) => void;
  className?: string;
  enableErrorReporting?: boolean;
  sentryDsn?: string;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error | null;
  errorInfo?: React.ErrorInfo | null;
  retryCount: number;
}

function isChunkLoadError(error: Error | null | undefined): boolean {
  return !!error && /chunkloaderror|loading (?:css )?chunk|failed to fetch dynamically imported module|importing a module script failed/i.test(
    error.message
  );
}

// NOTE: Intentional class component exception (see issue #1265).
// React has no hooks-based equivalent for `getDerivedStateFromError` /
// `componentDidCatch`, so error boundaries must be class components.
// Do not convert this to a function component.
export class ErrorBoundary extends React.Component<
  React.PropsWithChildren<ErrorBoundaryProps>,
  ErrorBoundaryState
> {
  private maxRetries = 3;

  constructor(props: React.PropsWithChildren<ErrorBoundaryProps>) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ errorInfo: info });

    // Log to console and call optional onError handler
    console.error('ErrorBoundary caught an error:', error, info);
    if (this.props.onError) this.props.onError(error, info);

    // Optional error reporting
    if (this.props.enableErrorReporting) {
      this.reportError(error, info);
    }
  }

  private reportError = (error: Error, info: React.ErrorInfo) => {
    // In a real app, integrate with Sentry, LogRocket, etc.
    // For now, just log to console with more details
    console.error('Reporting error:', {
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
      // Add user context if available (avoid sensitive data)
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date().toISOString(),
    });

    // If Sentry DSN is provided, initialize and capture
    if (this.props.sentryDsn && typeof window !== 'undefined') {
      // Dynamic import to avoid bundling Sentry if not used
      import('@sentry/react')
        .then((Sentry) => {
          if (!Sentry.isInitialized) {
            Sentry.init({
              dsn: this.props.sentryDsn,
              environment: process.env.NODE_ENV || 'development',
            });
          }
          Sentry.captureException(error, {
            contexts: {
              react: {
                componentStack: info.componentStack,
              },
            },
          });
        })
        .catch(() => {
          // Fallback if Sentry not available
          console.warn('Sentry not available for error reporting');
        });
    }
  };

  handleRetry = () => {
    if (isChunkLoadError(this.state.error)) {
      // React.lazy caches a rejected import promise; remounting the boundary
      // alone would render the same rejection. A reload retries the chunk URL.
      window.location.reload();
      return;
    }

    const { retryCount } = this.state;
    if (retryCount < this.maxRetries) {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: retryCount + 1,
      });
    } else {
      // Max retries reached, redirect to home
      this.handleGoHome();
    }
  };

  handleGoHome = () => {
    // Use React Router if available, otherwise window.location
    if (window.location.pathname !== '/') {
      window.location.href = '/';
    } else {
      // If already on home, force reload
      window.location.reload();
    }
  };

  renderFallback() {
    const { fallback, className } = this.props;
    const { error, errorInfo, retryCount } = this.state;

    // An explicit `fallback` wins: the caller opted out of the default UI
    // (and therefore out of the default notification).
    if (fallback) return <>{fallback}</>;

    return (
      <ErrorBoundaryFallback
        error={error}
        errorInfo={errorInfo}
        retryCount={retryCount}
        maxRetries={this.maxRetries}
        onRetry={this.handleRetry}
        onGoHome={this.handleGoHome}
        className={className}
      />
    );
  }

  render() {
    if (this.state.hasError) {
      return this.renderFallback();
    }

    return this.props.children ?? null;
  }
}

export default ErrorBoundary;
