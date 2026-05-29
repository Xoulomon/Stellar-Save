import React from "react";
import { Box, Typography, Button, Alert, AlertTitle, Collapse } from "@mui/material";
import { AppCard } from "../../ui/components/AppCard";
import { AppButton } from "../../ui/components/AppButton";
import "./ErrorBoundary.css";

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
    console.error("ErrorBoundary caught an error:", error, info);
    if (this.props.onError) this.props.onError(error, info);

    // Optional error reporting
    if (this.props.enableErrorReporting) {
      this.reportError(error, info);
    }
  }

  private reportError = (error: Error, info: React.ErrorInfo) => {
    // In a real app, integrate with Sentry, LogRocket, etc.
    // For now, just log to console with more details
    console.error("Reporting error:", {
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
      import('@sentry/react').then((Sentry) => {
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
      }).catch(() => {
        // Fallback if Sentry not available
        console.warn('Sentry not available for error reporting');
      });
    }
  };

  private getErrorMessage = (error: Error): string => {
    const message = error.message.toLowerCase();

    // Detect common error patterns
    if (message.includes('network') || message.includes('fetch')) {
      return 'A network error occurred. Please check your internet connection and try again.';
    }
    if (message.includes('unauthorized') || message.includes('403')) {
      return 'You are not authorized to access this resource. Please log in again.';
    }
    if (message.includes('not found') || message.includes('404')) {
      return 'The requested resource could not be found.';
    }
    if (message.includes('timeout')) {
      return 'The request timed out. Please try again.';
    }
    if (message.includes('quota') || message.includes('limit')) {
      return 'You have exceeded the rate limit. Please wait a moment and try again.';
    }

    // Default message
    return 'An unexpected error occurred while loading this page.';
  };

  handleRetry = () => {
    const { retryCount } = this.state;
    if (retryCount < this.maxRetries) {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: retryCount + 1
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
    const { error, retryCount } = this.state;
    const isDevelopment = process.env.NODE_ENV === 'development';

    if (fallback) return <>{fallback}</>;

    const errorMessage = error ? this.getErrorMessage(error) : 'An unexpected error occurred.';
    const canRetry = retryCount < this.maxRetries;

    return (
      <Box
        className={["error-boundary", className].filter(Boolean).join(" ")}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '50vh',
          p: 3,
        }}
      >
        <AppCard
          sx={{
            maxWidth: 600,
            width: '100%',
            textAlign: 'center',
          }}
        >
          <Alert severity="error" sx={{ mb: 3 }}>
            <AlertTitle>Something went wrong</AlertTitle>
            <Typography variant="body2">{errorMessage}</Typography>
          </Alert>

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mb: 2 }}>
            <AppButton
              variant="contained"
              color="primary"
              onClick={this.handleRetry}
              disabled={!canRetry}
            >
              {canRetry ? 'Try Again' : 'Max Retries Reached'}
            </AppButton>
            <AppButton
              variant="outlined"
              onClick={this.handleGoHome}
            >
              Go Home
            </AppButton>
          </Box>

          {retryCount > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ mb: 2 }}>
              Retry attempts: {retryCount}/{this.maxRetries}
            </Typography>
          )}

          {/* Development mode details */}
          {isDevelopment && error && (
            <Collapse in={true}>
              <Alert severity="info" sx={{ mt: 2, textAlign: 'left' }}>
                <AlertTitle>Development Details</AlertTitle>
                <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap', fontSize: '0.75rem' }}>
                  {error.message}
                  {error.stack && `\n\nStack Trace:\n${error.stack}`}
                  {this.state.errorInfo?.componentStack && `\n\nComponent Stack:\n${this.state.errorInfo.componentStack}`}
                </Typography>
              </Alert>
            </Collapse>
          )}
        </AppCard>
      </Box>
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
