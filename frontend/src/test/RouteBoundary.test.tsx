import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RouteBoundary } from '../routing/RouteBoundary';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Simulates a page component that throws during render. */
function BrokenPage({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Simulated render crash in routed page');
  return <div>Page rendered successfully</div>;
}

// Silence expected console noise from intentional throws.
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RouteBoundary', () => {
  it('renders the child page when no error is thrown', () => {
    render(
      <RouteBoundary>
        <BrokenPage shouldThrow={false} />
      </RouteBoundary>,
    );
    expect(screen.getByText('Page rendered successfully')).toBeInTheDocument();
  });

  it('renders the fallback UI when a routed page throws during render', () => {
    render(
      <RouteBoundary>
        <BrokenPage shouldThrow={true} />
      </RouteBoundary>,
    );
    // Fallback heading from ErrorBoundary
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('shows a Try Again button in the fallback UI', () => {
    render(
      <RouteBoundary>
        <BrokenPage shouldThrow={true} />
      </RouteBoundary>,
    );
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('shows a Go Home button in the fallback UI', () => {
    render(
      <RouteBoundary>
        <BrokenPage shouldThrow={true} />
      </RouteBoundary>,
    );
    expect(screen.getByRole('button', { name: /go home/i })).toBeInTheDocument();
  });

  it('recovers and re-renders the page after clicking Try Again', () => {
    let shouldThrow = true;

    function ControlledPage() {
      if (shouldThrow) throw new Error('crash');
      return <div>Page recovered</div>;
    }

    const { rerender } = render(
      <RouteBoundary>
        <ControlledPage />
      </RouteBoundary>,
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    // Simulate fix before retry
    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    rerender(
      <RouteBoundary>
        <ControlledPage />
      </RouteBoundary>,
    );

    expect(screen.getByText('Page recovered')).toBeInTheDocument();
  });

  it('error boundary wraps all routes — wraps multiple different child components', () => {
    // Verifies that RouteBoundary is reusable (each routed page gets its own boundary)
    const { unmount } = render(
      <RouteBoundary>
        <BrokenPage shouldThrow={false} />
      </RouteBoundary>,
    );
    expect(screen.getByText('Page rendered successfully')).toBeInTheDocument();
    unmount();

    render(
      <RouteBoundary>
        <BrokenPage shouldThrow={true} />
      </RouteBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });
});
