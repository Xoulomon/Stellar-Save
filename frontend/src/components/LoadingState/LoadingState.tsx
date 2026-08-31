/**
 * LoadingState — Issue #1464
 *
 * Standardised loading indicator for page-level and section-level data fetching.
 * Replaces ad-hoc spinner / "Loading…" text scattered across pages.
 *
 * Usage:
 * ```tsx
 * if (isLoading) return <LoadingState />;
 * if (isLoading) return <LoadingState message="Fetching groups…" fullPage />;
 * ```
 */
import './LoadingState.css';

export interface LoadingStateProps {
  /** Text displayed below the spinner. Defaults to "Loading…" */
  message?: string;
  /**
   * When true, the component fills the entire viewport (useful for
   * top-level page loading). When false (default) it fills its container.
   */
  fullPage?: boolean;
  /**
   * Additional CSS class to apply to the root element.
   */
  className?: string;
}

export function LoadingState({
  message = 'Loading…',
  fullPage = false,
  className = '',
}: LoadingStateProps) {
  const rootClass = ['loading-state', fullPage ? 'loading-state--full-page' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={rootClass}
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <span className="loading-state__spinner" aria-hidden="true" />
      <p className="loading-state__message">{message}</p>
    </div>
  );
}
