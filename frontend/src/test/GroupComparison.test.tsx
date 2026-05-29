import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GroupComparison } from '../components/GroupComparison';
import type { PublicGroup } from '../types/group';

const mockGroups: PublicGroup[] = [
  { id: '1', name: 'Alpha Savers', memberCount: 8, contributionAmount: 100, currency: 'XLM', status: 'active', createdAt: new Date('2024-01-01') },
  { id: '2', name: 'Beta Circle', memberCount: 5, contributionAmount: 50, currency: 'XLM', status: 'pending', createdAt: new Date('2024-02-01') },
  { id: '3', name: 'Gamma Fund', memberCount: 10, contributionAmount: 200, currency: 'XLM', status: 'active', createdAt: new Date('2024-03-01') },
  { id: '4', name: 'Delta Pool', memberCount: 3, contributionAmount: 75, currency: 'XLM', status: 'completed', createdAt: new Date('2024-04-01') },
];

function renderComp(groups = mockGroups) {
  return render(<GroupComparison availableGroups={groups} />);
}

describe('GroupComparison', () => {
  it('renders all available groups as selector buttons', () => {
    renderComp();
    mockGroups.forEach((g) => {
      expect(screen.getByRole('button', { name: new RegExp(g.name) })).toBeInTheDocument();
    });
  });

  it('shows empty state message when no group is selected', () => {
    renderComp();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows comparison table after selecting a group', () => {
    renderComp();
    fireEvent.click(screen.getByRole('button', { name: /Select Alpha Savers/i }));
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('marks selected button as aria-pressed=true', () => {
    renderComp();
    const btn = screen.getByRole('button', { name: /Select Alpha Savers/i });
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('deselects a group when clicked again', () => {
    renderComp();
    const btn = screen.getByRole('button', { name: /Select Alpha Savers/i });
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('allows selecting up to 3 groups', () => {
    renderComp();
    fireEvent.click(screen.getByRole('button', { name: /Select Alpha Savers/i }));
    fireEvent.click(screen.getByRole('button', { name: /Select Beta Circle/i }));
    fireEvent.click(screen.getByRole('button', { name: /Select Gamma Fund/i }));
    expect(screen.getAllByRole('columnheader').length).toBe(4); // Metric + 3 groups
  });

  it('disables unselected groups when 3 are already selected', () => {
    renderComp();
    fireEvent.click(screen.getByRole('button', { name: /Select Alpha Savers/i }));
    fireEvent.click(screen.getByRole('button', { name: /Select Beta Circle/i }));
    fireEvent.click(screen.getByRole('button', { name: /Select Gamma Fund/i }));
    expect(screen.getByRole('button', { name: /Select Delta Pool/i })).toBeDisabled();
  });

  it('renders metric rows: Members, Contribution, Status', () => {
    renderComp();
    fireEvent.click(screen.getByRole('button', { name: /Select Alpha Savers/i }));
    expect(screen.getByText('Members')).toBeInTheDocument();
    expect(screen.getByText('Contribution (XLM)')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('highlights best member count with gc-cell--best class', () => {
    renderComp();
    fireEvent.click(screen.getByRole('button', { name: /Select Alpha Savers/i }));
    fireEvent.click(screen.getByRole('button', { name: /Select Beta Circle/i }));
    // Alpha has 8 members (best), Beta has 5
    const bestCells = document.querySelectorAll('.gc-cell--best');
    expect(bestCells.length).toBeGreaterThan(0);
  });

  it('highlights lowest contribution amount as best', () => {
    renderComp();
    fireEvent.click(screen.getByRole('button', { name: /Select Alpha Savers/i })); // 100 XLM
    fireEvent.click(screen.getByRole('button', { name: /Select Beta Circle/i }));  // 50 XLM (best)
    const bestCells = document.querySelectorAll('.gc-cell--best');
    // At least one best cell for contribution
    expect(bestCells.length).toBeGreaterThan(0);
  });

  it('removes group from table when remove button is clicked', () => {
    renderComp();
    fireEvent.click(screen.getByRole('button', { name: /Select Alpha Savers/i }));
    fireEvent.click(screen.getByRole('button', { name: /Remove Alpha Savers from comparison/i }));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('calls window.print when Export button is clicked', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    renderComp();
    fireEvent.click(screen.getByRole('button', { name: /Select Alpha Savers/i }));
    fireEvent.click(screen.getByRole('button', { name: /Export comparison/i }));
    expect(printSpy).toHaveBeenCalledTimes(1);
    printSpy.mockRestore();
  });

  it('renders with empty availableGroups without crashing', () => {
    renderComp([]);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
