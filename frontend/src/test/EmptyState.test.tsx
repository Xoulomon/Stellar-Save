import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { EmptyState } from '../components/EmptyState/EmptyState';

describe('EmptyState', () => {
  it('renders default title when none provided', () => {
    render(<EmptyState />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('renders custom title', () => {
    render(<EmptyState title="No groups found" />);
    expect(screen.getByText('No groups found')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(<EmptyState description="Create your first group to get started." />);
    expect(screen.getByText('Create your first group to get started.')).toBeInTheDocument();
  });

  it('does not render description when not provided', () => {
    const { container } = render(<EmptyState />);
    expect(container.querySelector('.empty-state__description')).toBeNull();
  });

  it('renders action button when actionLabel is provided', () => {
    render(<EmptyState actionLabel="Create Group" onAction={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Create Group' })).toBeInTheDocument();
  });

  it('does not render action button when actionLabel is not provided', () => {
    render(<EmptyState />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('calls onAction when action button is clicked', () => {
    const onAction = vi.fn();
    render(<EmptyState actionLabel="Go" onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('renders custom illustration', () => {
    render(<EmptyState illustration={<span data-testid="icon">🌟</span>} />);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<EmptyState className="my-custom-class" />);
    expect(container.firstChild).toHaveClass('my-custom-class');
  });
});
