import React from "react";
import "./ErrorBoundary.css";

export interface ErrorBoundaryProps {
  fallback?: React.ReactNode;
  onError?: (error: Error, info: React.ErrorInfo) => void;
  className?: string;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error | null;
}

export class ErrorBoundary extends React.Component<
  React.PropsWithChildren<ErrorBoundaryProps>,
  ErrorBoundaryState
> {
  constructor(props: React.PropsWithChildren<ErrorBoundaryProps>) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log to console and call optional onError handler
    // Keeping logging simple and local to avoid external deps
    // Consumers can override `onError` to forward to a server or Sentry
    // eslint-disable-next-line no-console
    console.error("ErrorBoundary caught an error:", error, info);
    if (this.props.onError) this.props.onError(error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  renderFallback() {
    const { fallback, className } = this.props;

    if (fallback) return <>{fallback}</>;

    return (
      <div className={["error-boundary", className].filter(Boolean).join(" ")}>
        <div className="error-boundary__card">
          <h3 className="error-boundary__title">Something went wrong</h3>
          <p className="error-boundary__message">
            An unexpected error occurred while loading this page.
          </p>
          <div className="error-boundary__actions">
            <button
              className="error-boundary__retry"
              type="button"
              onClick={this.handleRetry}
            >
              Retry
            </button>
            <button
              className="error-boundary__retry"
              type="button"
              onClick={this.handleGoHome}
              style={{ marginLeft: '8px' }}
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
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
