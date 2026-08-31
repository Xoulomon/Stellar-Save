import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../components/Toast/ToastContainer', () => ({
  default: () => null,
}));

import { ToastProvider } from '../components/Toast/ToastProvider';
import { useToast } from '../components/Toast/useToast';
import {
  useErrorToast,
  extractErrorMessage,
  inferErrorKind,
  formatErrorMessage,
} from '../hooks/useErrorToast';

function wrapper({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}

// === Formatting helpers

describe('extractErrorMessage', () => {
  it('returns a raw string unchanged', () => {
    expect(extractErrorMessage('boom')).toBe('boom');
  });

  it('reads the message off an Error', () => {
    expect(extractErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('reads the message off an error-like object', () => {
    expect(extractErrorMessage({ message: 'boom' })).toBe('boom');
  });

  it('returns an empty string for unusable values', () => {
    expect(extractErrorMessage(null)).toBe('');
    expect(extractErrorMessage(undefined)).toBe('');
    expect(extractErrorMessage(42)).toBe('');
    expect(extractErrorMessage({ message: 7 })).toBe('');
  });
});

describe('inferErrorKind', () => {
  it('classifies network failures', () => {
    expect(inferErrorKind(new Error('Failed to fetch'))).toBe('network');
    expect(inferErrorKind('Request timeout'))
      .toBe('network');
  });

  it('classifies validation failures', () => {
    expect(inferErrorKind('Amount must be a positive number')).toBe('validation');
    expect(inferErrorKind('Group name is required')).toBe('validation');
  });

  it('classifies contract failures', () => {
    expect(inferErrorKind(new Error('transaction simulation failed'))).toBe('contract');
    expect(inferErrorKind('missing trustline')).toBe('contract');
  });

  it('falls back to unknown', () => {
    expect(inferErrorKind('weird')).toBe('unknown');
    expect(inferErrorKind(null)).toBe('unknown');
  });
});

describe('formatErrorMessage', () => {
  it('prefixes the message with the error kind', () => {
    expect(formatErrorMessage('Failed to fetch', 'network')).toBe('Network error: Failed to fetch');
    expect(formatErrorMessage('name is required', 'validation')).toBe(
      'Invalid input: name is required',
    );
  });

  it('prepends the caller context when given', () => {
    expect(formatErrorMessage('reverted', 'contract', 'Payout')).toBe(
      'Payout - Transaction failed: reverted',
    );
  });

  it('falls back to the kind prefix alone with no detail', () => {
    expect(formatErrorMessage(null, 'unknown')).toBe('Something went wrong');
  });

  it('does not duplicate the prefix when the detail already is it', () => {
    expect(formatErrorMessage('Network error', 'network')).toBe('Network error');
  });
});

// === Hook behaviour

describe('useErrorToast', () => {
  it('throws when used outside ToastProvider', () => {
    expect(() => {
      renderHook(() => useErrorToast());
    }).toThrow('useToast must be used within ToastProvider');
  });

  it('adds an error toast with the formatted message', () => {
    const { result } = renderHook(
      () => ({ errorToast: useErrorToast(), toast: useToast() }),
      { wrapper },
    );

    act(() => {
      result.current.errorToast.showError(new Error('Failed to fetch'), { context: 'Groups' });
    });

    expect(result.current.toast.toasts).toHaveLength(1);
    expect(result.current.toast.toasts[0]).toMatchObject({
      type: 'error',
      message: 'Groups - Network error: Failed to fetch',
      duration: 8000,
    });
  });

  it('applies the kind-specific default duration', () => {
    const { result } = renderHook(
      () => ({ errorToast: useErrorToast(), toast: useToast() }),
      { wrapper },
    );

    act(() => {
      result.current.errorToast.showValidationError('name is required');
    });

    expect(result.current.toast.toasts[0]?.duration).toBe(5000);
  });

  it('returns a toast id from every helper', () => {
    const { result } = renderHook(() => useErrorToast(), { wrapper });

    let ids: string[] = [];
    act(() => {
      ids = [
        result.current.showNetworkError('offline'),
        result.current.showValidationError('name is required'),
        result.current.showContractError('reverted'),
      ];
    });

    expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(3);
  });

  it('keeps helper identities stable across re-renders', () => {
    const { result, rerender } = renderHook(() => useErrorToast(), { wrapper });
    const first = result.current.showError;
    rerender();
    expect(result.current.showError).toBe(first);
  });

  it('honours an explicit duration of 0 rather than the kind default', () => {
    const { result } = renderHook(
      () => ({ errorToast: useErrorToast(), toast: useToast() }),
      { wrapper },
    );

    act(() => {
      result.current.errorToast.showError('offline', { duration: 0 });
    });

    expect(result.current.toast.toasts[0]?.duration).toBe(0);
  });

  it('accepts an action and an onClose callback', () => {
    const onClick = vi.fn();
    const onClose = vi.fn();
    const { result } = renderHook(() => useErrorToast(), { wrapper });

    act(() => {
      result.current.showNetworkError('offline', {
        action: { label: 'Retry', onClick },
        onClose,
      });
    });

    expect(onClick).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
