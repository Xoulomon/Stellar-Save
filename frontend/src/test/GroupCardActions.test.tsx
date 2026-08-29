import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { GroupCardActions } from '../components/GroupCardActions';

describe('GroupCardActions', () => {
  it('renders no buttons when no handlers are provided', () => {
    render(<GroupCardActions />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders and calls onViewDetails', () => {
    const onViewDetails = vi.fn();
    render(<GroupCardActions onViewDetails={onViewDetails} />);
    fireEvent.click(screen.getByRole('button', { name: 'View Details' }));
    expect(onViewDetails).toHaveBeenCalledTimes(1);
  });

  it('renders and calls onJoin', () => {
    const onJoin = vi.fn();
    render(<GroupCardActions onJoin={onJoin} />);
    fireEvent.click(screen.getByRole('button', { name: 'Join Group' }));
    expect(onJoin).toHaveBeenCalledTimes(1);
  });

  it('renders both buttons together', () => {
    render(<GroupCardActions onViewDetails={vi.fn()} onJoin={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'View Details' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Join Group' })).toBeInTheDocument();
  });
});
