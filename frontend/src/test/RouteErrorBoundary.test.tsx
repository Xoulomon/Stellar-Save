import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { RouteErrorBoundary } from '../components/RouteErrorBoundary';

const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error thrown from component');
  }
  return <div>No error content</div>;
};

describe('RouteErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children when there is no error', () => {
    render(
      <RouteErrorBoundary>
        <ThrowError shouldThrow={false} />
      </RouteErrorBoundary>
    );
    expect(screen.getByText('No error content')).toBeInTheDocument();
  });

  it('displays error message when child throws', () => {
    render(
      <RouteErrorBoundary>
        <ThrowError shouldThrow={true} />
      </RouteErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('displays error details in collapsible section', () => {
    render(
      <RouteErrorBoundary>
        <ThrowError shouldThrow={true} />
      </RouteErrorBoundary>
    );
    expect(screen.getByText('Error details')).toBeInTheDocument();
    expect(screen.getByText(/Test error thrown from component/)).toBeInTheDocument();
  });

  it('renders Try Again and Go Back buttons', () => {
    render(
      <RouteErrorBoundary>
        <ThrowError shouldThrow={true} />
      </RouteErrorBoundary>
    );
    expect(screen.getByRole('button', { name: /Try Again/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Go Back/ })).toBeInTheDocument();
  });

  it('renders children again after clicking Try Again', () => {
    const { rerender } = render(
      <RouteErrorBoundary>
        <ThrowError shouldThrow={true} />
      </RouteErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Try Again/ }));

    rerender(
      <RouteErrorBoundary>
        <ThrowError shouldThrow={false} />
      </RouteErrorBoundary>
    );
    expect(screen.getByText('No error content')).toBeInTheDocument();
  });

  it('calls window.history.back when Go Back is clicked', () => {
    const backSpy = vi.spyOn(window.history, 'back');
    render(
      <RouteErrorBoundary>
        <ThrowError shouldThrow={true} />
      </RouteErrorBoundary>
    );
    fireEvent.click(screen.getByRole('button', { name: /Go Back/ }));
    expect(backSpy).toHaveBeenCalled();
    backSpy.mockRestore();
  });
});
