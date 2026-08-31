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
    // aria-label is "View details" (lowercase 'd') — use case-insensitive matcher
    fireEvent.click(screen.getByRole('button', { name: /view details/i }));
    expect(onViewDetails).toHaveBeenCalledTimes(1);
  });

  it('renders and calls onJoin', () => {
    const onJoin = vi.fn();
    render(<GroupCardActions onJoin={onJoin} />);
    fireEvent.click(screen.getByRole('button', { name: /join group/i }));
    expect(onJoin).toHaveBeenCalledTimes(1);
  });

  it('renders both buttons together', () => {
    render(<GroupCardActions onViewDetails={vi.fn()} onJoin={vi.fn()} />);
    expect(screen.getByRole('button', { name: /view details/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /join group/i })).toBeInTheDocument();
  });

  it('includes group name in aria-label when groupName is provided', () => {
    render(<GroupCardActions onViewDetails={vi.fn()} onJoin={vi.fn()} groupName="Alpha Savers" />);
    expect(screen.getByRole('button', { name: 'View details Alpha Savers' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Join group Alpha Savers' })).toBeInTheDocument();
  });

  it('uses generic aria-label when no groupName is provided', () => {
    render(<GroupCardActions onViewDetails={vi.fn()} onJoin={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'View details' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Join group' })).toBeInTheDocument();
  });

  it('only renders View Details button when onJoin is not provided', () => {
    render(<GroupCardActions onViewDetails={vi.fn()} />);
    expect(screen.getByRole('button', { name: /view details/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /join group/i })).not.toBeInTheDocument();
  });

  it('only renders Join Group button when onViewDetails is not provided', () => {
    render(<GroupCardActions onJoin={vi.fn()} />);
    expect(screen.getByRole('button', { name: /join group/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /view details/i })).not.toBeInTheDocument();
  });

  it('does not propagate click event when onViewDetails is clicked', () => {
    const parentClick = vi.fn();
    const onViewDetails = vi.fn();
    render(
      <div onClick={parentClick}>
        <GroupCardActions onViewDetails={onViewDetails} />
      </div>
    );
    fireEvent.click(screen.getByRole('button', { name: /view details/i }));
    expect(onViewDetails).toHaveBeenCalledTimes(1);
    // stopPropagation should prevent the parent handler from firing
    expect(parentClick).not.toHaveBeenCalled();
  });

  it('does not propagate click event when onJoin is clicked', () => {
    const parentClick = vi.fn();
    const onJoin = vi.fn();
    render(
      <div onClick={parentClick}>
        <GroupCardActions onJoin={onJoin} />
      </div>
    );
    fireEvent.click(screen.getByRole('button', { name: /join group/i }));
    expect(onJoin).toHaveBeenCalledTimes(1);
    expect(parentClick).not.toHaveBeenCalled();
  });
});
