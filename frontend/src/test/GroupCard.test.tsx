import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GroupCard } from '../components/GroupCard';
import { fetchGroup } from '../utils/groupApi';

vi.mock('../utils/groupApi');

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

const MOCK_FETCHED_GROUP = {
  id: 'group-42',
  name: 'Fetched Circle',
  memberCount: 12,
  contributionAmount: 10_000_000,
  currency: 'XLM',
  status: 'active',
  currentCycle: 3,
  startedAt: new Date('2026-01-01'),
  cycleDuration: 86400,
  description: 'A test group description',
  imageUrl: 'https://example.com/img.png',
  creator: 'GABC...',
  maxMembers: 20,
  minMembers: 3,
  isActive: true,
  started: true,
  createdAt: new Date('2026-01-01'),
};

describe('GroupCard — static mode', () => {
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

  it('defaults current cycle to 0 when not provided', () => {
    renderCard();
    expect(screen.getByText('0')).toBeInTheDocument();
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

  it('shows pending status badge', () => {
    renderCard({ status: 'pending' });
    expect(screen.getByText('pending')).toBeInTheDocument();
  });

  it('shows complete status badge', () => {
    renderCard({ status: 'complete' });
    expect(screen.getByText('complete')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    renderCard({ description: 'A great savings group' });
    expect(screen.getByText('A great savings group')).toBeInTheDocument();
  });

  it('renders image when imageUrl is provided', () => {
    renderCard({ imageUrl: 'https://example.com/group.jpg' });
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/group.jpg');
    expect(img).toHaveAttribute('alt', 'Alpha Savers');
  });

  it('applies className prop', () => {
    const { container } = renderCard({ className: 'my-custom-class' });
    const card = container.querySelector('.group-card');
    expect(card).toHaveClass('my-custom-class');
  });

  it('does not render description area when no description', () => {
    const { container } = renderCard();
    expect(container.querySelector('.group-card-description')).toBeNull();
  });

  it('does not render image when no imageUrl', () => {
    renderCard();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders View Details and Join Group buttons together', () => {
    renderCard({ onViewDetails: vi.fn(), onJoin: vi.fn() });
    expect(screen.getByRole('button', { name: 'View Details' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Join Group' })).toBeInTheDocument();
  });

  it('does not render View Details button when not provided', () => {
    renderCard();
    expect(screen.queryByRole('button', { name: 'View Details' })).not.toBeInTheDocument();
  });

  it('does not render Join Group button when not provided', () => {
    renderCard();
    expect(screen.queryByRole('button', { name: 'Join Group' })).not.toBeInTheDocument();
  });
});

describe('GroupCard — fetch mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading skeleton while fetching', () => {
    (fetchGroup as Mock).mockReturnValue(new Promise(() => {}));
    const { container } = render(
      <GroupCard groupId="group-42" />,
      { wrapper },
    );
    const skeletonDivs = container.querySelectorAll('.MuiSkeleton-root');
    expect(skeletonDivs.length).toBeGreaterThan(0);
  });

  it('renders error state when fetch fails', async () => {
    (fetchGroup as Mock).mockRejectedValue(new Error('Network error'));
    render(<GroupCard groupId="group-42" />, { wrapper });
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('renders error state with default message when fetch returns null', async () => {
    (fetchGroup as Mock).mockResolvedValue(null);
    render(<GroupCard groupId="group-42" />, { wrapper });
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByText('Failed to load group.')).toBeInTheDocument();
  });

  it('renders group data after successful fetch', async () => {
    (fetchGroup as Mock).mockResolvedValue(MOCK_FETCHED_GROUP);
    render(<GroupCard groupId="group-42" />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText('Fetched Circle')).toBeInTheDocument();
    });
    expect(screen.getByText('1 XLM')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('passes className in fetch mode', async () => {
    (fetchGroup as Mock).mockResolvedValue(MOCK_FETCHED_GROUP);
    const { container } = render(
      <GroupCard groupId="group-42" className="custom-klass" />,
      { wrapper },
    );
    await waitFor(() => {
      expect(screen.getByText('Fetched Circle')).toBeInTheDocument();
    });
    const link = container.querySelector('a');
    expect(link).toHaveClass('custom-klass');
  });

  it('renders as a link in fetch mode with groupId', async () => {
    (fetchGroup as Mock).mockResolvedValue(MOCK_FETCHED_GROUP);
    render(<GroupCard groupId="group-42" />, { wrapper });
    await waitFor(() => {
      expect(screen.getByRole('link')).toBeInTheDocument();
    });
    expect(screen.getByRole('link')).toHaveAttribute('href', '/groups/group-42');
  });

  it('renders description from fetched data', async () => {
    (fetchGroup as Mock).mockResolvedValue(MOCK_FETCHED_GROUP);
    render(<GroupCard groupId="group-42" />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText('A test group description')).toBeInTheDocument();
    });
  });

  it('renders image from fetched data', async () => {
    (fetchGroup as Mock).mockResolvedValue(MOCK_FETCHED_GROUP);
    render(<GroupCard groupId="group-42" />, { wrapper });
    await waitFor(() => {
      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', 'https://example.com/img.png');
    });
  });

  it('handles onViewDetails callback in fetch mode', async () => {
    const onViewDetails = vi.fn();
    (fetchGroup as Mock).mockResolvedValue(MOCK_FETCHED_GROUP);
    render(<GroupCard groupId="group-42" onViewDetails={onViewDetails} />, { wrapper });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'View Details' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'View Details' }));
    expect(onViewDetails).toHaveBeenCalledTimes(1);
  });

  it('handles onJoin callback in fetch mode', async () => {
    const onJoin = vi.fn();
    (fetchGroup as Mock).mockResolvedValue(MOCK_FETCHED_GROUP);
    render(<GroupCard groupId="group-42" onJoin={onJoin} />, { wrapper });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Join Group' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Join Group' }));
    expect(onJoin).toHaveBeenCalledTimes(1);
  });

  it('shows error when Error is thrown without message', async () => {
    (fetchGroup as Mock).mockRejectedValue({});
    render(<GroupCard groupId="group-42" />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText('Failed to load group.')).toBeInTheDocument();
    });
  });
});
