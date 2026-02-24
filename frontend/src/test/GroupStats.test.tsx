import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GroupStats } from '../components/GroupStats';

describe('GroupStats', () => {
  it('renders all statistics correctly', () => {
    render(
      <GroupStats
        totalContributed={5000}
        totalPaidOut={3000}
        totalExpected={10000}
        currency="XLM"
      />
    );

    expect(screen.getByText('Total Contributed')).toBeInTheDocument();
    expect(screen.getByText('5,000 XLM')).toBeInTheDocument();
    expect(screen.getByText('Total Paid Out')).toBeInTheDocument();
    expect(screen.getByText('3,000 XLM')).toBeInTheDocument();
  });

  it('calculates completion percentage correctly', () => {
    render(
      <GroupStats
        totalContributed={5000}
        totalPaidOut={3000}
        totalExpected={10000}
      />
    );

    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('calculates payout percentage correctly', () => {
    render(
      <GroupStats
        totalContributed={5000}
        totalPaidOut={3000}
        totalExpected={10000}
      />
    );

    expect(screen.getByText('60%')).toBeInTheDocument();
  });

  it('handles zero values gracefully', () => {
    render(
      <GroupStats
        totalContributed={0}
        totalPaidOut={0}
        totalExpected={0}
      />
    );

    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('uses default currency when not provided', () => {
    render(
      <GroupStats
        totalContributed={1000}
        totalPaidOut={500}
        totalExpected={2000}
      />
    );

    expect(screen.getByText('1,000 XLM')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <GroupStats
        totalContributed={1000}
        totalPaidOut={500}
        totalExpected={2000}
        className="custom-class"
      />
    );

    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });
});
