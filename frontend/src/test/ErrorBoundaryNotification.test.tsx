/**
 * ErrorBoundaryNotification.test.tsx
 *
 * Verifies that a caught route-level error is surfaced through the existing
 * notification system (`notifications` contract + `ToastProvider` queue) and
 * that the boundary still degrades gracefully when no `ToastProvider` is
 * mounted above it — which is the case for the app-level boundary in
 * `main.tsx`.
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { ErrorBoundary } from '../components/ErrorBoundary/ErrorBoundary';
import { ToastProvider } from '../components/Toast/ToastProvider';
import { ToastContext } from '../components/Toast/useToast';
import { RouteBoundary } from '../routing/RouteBoundary';

import type { ToastContextType } from '../components/Toast/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Simulates a routed page component that throws during render. */
function BrokenPage({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Simulated render crash in routed page');
  return <div>Page rendered successfully</div>;
}

/** Captures what the boundary pushes into the toast queue. */
function createToastSpy() {
  const addToast = vi.fn(() => 'toast-1');
  const value: ToastContextType = {
    addToast,
    removeToast: vi.fn(),
    toasts: [],
    queue: [],
  };
  return { addToast, value };
}

// Silence expected console noise from intentional throws.
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Notification wiring ──────────────────────────────────────────────────────

describe('ErrorBoundary notification wiring', () => {
  it('pushes an error notification when a route-level boundary catches', () => {
    const { addToast, value } = createToastSpy();

    render(
      <ToastContext.Provider value={value}>
        <ErrorBoundary>
          <BrokenPage shouldThrow={true} />
        </ErrorBoundary>
      </ToastContext.Provider>
    );

    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        message: 'An unexpected error occurred while loading this page.',
      })
    );
  });

  it('surfaces a pattern-matched message for network errors', () => {
    const { addToast, value } = createToastSpy();

    function NetworkBomb() {
      throw new Error('Network request failed');
    }

    render(
      <ToastContext.Provider value={value}>
        <ErrorBoundary>
          <NetworkBomb />
        </ErrorBoundary>
      </ToastContext.Provider>
    );

    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        message:
          'A network error occurred. Please check your internet connection and try again.',
      })
    );
  });

  it('gives the notification a non-zero auto-dismiss duration', () => {
    const { addToast, value } = createToastSpy();

    render(
      <ToastContext.Provider value={value}>
        <ErrorBoundary>
          <BrokenPage shouldThrow={true} />
        </ErrorBoundary>
      </ToastContext.Provider>
    );

    expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ duration: 8000 }));
  });

  it('notifies once per caught error, not on every re-render', () => {
    const { addToast, value } = createToastSpy();

    const { rerender } = render(
      <ToastContext.Provider value={value}>
        <ErrorBoundary>
          <BrokenPage shouldThrow={true} />
        </ErrorBoundary>
      </ToastContext.Provider>
    );

    rerender(
      <ToastContext.Provider value={value}>
        <ErrorBoundary>
          <BrokenPage shouldThrow={true} />
        </ErrorBoundary>
      </ToastContext.Provider>
    );

    expect(addToast).toHaveBeenCalledTimes(1);
  });

  it('does not notify when the caller supplies a custom fallback', () => {
    const { addToast, value } = createToastSpy();

    render(
      <ToastContext.Provider value={value}>
        <ErrorBoundary fallback={<div>Custom error UI</div>}>
          <BrokenPage shouldThrow={true} />
        </ErrorBoundary>
      </ToastContext.Provider>
    );

    expect(screen.getByText('Custom error UI')).toBeInTheDocument();
    expect(addToast).not.toHaveBeenCalled();
  });

  it('does not notify when no error is thrown', () => {
    const { addToast, value } = createToastSpy();

    render(
      <ToastContext.Provider value={value}>
        <ErrorBoundary>
          <BrokenPage shouldThrow={false} />
        </ErrorBoundary>
      </ToastContext.Provider>
    );

    expect(addToast).not.toHaveBeenCalled();
  });
});

// ─── Graceful degradation ─────────────────────────────────────────────────────

describe('ErrorBoundary without a ToastProvider', () => {
  // The app-level boundary in main.tsx sits above ToastProvider. If the
  // fallback reached for a context that throws when absent, a handled render
  // error would escalate into a second, unhandled one.
  it('still renders the fallback UI when no provider is mounted', () => {
    render(
      <ErrorBoundary>
        <BrokenPage shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('renders correctly inside the real ToastProvider', () => {
    render(
      <ToastProvider>
        <ErrorBoundary>
          <BrokenPage shouldThrow={true} />
        </ErrorBoundary>
      </ToastProvider>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });
});

// ─── Simulated throw inside a real route ──────────────────────────────────────

describe('RouteBoundary notification wiring', () => {
  it('degrades gracefully when a routed page throws, keeping the app mounted', () => {
    const { addToast, value } = createToastSpy();

    render(
      <ToastContext.Provider value={value}>
        <MemoryRouter initialEntries={['/broken']}>
          <Routes>
            <Route
              path="/broken"
              element={
                <RouteBoundary>
                  <BrokenPage shouldThrow={true} />
                </RouteBoundary>
              }
            />
            <Route path="/healthy" element={<div>Healthy route</div>} />
          </Routes>
        </MemoryRouter>
      </ToastContext.Provider>
    );

    // Graceful fallback rather than a blank app.
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.queryByText('Page rendered successfully')).not.toBeInTheDocument();

    // The failure is reported through the notification system.
    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        message: 'An unexpected error occurred while loading this page.',
      })
    );
  });
});
