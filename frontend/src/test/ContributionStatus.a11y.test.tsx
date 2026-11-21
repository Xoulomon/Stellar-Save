/**
 * Accessibility tests for ContributionStatus and CycleProgress (issue #2034).
 *
 * Verifies ARIA labels and roles added for:
 * - Progress bar (role="progressbar", aria-valuenow/min/max, aria-label)
 * - Refresh button (aria-label)
 * - Decorative status dots (aria-hidden)
 * - Deadline badge (aria-hidden on the SVG icon)
 */
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, vi } from 'vitest';

// ── Module mocks ──────────────────────────────────────────────────────────────

// ContributionStatus → formatters → @stellar-save/sdk (workspace pkg, not built in test)
vi.mock('../lib/formatters', () => ({
  formatShortAddress: (addr: string) => `${addr.slice(0, 4)}…`,
  formatAmount: (n: number) => `${n} XLM`,
}));

// CycleProgress → ../utils → groupApi → groupRepository.ts (JSX in .ts – pre-existing parse error)
vi.mock('../utils', () => ({
  calculateCycleProgressFromDeadline: (_deadline: Date, contributed: number, total: number) => ({
    contributionProgress: (contributed / total) * 100,
    timeRemaining: '2 days',
    isOverdue: false,
  }),
}));

import { ContributionStatus } from '../components/ContributionStatus';
import { CycleProgress } from '../components/CycleProgress';

import type { ContributionCycle } from '../types/contribution';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const baseCycle: ContributionCycle = {
  cycleId: 1,
  deadline: new Date(Date.now() + 1000 * 60 * 60 * 48), // 48 h from now
  contributedCount: 3,
  totalMembers: 5,
  targetAmount: 100,
  members: [
    { address: 'GABC', contributed: true, amount: 20, contributedAt: new Date() },
    { address: 'GDEF', contributed: true, amount: 20, contributedAt: new Date() },
    { address: 'GHIJ', contributed: true, amount: 20, contributedAt: new Date() },
    { address: 'GKLM', contributed: false },
    { address: 'GNOP', contributed: false },
  ],
};

// ── ContributionStatus ────────────────────────────────────────────────────────

describe('ContributionStatus – accessibility (issue #2034)', () => {
  it('progress bar has role="progressbar"', () => {
    render(<ContributionStatus cycle={baseCycle} />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('progress bar has correct aria-valuenow (3/5 = 60%)', () => {
    render(<ContributionStatus cycle={baseCycle} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '60');
  });

  it('progress bar has aria-valuemin=0 and aria-valuemax=100', () => {
    render(<ContributionStatus cycle={baseCycle} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });

  it('progress bar has a descriptive aria-label mentioning member count', () => {
    render(<ContributionStatus cycle={baseCycle} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-label');
    expect(bar.getAttribute('aria-label')).toMatch(/3 of 5/);
  });

  it('refresh button has aria-label when onRefresh is provided', () => {
    const onRefresh = vi.fn();
    render(<ContributionStatus cycle={baseCycle} onRefresh={onRefresh} />);
    expect(
      screen.getByRole('button', { name: /refresh contribution status/i })
    ).toBeInTheDocument();
  });

  it('refresh button calls onRefresh when clicked', () => {
    const onRefresh = vi.fn();
    render(<ContributionStatus cycle={baseCycle} onRefresh={onRefresh} />);
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('no refresh button rendered when onRefresh is absent', () => {
    render(<ContributionStatus cycle={baseCycle} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('status indicator dots in MemberRow are aria-hidden', () => {
    render(<ContributionStatus cycle={baseCycle} />);
    const dots = document.querySelectorAll('.w-3.h-3.rounded-full');
    dots.forEach((dot) => {
      expect(dot).toHaveAttribute('aria-hidden', 'true');
    });
  });

  it('deadline badge SVG icon is aria-hidden', () => {
    render(<ContributionStatus cycle={baseCycle} />);
    // The small clock SVG inside the deadline badge
    const deadlineSvg = document.querySelector('.w-3.h-3[fill="none"]');
    expect(deadlineSvg).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders cycle heading accessible to screen readers', () => {
    render(<ContributionStatus cycle={baseCycle} />);
    expect(screen.getByRole('heading', { name: /cycle #1/i })).toBeInTheDocument();
  });

  it('progress fill div inside progressbar is aria-hidden', () => {
    render(<ContributionStatus cycle={baseCycle} />);
    const fill = document.querySelector('.bg-gradient-to-r.h-2\\.5.rounded-full');
    expect(fill).toHaveAttribute('aria-hidden', 'true');
  });
});

// ── CycleProgress ─────────────────────────────────────────────────────────────

describe('CycleProgress – accessibility (issue #2034)', () => {
  const baseProps = {
    cycleNumber: 2,
    deadline: new Date(Date.now() + 1000 * 60 * 60 * 24),
    contributedCount: 4,
    totalMembers: 8,
    targetAmount: 200,
    currentAmount: 100,
  };

  it('renders two progressbars', () => {
    render(<CycleProgress {...baseProps} />);
    expect(screen.getAllByRole('progressbar')).toHaveLength(2);
  });

  it('contribution progressbar has aria-label describing members', () => {
    render(<CycleProgress {...baseProps} />);
    const bars = screen.getAllByRole('progressbar');
    expect(bars[0]).toHaveAttribute('aria-label');
    expect(bars[0].getAttribute('aria-label')).toMatch(/4 of 8/);
  });

  it('amount progressbar has aria-label describing amounts in XLM', () => {
    render(<CycleProgress {...baseProps} />);
    const bars = screen.getAllByRole('progressbar');
    expect(bars[1]).toHaveAttribute('aria-label');
    expect(bars[1].getAttribute('aria-label')).toMatch(/XLM/);
  });

  it('progressbar fill divs are aria-hidden', () => {
    render(<CycleProgress {...baseProps} />);
    const fills = document.querySelectorAll('.progress-fill');
    fills.forEach((fill) => {
      expect(fill).toHaveAttribute('aria-hidden', 'true');
    });
  });

  it('progressbars have aria-valuemin=0 and aria-valuemax=100', () => {
    render(<CycleProgress {...baseProps} />);
    const bars = screen.getAllByRole('progressbar');
    bars.forEach((bar) => {
      expect(bar).toHaveAttribute('aria-valuemin', '0');
      expect(bar).toHaveAttribute('aria-valuemax', '100');
    });
  });

  it('progressbars have aria-valuenow as an integer', () => {
    render(<CycleProgress {...baseProps} />);
    const bars = screen.getAllByRole('progressbar');
    bars.forEach((bar) => {
      const val = bar.getAttribute('aria-valuenow');
      expect(val).toBeTruthy();
      expect(Number(val)).toBeGreaterThanOrEqual(0);
      expect(Number(val)).toBeLessThanOrEqual(100);
    });
  });
});
