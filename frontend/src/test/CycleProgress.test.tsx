import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { CycleProgress } from '../components/CycleProgress';

const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 3); // 3 days from now
const pastDate = new Date(Date.now() - 1000 * 60 * 60); // 1 hour ago

const baseProps = {
  cycleNumber: 1,
  deadline: futureDate,
  contributedCount: 5,
  totalMembers: 10,
  targetAmount: 1000,
  currentAmount: 500,
};

describe('CycleProgress', () => {
  it('renders cycle number', () => {
    render(<CycleProgress {...baseProps} />);
    expect(screen.getByText('Cycle 1')).toBeInTheDocument();
  });

  it('renders contribution stats', () => {
    render(<CycleProgress {...baseProps} />);
    expect(screen.getByText('5/10')).toBeInTheDocument();
  });

  it('renders target amount', () => {
    render(<CycleProgress {...baseProps} />);
    expect(screen.getByText('1,000 XLM')).toBeInTheDocument();
  });

  it('renders current amount', () => {
    render(<CycleProgress {...baseProps} />);
    expect(screen.getByText('500 XLM')).toBeInTheDocument();
  });

  it('shows "Ended" when deadline has passed', () => {
    render(<CycleProgress {...baseProps} deadline={pastDate} />);
    expect(screen.getByText('Ended')).toBeInTheDocument();
  });

  it('shows time remaining for future deadline', () => {
    render(<CycleProgress {...baseProps} />);
    // Should show days remaining
    expect(screen.getByText(/\d+d \d+h/)).toBeInTheDocument();
  });

  it('shows completion message when all members contributed', () => {
    render(
      <CycleProgress {...baseProps} contributedCount={10} totalMembers={10} />,
    );
    expect(screen.getByText('✓ Cycle complete')).toBeInTheDocument();
  });

  it('does not show completion message when not all contributed', () => {
    render(<CycleProgress {...baseProps} />);
    expect(
      screen.queryByText('✓ All members have contributed'),
    ).not.toBeInTheDocument();
  });

  it('renders with completed status', () => {
    const { container } = render(
      <CycleProgress {...baseProps} status="completed" />,
    );
    expect(container.querySelector('.cycle-progress--completed')).toBeInTheDocument();
  });

  it('renders with pending status', () => {
    const { container } = render(
      <CycleProgress {...baseProps} status="pending" />,
    );
    expect(container.querySelector('.cycle-progress--pending')).toBeInTheDocument();
  });

  it('renders progress percentages', () => {
    render(<CycleProgress {...baseProps} />);
    expect(screen.getAllByText('50%').length).toBeGreaterThan(0);
  });
});
