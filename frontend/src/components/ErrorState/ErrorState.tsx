/**
 * ErrorState — Issue #1464
 *
 * Standardised error display for page-level and section-level failures.
 * Replaces ad-hoc inline `{error && <p>{error}</p>}` patterns scattered
 * across pages.
 *
 * Usage:
 * ```tsx
 * if (error) return <ErrorState message={error} />;
 * if (error) return <ErrorState message={error} onRetry={refresh} />;
 * ```
 */
import './ErrorState.css';

export interface ErrorStateProps {
  /** Human-readable error description shown to the user. */
  message: string;
  /** Optional callback wired to a "Retry" button. */
  onRetry?: () => void;
  /** Label for the retry button. Defaults to "Retry". */
  retryLabel?: string;
  /**
   * When true, the component fills the entire viewport height.
   * When false (default) it fills its container.
   */
  fullPage?: boolean;
  /** Additional CSS class applied to the root element. */
  className?: string;
}

export function ErrorState({
  message,
  onRetry,
  retryLabel = 'Retry',
  fullPage = false,
  className = '',
}: ErrorStateProps) {
  const rootClass = ['error-state', fullPage ? 'error-state--full-page' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={rootClass}
      role="alert"
      aria-live="assertive"
    >
      {/* Error icon */}
      <span className="error-state__icon" aria-hidden="true">
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </span>

      <p className="error-state__message">{message}</p>

      {onRetry && (
        <button
          type="button"
          className="error-state__retry"
          onClick={onRetry}
          aria-label={`${retryLabel}: ${message}`}
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}
