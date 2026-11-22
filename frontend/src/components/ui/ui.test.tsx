/**
 * Tests for the standardized UI state barrel (issue #2032).
 *
 * Verifies that LoadingState, EmptyState, and ErrorState are correctly
 * re-exported from the ui/ barrel and behave as expected including
 * the ARIA enhancements added in this issue.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { LoadingState, EmptyState, ErrorState } from './index';

// ── LoadingState ──────────────────────────────────────────────────────────────

describe('LoadingState (via ui barrel)', () => {
  it('renders with role="status"', () => {
    render(<LoadingState />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders default message', () => {
    render(<LoadingState />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('renders custom message', () => {
    render(<LoadingState message="Fetching groups…" />);
    expect(screen.getByText('Fetching groups…')).toBeInTheDocument();
  });

  it('applies full-page class when fullPage=true', () => {
    const { container } = render(<LoadingState fullPage />);
    expect(container.firstChild).toHaveClass('loading-state--full-page');
  });

  it('spinner is aria-hidden', () => {
    const { container } = render(<LoadingState />);
    const spinner = container.querySelector('.loading-state__spinner');
    expect(spinner).toHaveAttribute('aria-hidden', 'true');
  });
});

// ── EmptyState ────────────────────────────────────────────────────────────────

describe('EmptyState (via ui barrel)', () => {
  it('renders with role="status" (issue #2032 addition)', () => {
    render(<EmptyState />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('aria-label defaults to the visible title', () => {
    render(<EmptyState title="No groups found" />);
    const el = screen.getByRole('status');
    expect(el).toHaveAttribute('aria-label', 'No groups found');
  });

  it('aria-label is overridable', () => {
    render(<EmptyState title="No groups found" aria-label="Custom accessible name" />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Custom accessible name');
  });

  it('renders action button with correct text', () => {
    render(<EmptyState actionLabel="Create Group" onAction={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Create Group' })).toBeInTheDocument();
  });

  it('calls onAction when action button is clicked', () => {
    const onAction = vi.fn();
    render(<EmptyState actionLabel="Go" onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('renders illustration when provided', () => {
    render(<EmptyState illustration={<span data-testid="icon">🌟</span>} />);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<EmptyState className="my-class" />);
    expect(container.firstChild).toHaveClass('my-class');
  });

  it('renders description when provided', () => {
    render(<EmptyState description="Start by creating your first group." />);
    expect(screen.getByText('Start by creating your first group.')).toBeInTheDocument();
  });

  it('does not render action button when actionLabel is absent', () => {
    render(<EmptyState />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('does not render description element when description is absent', () => {
    const { container } = render(<EmptyState />);
    expect(container.querySelector('.empty-state__description')).toBeNull();
  });
});

// ── ErrorState ────────────────────────────────────────────────────────────────

describe('ErrorState (via ui barrel)', () => {
  it('renders with role="alert"', () => {
    render(<ErrorState message="Something went wrong" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders the error message', () => {
    render(<ErrorState message="Network timeout" />);
    expect(screen.getByText('Network timeout')).toBeInTheDocument();
  });

  it('renders retry button with aria-label when onRetry is provided', () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Fetch failed" onRetry={onRetry} />);
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('calls onRetry when retry button is clicked', () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Fetch failed" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('does not render retry button when onRetry is absent', () => {
    render(<ErrorState message="Something failed" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('applies custom retryLabel', () => {
    render(<ErrorState message="Failed" onRetry={vi.fn()} retryLabel="Try again" />);
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('applies full-page class when fullPage=true', () => {
    const { container } = render(<ErrorState message="Error" fullPage />);
    expect(container.firstChild).toHaveClass('error-state--full-page');
  });
});
