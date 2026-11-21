/**
 * ErrorBoundaryFallback — presentation layer for a caught boundary error.
 *
 * Split out of the `ErrorBoundary` class because error boundaries must be
 * class components (see `ErrorBoundary.tsx`), while surfacing an error to the
 * user requires the toast context from `ToastProvider`. A function component
 * can use context; a class component cannot use hooks.
 *
 * The boundary in `main.tsx` is mounted *above* `ToastProvider`, so this
 * component must tolerate a missing provider: it reads `ToastContext`
 * directly (`useToast()` throws when no provider exists, which would turn a
 * handled render error into a fresh unhandled one). When no provider is
 * present the in-place fallback UI below is still shown.
 */
import { Alert, AlertTitle, Box, Collapse, Typography } from '@mui/material';
import { useContext, useEffect, useRef } from 'react';

import { NotificationUI } from '../../notifications/NotificationUI';
import { AppButton } from '../../ui/components/AppButton';
import { AppCard } from '../../ui/components/AppCard';
import { ToastContext } from '../Toast/useToast';

import type { UINotification } from '../../notifications/types';
import type { ErrorInfo } from 'react';

/** How long the toast stays up. Long enough to read and act on the retry. */
const NOTIFICATION_DURATION_MS = 8000;

export interface ErrorBoundaryFallbackProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
  maxRetries: number;
  onRetry: () => void;
  onGoHome: () => void;
  className?: string;
}

/**
 * Map a raw error to a user-facing message.
 *
 * Kept deliberately generic: the raw error text is only exposed in the
 * development-only details panel below.
 */
export function getErrorMessage(error: Error): string {
  const message = error.message.toLowerCase();

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

  return 'An unexpected error occurred while loading this page.';
}

/**
 * Push the caught error through the notification system.
 *
 * Uses the shared `notifications` contract (`UINotification`) and the
 * `NotificationUI` presenter, then hands the resulting toast to the
 * `ToastProvider` queue. No-ops when there is no provider.
 */
function useErrorNotification(error: Error | null, message: string) {
  const toastContext = useContext(ToastContext);
  // Guard against duplicate notifications: StrictMode double-invokes effects
  // in development, and a re-render with the same error should not re-toast.
  const notifiedError = useRef<Error | null>(null);

  useEffect(() => {
    if (!toastContext || !error) return;
    if (notifiedError.current === error) return;
    notifiedError.current = error;

    const notification: UINotification = {
      id: `error-boundary-${Date.now()}`,
      title: 'Page failed to load',
      message,
      severity: 'error',
      timestamp: Date.now(),
      uiOptions: { duration: NOTIFICATION_DURATION_MS },
    };

    // `messageToToast` returns an id that `addToast` replaces with its own,
    // so only the presentational fields are forwarded.
    const { type, message: text, duration } = NotificationUI.messageToToast(notification);
    toastContext.addToast({ type, message: text, duration });
  }, [toastContext, error, message]);
}

/**
 * Default fallback UI shown when a boundary catches a render error.
 */
export function ErrorBoundaryFallback({
  error,
  errorInfo,
  retryCount,
  maxRetries,
  onRetry,
  onGoHome,
  className,
}: ErrorBoundaryFallbackProps) {
  const errorMessage = error ? getErrorMessage(error) : 'An unexpected error occurred.';
  const canRetry = retryCount < maxRetries;
  const isDevelopment = process.env.NODE_ENV === 'development';

  useErrorNotification(error, errorMessage);

  return (
    <Box
      className={['error-boundary', className].filter(Boolean).join(' ')}
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
          <AppButton variant="contained" color="primary" onClick={onRetry} disabled={!canRetry}>
            {canRetry ? 'Try Again' : 'Max Retries Reached'}
          </AppButton>
          <AppButton variant="outlined" onClick={onGoHome}>
            Go Home
          </AppButton>
        </Box>

        {retryCount > 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ mb: 2 }}>
            Retry attempts: {retryCount}/{maxRetries}
          </Typography>
        )}

        {/* Development mode details */}
        {isDevelopment && error && (
          <Collapse in={true}>
            <Alert severity="info" sx={{ mt: 2, textAlign: 'left' }}>
              <AlertTitle>Development Details</AlertTitle>
              <Typography
                variant="body2"
                component="pre"
                sx={{ whiteSpace: 'pre-wrap', fontSize: '0.75rem' }}
              >
                {error.message}
                {error.stack && `\n\nStack Trace:\n${error.stack}`}
                {errorInfo?.componentStack &&
                  `\n\nComponent Stack:\n${errorInfo.componentStack}`}
              </Typography>
            </Alert>
          </Collapse>
        )}
      </AppCard>
    </Box>
  );
}

export default ErrorBoundaryFallback;
