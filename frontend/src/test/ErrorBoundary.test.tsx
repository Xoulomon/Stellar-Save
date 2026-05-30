import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ErrorBoundary } from '../components/ErrorBoundary/ErrorBoundary';

// Component that throws on demand
function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Test explosion');
  return <div>Safe content</div>;
}

// Component that throws network error
function NetworkBomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Network request failed');
  return <div>Safe content</div>;
}

// Component that throws unauthorized error
function AuthBomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Unauthorized access');
  return <div>Safe content</div>;
}

// Mock window.location
const mockLocation = {
  _href: '',
  pathname: '/',
  reload: vi.fn(),
};

// Spy on location.href assignment
const locationHrefSpy = vi.fn();
Object.defineProperty(mockLocation, 'href', {
  get: () => mockLocation._href,
  set: (value) => {
    locationHrefSpy(value);
    mockLocation._href = value;
  },
});

Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

// Mock navigator
Object.defineProperty(window, 'navigator', {
  value: {
    userAgent: 'test-user-agent',
  },
  writable: true,
});

// Suppress console.error noise from intentional throws
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  mockLocation.pathname = '/';
  mockLocation.reload.mockClear();
  locationHrefSpy.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <div>Hello</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('renders default fallback UI on error', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('An unexpected error occurred while loading this page.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /go home/i })).toBeInTheDocument();
  });

  it('renders custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div>Custom error UI</div>}>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Custom error UI')).toBeInTheDocument();
  });

  it('calls onError callback when error is caught', () => {
    const onError = vi.fn();
    render(
      <ErrorBoundary onError={onError}>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ componentStack: expect.any(String) }),
    );
  });

  it('displays specific error message for network errors', () => {
    render(
      <ErrorBoundary>
        <NetworkBomb shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('A network error occurred. Please check your internet connection and try again.')).toBeInTheDocument();
  });

  it('displays specific error message for unauthorized errors', () => {
    render(
      <ErrorBoundary>
        <AuthBomb shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('You are not authorized to access this resource. Please log in again.')).toBeInTheDocument();
  });

  it('resets error state when Retry is clicked', () => {
    // Use a wrapper that controls whether Bomb throws
    let throwNext = true;
    function ControlledBomb() {
      if (throwNext) throw new Error('Test explosion');
      return <div>Safe content</div>;
    }

    const { rerender } = render(
      <ErrorBoundary>
        <ControlledBomb />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    throwNext = false;
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    rerender(
      <ErrorBoundary>
        <ControlledBomb />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Safe content')).toBeInTheDocument();
  });

  it('redirects to home when Go Home is clicked', () => {
    mockLocation.pathname = '/some-other-page';
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>,
    );

    fireEvent.click(screen.getByRole('button', { name: /go home/i }));
    expect(locationHrefSpy).toHaveBeenCalledWith('/');
  });

  it('reloads page when Go Home is clicked on home page', () => {
    mockLocation.pathname = '/';
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>,
    );

    fireEvent.click(screen.getByRole('button', { name: /go home/i }));
    expect(mockLocation.reload).toHaveBeenCalled();
  });

  it('shows retry count and disables retry after max attempts', () => {
    let throwNext = true;
    function ControlledBomb() {
      if (throwNext) throw new Error('Test explosion');
      return <div>Safe content</div>;
    }

    mockLocation.pathname = '/some-page'; // Not home

    render(
      <ErrorBoundary>
        <ControlledBomb />
      </ErrorBoundary>,
    );

    // First retry - still throws
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(screen.getByText('Retry attempts: 1/3')).toBeInTheDocument();

    // Second retry - still throws
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(screen.getByText('Retry attempts: 2/3')).toBeInTheDocument();

    // Third retry - button becomes disabled
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(screen.getByText('Retry attempts: 3/3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /max retries reached/i })).toBeDisabled();
  });

  it('shows development details in development mode', () => {
    // Mock NODE_ENV
    vi.stubEnv('NODE_ENV', 'development');

    render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Development Details')).toBeInTheDocument();
    expect(screen.getByText(/Test explosion/)).toBeInTheDocument();

    vi.unstubAllEnvs();
  });

  it('does not show development details in production mode', () => {
    // Mock NODE_ENV
    vi.stubEnv('NODE_ENV', 'production');

    render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.queryByText('Development Details')).not.toBeInTheDocument();
    expect(screen.queryByText('Test explosion')).not.toBeInTheDocument();

    vi.unstubAllEnvs();
  });

  it('renders null when no children provided', () => {
    const { container } = render(<ErrorBoundary>{null}</ErrorBoundary>);
    expect(container.firstChild).toBeNull();
  });

  it('enables error reporting when flag is set', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary enableErrorReporting={true}>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>,
    );

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Reporting error:',
        expect.objectContaining({
          message: 'Test explosion',
          stack: expect.any(String),
          componentStack: expect.any(String),
          userAgent: expect.any(String),
          url: expect.any(String),
          timestamp: expect.any(String),
        })
      );
    });
  });
});
