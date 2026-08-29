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
});
