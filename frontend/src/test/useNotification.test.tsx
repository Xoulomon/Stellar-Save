import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../components/Toast/ToastContainer', () => ({
  default: () => null,
}));

import { ToastProvider } from '../components/Toast/ToastProvider';
import { useNotification } from '../hooks/useNotification';

function wrapper({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}

describe('useNotification', () => {
  it('throws when used outside ToastProvider', () => {
    expect(() => {
      renderHook(() => useNotification());
    }).toThrow('useToast must be used within ToastProvider');
  });

  it('shows success, error, and info notifications', () => {
    const { result } = renderHook(() => useNotification(), { wrapper });

    act(() => {
      result.current.success('Saved changes', { duration: 0 });
      result.current.error('Failed to save', { duration: 0 });
      result.current.info('Syncing account', { duration: 0 });
    });

    expect(result.current.notifications).toHaveLength(3);
    expect(result.current.queue).toHaveLength(0);
    expect(result.current.notifications.map((notification) => notification.type)).toEqual([
      'success',
      'error',
      'info',
    ]);
    expect(result.current.notifications.map((notification) => notification.message)).toEqual([
      'Saved changes',
      'Failed to save',
      'Syncing account',
    ]);
  });

  it('queues overflow notifications and promotes them on dismiss', () => {
    const { result } = renderHook(() => useNotification(), { wrapper });

    act(() => {
      result.current.info('First', { duration: 0 });
      result.current.success('Second', { duration: 0 });
      result.current.error('Third', { duration: 0 });
      result.current.info('Fourth', { duration: 0 });
    });

    expect(result.current.notifications.map((notification) => notification.message)).toEqual([
      'First',
      'Second',
      'Third',
    ]);
    expect(result.current.queue.map((notification) => notification.message)).toEqual(['Fourth']);

    act(() => {
      result.current.dismiss(result.current.notifications[0].id);
    });

    expect(result.current.notifications.map((notification) => notification.message)).toEqual([
      'Second',
      'Third',
      'Fourth',
    ]);
    expect(result.current.queue).toHaveLength(0);
  });
});