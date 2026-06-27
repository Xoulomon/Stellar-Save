/**
 * Sentry browser integration for Stellar-Save frontend.
 *
 * Initialised once from main.tsx.  Records JS exceptions and React component
 * errors so they appear alongside backend crash reports in the same Sentry
 * project.
 *
 * Environment variables (VITE_-prefixed so they are safe to expose to the browser):
 *   VITE_SENTRY_DSN         – Required to enable. Leave unset to disable.
 *   VITE_SENTRY_ENVIRONMENT – Defaults to import.meta.env.MODE (development / production)
 *   VITE_SENTRY_RELEASE     – Optional git SHA / version string
 */

import * as Sentry from '@sentry/react';

let _initialized = false;

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn || _initialized) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT ?? import.meta.env.MODE,
    release: import.meta.env.VITE_SENTRY_RELEASE,
    integrations: [
      Sentry.browserTracingIntegration(),
    ],
    tracesSampleRate: import.meta.env.MODE === 'production' ? 0.2 : 1.0,
    // Filter out noise from browser extensions and third-party scripts
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
    ],
  });

  _initialized = true;
}

/** Attach a wallet address as the Sentry user identity. */
export function setSentryUser(walletAddress: string | null): void {
  if (!_initialized) return;
  Sentry.setUser(walletAddress ? { id: walletAddress } : null);
}

/** Capture an exception with optional contextual data. */
export function captureException(err: unknown, context?: Record<string, unknown>): void {
  if (!_initialized) {
    console.error('[captureException]', err, context);
    return;
  }
  Sentry.withScope(scope => {
    if (context) scope.setExtras(context);
    Sentry.captureException(err);
  });
}

/**
 * React error boundary HOC powered by Sentry.
 * Wrap the application root to capture render-time exceptions.
 *
 * Usage:
 *   export default withSentryErrorBoundary(App, { fallback: <p>Something went wrong</p> });
 */
export const withSentryErrorBoundary = Sentry.withErrorBoundary;
export const SentryErrorBoundary = Sentry.ErrorBoundary;
