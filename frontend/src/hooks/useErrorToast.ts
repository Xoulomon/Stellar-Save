import { useCallback } from 'react';

import { useToast } from '../components/Toast/useToast';

import type { ToastAction } from '../components/Toast/types';

/**
 * Single entry point for surfacing errors to the user.
 *
 * Components must not call the toast context directly for errors: routing
 * everything through here keeps message formatting and dismiss timing
 * consistent across network, validation and contract failures.
 */

export type ErrorKind = 'network' | 'validation' | 'contract' | 'unknown';

export interface ShowErrorOptions {
  kind?: ErrorKind;
  /** Prefix shown before the formatted message, e.g. the action that failed. */
  context?: string;
  duration?: number;
  action?: ToastAction;
  onClose?: () => void;
}

export interface UseErrorToastReturn {
  showError: (error: unknown, options?: ShowErrorOptions) => string;
  showNetworkError: (error: unknown, options?: Omit<ShowErrorOptions, 'kind'>) => string;
  showValidationError: (error: unknown, options?: Omit<ShowErrorOptions, 'kind'>) => string;
  showContractError: (error: unknown, options?: Omit<ShowErrorOptions, 'kind'>) => string;
}

// Errors that resolve on retry stay up longer so the retry action is reachable.
const DEFAULT_DURATION: Record<ErrorKind, number> = {
  network: 8000,
  validation: 5000,
  contract: 8000,
  unknown: 6000,
};

const KIND_PREFIX: Record<ErrorKind, string> = {
  network: 'Network error',
  validation: 'Invalid input',
  contract: 'Transaction failed',
  unknown: 'Something went wrong',
};

// === Helpers

/** Reduce an unknown throwable to a displayable string. */
export function extractErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    const { message } = error as { message: unknown };
    if (typeof message === 'string') {
      return message;
    }
  }
  return '';
}

/** Best-effort classification so callers can omit `kind` in generic catch blocks. */
export function inferErrorKind(error: unknown): ErrorKind {
  const message = extractErrorMessage(error).toLowerCase();
  if (!message) {
    return 'unknown';
  }
  if (/network|fetch|timeout|offline|econn|502|503|504/.test(message)) {
    return 'network';
  }
  if (/invalid|required|must be|validation/.test(message)) {
    return 'validation';
  }
  if (/contract|transaction|simulation|stroop|trustline|xdr|horizon/.test(message)) {
    return 'contract';
  }
  return 'unknown';
}

/** Standard user-facing shape: `Context: Kind - detail`. */
export function formatErrorMessage(error: unknown, kind: ErrorKind, context?: string): string {
  const detail = extractErrorMessage(error).trim();
  const prefix = KIND_PREFIX[kind];
  const body = detail && detail !== prefix ? `${prefix}: ${detail}` : prefix;
  return context ? `${context} - ${body}` : body;
}

// === Hook

export function useErrorToast(): UseErrorToastReturn {
  const { addToast } = useToast();

  const showError = useCallback(
    (error: unknown, options: ShowErrorOptions = {}) => {
      const kind = options.kind ?? inferErrorKind(error);
      return addToast({
        type: 'error',
        message: formatErrorMessage(error, kind, options.context),
        duration: options.duration ?? DEFAULT_DURATION[kind],
        ...(options.action ? { action: options.action } : {}),
        ...(options.onClose ? { onClose: options.onClose } : {}),
      });
    },
    [addToast]
  );

  const showNetworkError = useCallback(
    (error: unknown, options?: Omit<ShowErrorOptions, 'kind'>) =>
      showError(error, { ...options, kind: 'network' }),
    [showError]
  );

  const showValidationError = useCallback(
    (error: unknown, options?: Omit<ShowErrorOptions, 'kind'>) =>
      showError(error, { ...options, kind: 'validation' }),
    [showError]
  );

  const showContractError = useCallback(
    (error: unknown, options?: Omit<ShowErrorOptions, 'kind'>) =>
      showError(error, { ...options, kind: 'contract' }),
    [showError]
  );

  return { showError, showNetworkError, showValidationError, showContractError };
}

export default useErrorToast;
