import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { GroupFilters } from '../components/GroupFilters';

describe('GroupFilters', () => {
  it('renders status and sort dropdowns', () => {
    render(<GroupFilters onFilterChange={vi.fn()} />);
    expect(screen.getByText(/Status:/)).toBeInTheDocument();
    expect(screen.getByText(/Sort:/)).toBeInTheDocument();
  });

  it('renders amount range inputs', () => {
    render(<GroupFilters onFilterChange={vi.fn()} />);
    const minInputs = screen.getAllByPlaceholderText('Min');
    const maxInputs = screen.getAllByPlaceholderText('Max');
    expect(minInputs.length).toBeGreaterThan(0);
    expect(maxInputs.length).toBeGreaterThan(0);
  });

  it('calls onFilterChange when amount input changes', () => {
    const onFilterChange = vi.fn();
    render(<GroupFilters onFilterChange={onFilterChange} />);
    const minInputs = screen.getAllByPlaceholderText('Min');
    fireEvent.change(minInputs[0], { target: { value: '50' } });
    expect(onFilterChange).toHaveBeenCalled();
    expect(onFilterChange.mock.calls[0][0]).toMatchObject({ minAmount: '50' });
  });

  it('calls onFilterChange with defaults when Reset is clicked', () => {
    const onFilterChange = vi.fn();
    render(<GroupFilters onFilterChange={onFilterChange} />);
    fireEvent.click(screen.getByRole('button', { name: /reset/i }));
    expect(onFilterChange).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'all',
        minAmount: '',
        maxAmount: '',
        sort: 'date-desc',
      })
    );
  });

  it('applies initialFilters', () => {
    render(
      <GroupFilters
        onFilterChange={vi.fn()}
        initialFilters={{ status: 'active', sort: 'name-asc' }}
      />
    );
    expect(screen.getByText(/Active/)).toBeInTheDocument();
  });
});
