import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { PayoutSchedulePanel } from '../components/panels/PayoutSchedulePanel';

import type { GroupCycle } from '../utils/groupApi';

const mockCycles: GroupCycle[] = [
  {
    cycleNumber: 1,
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-02-01'),
    targetAmount: 2000,
    currentAmount: 2000,
    status: 'completed',
  },
  {
    cycleNumber: 2,
    startDate: new Date('2024-02-01'),
    endDate: new Date('2024-03-01'),
    targetAmount: 2000,
    currentAmount: 1000,
    status: 'active',
  },
];

const mockCurrentCycle: GroupCycle = {
  cycleNumber: 2,
  startDate: new Date('2024-02-01'),
  endDate: new Date('2024-03-01'),
  targetAmount: 2000,
  currentAmount: 1000,
  status: 'active',
};

describe('PayoutSchedulePanel', () => {
  it('renders cycle history heading', () => {
    render(<PayoutSchedulePanel cycles={mockCycles} />);
    expect(screen.getByText('Cycle History')).toBeInTheDocument();
  });

  it('renders all cycles', () => {
    render(<PayoutSchedulePanel cycles={mockCycles} />);
    expect(screen.getByText('Cycle #1')).toBeInTheDocument();
    expect(screen.getByText('Cycle #2')).toBeInTheDocument();
  });

  it('displays current cycle when provided', () => {
    render(<PayoutSchedulePanel cycles={mockCycles} currentCycle={mockCurrentCycle} />);
    expect(screen.getByText('Current Cycle #2')).toBeInTheDocument();
  });

  it('displays completed status badge', () => {
    render(<PayoutSchedulePanel cycles={mockCycles} />);
    expect(screen.getByText('completed')).toBeInTheDocument();
  });

  it('displays active status badge', () => {
    render(<PayoutSchedulePanel cycles={mockCycles} />);
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('renders cycle amounts', () => {
    render(<PayoutSchedulePanel cycles={mockCycles} />);
    expect(screen.getByText(/2000/)).toBeInTheDocument();
  });

  it('renders empty when no cycles', () => {
    render(<PayoutSchedulePanel cycles={[]} />);
    expect(screen.getByText('Cycle History')).toBeInTheDocument();
  });
});
