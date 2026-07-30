import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { GroupCard } from '../components/GroupCard';

const defaultProps = {
  groupName: 'Alpha Savers',
  memberCount: 8,
  contributionAmount: 100,
};

function renderCard(props = {}) {
  return render(
    <MemoryRouter>
      <GroupCard {...defaultProps} {...props} />
    </MemoryRouter>
  );
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

  it('renders as a Link when groupId is provided', () => {
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
});
