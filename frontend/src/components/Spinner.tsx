import './Spinner.css';

type SpinnerSize = 'sm' | 'md' | 'lg';
type SpinnerColor = 'primary' | 'secondary' | 'danger' | 'success' | 'white';

interface SpinnerProps {
  size?: SpinnerSize;
  color?: SpinnerColor;
  label?: string;
  ariaLabel?: string;
}

/**
 * Spinner Loading Indicator Component
 *
 * A reusable loading indicator with multiple size and color variants.
 * Can optionally display loading text below the spinner.
 *
 * @example
 * // Basic usage
 * <Spinner />
 *
 * @example
 * // With custom size and label
 * <Spinner size="lg" label="Loading..." color="primary" />
 */
export function Spinner({
  size = 'md',
  color = 'primary',
  label,
  ariaLabel = 'Loading',
}: SpinnerProps) {
  return (
    <div className={`spinner-container spinner-${size}`}>
      <div
        className={`spinner spinner-${size} spinner-${color}`}
        role="status"
        aria-label={ariaLabel}
        aria-live="polite"
      >
        <span className="spinner-track" aria-hidden="true" />
      </div>
      {label && <p className={`spinner-label spinner-label-${size}`}>{label}</p>}
    </div>
  );
}

interface FullPageLoaderProps {
  loading: boolean;
  message?: string;
  spinnerColor?: SpinnerColor;
}

/**
 * Full-Page Loader Overlay Component
 *
 * Displays a centered loading spinner overlay that covers the entire screen.
 * Useful for showing progress during page-level operations or data fetching.
 *
 * @example
 * <FullPageLoader loading={isLoading} message="Loading data..." />
 */
export function FullPageLoader({
  loading,
  message = 'Loading...',
  spinnerColor = 'primary',
}: FullPageLoaderProps) {
  if (!loading) return null;

  return (
    <div className="full-page-loader-overlay" role="alert" aria-live="assertive">
      <div className="full-page-loader-content">
        <Spinner size="lg" color={spinnerColor} label={message} />
      </div>
    </div>
  );
}
