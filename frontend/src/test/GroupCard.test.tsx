import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GroupCard } from '../components/GroupCard';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

function renderCard(props = {}) {
  const defaultProps = {
    groupName: 'Alpha Savers',
    memberCount: 8,
    contributionAmount: 100,
  };
  return render(<GroupCard {...defaultProps} {...props} />, { wrapper });
}

describe('GroupCard', () => {
  it('renders group name', () => {
    renderCard();
    expect(screen.getByText('Alpha Savers')).toBeInTheDocument();
  });

  it('renders member count', () => {
    renderCard();
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('renders contribution amount with default currency', () => {
    renderCard();
    expect(screen.getByText('100 XLM')).toBeInTheDocument();
  });

  it('renders custom currency', () => {
    renderCard({ currency: 'USDC' });
    expect(screen.getByText('100 USDC')).toBeInTheDocument();
  });

  it('renders as a Link when groupId is provided (static mode)', () => {
    renderCard({ groupId: 'group-1' });
    expect(screen.getByRole('link')).toBeInTheDocument();
  });

  it('renders as a div when groupId is not provided', () => {
    const { container } = renderCard();
    expect(container.querySelector('a')).toBeNull();
  });

  it('calls onClick when card is clicked', () => {
    const onClick = vi.fn();
    renderCard({ onClick });
    fireEvent.click(screen.getByText('Alpha Savers'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders View Details button when onViewDetails is provided', () => {
    renderCard({ onViewDetails: vi.fn() });
    expect(screen.getByRole('button', { name: 'View Details' })).toBeInTheDocument();
  });

  it('calls onViewDetails when View Details is clicked', () => {
    const onViewDetails = vi.fn();
    renderCard({ onViewDetails });
    fireEvent.click(screen.getByRole('button', { name: 'View Details' }));
    expect(onViewDetails).toHaveBeenCalledTimes(1);
  });

  it('renders Join Group button when onJoin is provided', () => {
    renderCard({ onJoin: vi.fn() });
    expect(screen.getByRole('button', { name: 'Join Group' })).toBeInTheDocument();
  });

  it('calls onJoin when Join Group is clicked', () => {
    const onJoin = vi.fn();
    renderCard({ onJoin });
    fireEvent.click(screen.getByRole('button', { name: 'Join Group' }));
    expect(onJoin).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick when a button inside is clicked', () => {
    const onClick = vi.fn();
    renderCard({ onClick, onJoin: vi.fn() });
    fireEvent.click(screen.getByRole('button', { name: 'Join Group' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('shows current cycle', () => {
    renderCard({ currentCycle: 3 });
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('shows next payout date when provided', () => {
    const date = new Date('2026-08-01');
    renderCard({ nextPayoutDate: date });
    expect(screen.getByText('Aug 1, 2026')).toBeInTheDocument();
  });

  it('shows — when nextPayoutDate is not provided', () => {
    renderCard();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows active status badge by default', () => {
    renderCard();
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('shows completed status badge', () => {
    renderCard({ status: 'completed' });
    expect(screen.getByText('completed')).toBeInTheDocument();
  });
});
