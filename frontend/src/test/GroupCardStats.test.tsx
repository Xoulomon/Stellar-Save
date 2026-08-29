import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { GroupCardStats } from '../components/GroupCardStats';

describe('GroupCardStats', () => {
  it('renders contribution amount, member count, and cycle', () => {
    render(
      <GroupCardStats
        contributionAmount="100 XLM"
        memberCount={8}
        currentCycle={3}
        nextPayoutDate={undefined}
      />
    );
    expect(screen.getByText('100 XLM')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('formats the next payout date when provided', () => {
    render(
      <GroupCardStats
        contributionAmount="100 XLM"
        memberCount={8}
        currentCycle={3}
        nextPayoutDate={new Date('2026-08-01')}
      />
    );
    expect(screen.getByText('Aug 1, 2026')).toBeInTheDocument();
  });

  it('shows an em dash when no next payout date is provided', () => {
    render(
      <GroupCardStats
        contributionAmount="100 XLM"
        memberCount={8}
        currentCycle={3}
        nextPayoutDate={null}
      />
    );
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows an em dash when nextPayoutDate is undefined', () => {
    render(
      <GroupCardStats
        contributionAmount="200 USDC"
        memberCount={5}
        currentCycle={1}
        nextPayoutDate={undefined}
      />
    );
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders all four stat labels', () => {
    render(
      <GroupCardStats
        contributionAmount="50 XLM"
        memberCount={10}
        currentCycle={2}
        nextPayoutDate={null}
      />
    );
    expect(screen.getByText('Contribution')).toBeInTheDocument();
    expect(screen.getByText('Members')).toBeInTheDocument();
    expect(screen.getByText('Cycle')).toBeInTheDocument();
    expect(screen.getByText('Next Payout')).toBeInTheDocument();
  });

  it('renders zero member count correctly', () => {
    render(
      <GroupCardStats
        contributionAmount="100 XLM"
        memberCount={0}
        currentCycle={0}
        nextPayoutDate={null}
      />
    );
    // both 0 values should appear
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBeGreaterThanOrEqual(2);
  });

  it('renders large cycle numbers without truncation', () => {
    render(
      <GroupCardStats
        contributionAmount="100 XLM"
        memberCount={10}
        currentCycle={999}
        nextPayoutDate={null}
      />
    );
    expect(screen.getByText('999')).toBeInTheDocument();
  });

  it('renders USDC contribution amount', () => {
    render(
      <GroupCardStats
        contributionAmount="500 USDC"
        memberCount={6}
        currentCycle={4}
        nextPayoutDate={null}
      />
    );
    expect(screen.getByText('500 USDC')).toBeInTheDocument();
  });
});
