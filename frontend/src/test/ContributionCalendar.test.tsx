import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { ContributionCalendar } from '../components/ContributionCalendar';
import type { GroupContribution, GroupCycle } from '../utils/groupApi';

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

vi.mock('react-big-calendar/lib/css/react-big-calendar.css', () => ({}));

// Use current month so events appear in the default month view
const now = new Date();
const d = (offset: number) => new Date(now.getFullYear(), now.getMonth(), offset + 1);

const baseContributions: GroupContribution[] = [
  { id: 'c1', memberId: 'm1', memberName: 'Alice', amount: 100, timestamp: d(0), transactionHash: 'tx1', status: 'completed' },
  { id: 'c2', memberId: 'm2', memberName: 'Bob',   amount: 100, timestamp: d(1), transactionHash: 'tx2', status: 'pending' },
  { id: 'c3', memberId: 'm3', memberName: 'Carol', amount: 100, timestamp: d(2), transactionHash: 'tx3', status: 'failed' },
];

const activeCycle: GroupCycle = {
  cycleNumber: 2,
  startDate: d(0),
  endDate: d(14),
  targetAmount: 300,
  currentAmount: 200,
  status: 'active',
};

function renderCalendar(
  contributions = baseContributions,
  currentCycle: GroupCycle | null = null,
  onContribute?: (d: Date) => void,
) {
  return render(
    <ContributionCalendar
      contributions={contributions}
      currentCycle={currentCycle}
      onContribute={onContribute}
    />,
  );
}

describe('ContributionCalendar', () => {
  it('renders the calendar container', () => {
    renderCalendar();
    expect(screen.getByTestId('contribution-calendar')).toBeInTheDocument();
  });

  it('renders Month, Week, Day view buttons in the toolbar', () => {
    renderCalendar();
    const toolbar = document.querySelector('.rbc-toolbar');
    expect(toolbar).toBeInTheDocument();
    expect(toolbar!.textContent).toMatch(/Month/);
    expect(toolbar!.textContent).toMatch(/Week/);
    expect(toolbar!.textContent).toMatch(/Day/);
  });

  it('renders completed contribution with checkmark prefix', () => {
    renderCalendar();
    expect(screen.getByText(/✓ Alice/)).toBeInTheDocument();
  });

  it('renders pending contribution without checkmark', () => {
    renderCalendar();
    // Bob is pending — title is just "Bob"
    const events = document.querySelectorAll('.rbc-event-content');
    const titles = Array.from(events).map((e) => e.textContent);
    expect(titles.some((t) => t === 'Bob')).toBe(true);
  });

  it('renders deadline event when active cycle is provided', () => {
    renderCalendar(baseContributions, activeCycle);
    expect(screen.getByText(/Deadline — Cycle 2/)).toBeInTheDocument();
  });

  it('does not render deadline event when cycle status is not active', () => {
    const completedCycle: GroupCycle = { ...activeCycle, status: 'completed' };
    renderCalendar(baseContributions, completedCycle);
    expect(screen.queryByText(/Deadline/)).not.toBeInTheDocument();
  });

  it('does not render deadline event when currentCycle is null', () => {
    renderCalendar(baseContributions, null);
    expect(screen.queryByText(/Deadline/)).not.toBeInTheDocument();
  });

  it('renders with empty contributions without crashing', () => {
    renderCalendar([]);
    expect(screen.getByTestId('contribution-calendar')).toBeInTheDocument();
  });

  it('applies completed class to completed events', () => {
    renderCalendar();
    expect(document.querySelector('.cal-event--completed')).toBeInTheDocument();
  });

  it('applies pending class to pending events', () => {
    renderCalendar();
    expect(document.querySelector('.cal-event--pending')).toBeInTheDocument();
  });

  it('applies failed class to failed events', () => {
    renderCalendar();
    expect(document.querySelector('.cal-event--failed')).toBeInTheDocument();
  });

  it('applies deadline class to deadline events', () => {
    renderCalendar(baseContributions, activeCycle);
    expect(document.querySelector('.cal-event--deadline')).toBeInTheDocument();
  });
});
