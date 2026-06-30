import React, { StrictMode } from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ToastItem from '../components/Toast/ToastItem';
import type { Toast } from '../components/Toast/types';

describe('ToastItem Strict Mode', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('auto-dismisses a toast only once', () => {
    vi.useFakeTimers();

    const onClose = vi.fn();
    const toastOnClose = vi.fn();
    const toast: Toast = {
      id: 'toast-1',
      message: 'Strict mode notification',
      type: 'info',
      duration: 100,
      onClose: toastOnClose,
    };

    render(
      <StrictMode>
        <ToastItem toast={toast} onClose={onClose} />
      </StrictMode>,
    );

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledWith('toast-1');
    expect(toastOnClose).toHaveBeenCalledTimes(1);
  });
});