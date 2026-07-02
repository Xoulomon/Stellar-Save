import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BadgeGallery } from '../components/BadgeGallery';
import type { MemberBadge } from '../hooks/useMemberBadges';

describe('BadgeGallery', () => {
  const mockBadges: MemberBadge[] = [
    {
      id: 'badge-1',
      type: 'founder',
      name: 'Founder',
      description: 'Created one of the first savings groups.',
      artwork: '🏛️',
      earnedAt: Date.now() - 7 * 24 * 60 * 60 * 1000, // 1 week ago
    },
    {
      id: 'badge-2',
      type: 'streak_5',
      name: '5-Cycle Streak',
      description: 'Contributed for 5 consecutive cycles.',
      artwork: '🔥',
      earnedAt: Date.now() - 14 * 24 * 60 * 60 * 1000, // 2 weeks ago
    },
  ];

  it('renders loading skeletons when isLoading is true', () => {
    render(<BadgeGallery badges={[]} isLoading={true} />);
    
    const loading = screen.getByLabelText(/loading badges/i);
    expect(loading).toBeInTheDocument();
    expect(loading.children.length).toBeGreaterThan(0);
  });

  it('renders empty state when badges array is empty', () => {
    render(<BadgeGallery badges={[]} isLoading={false} />);
    
    expect(screen.getByRole('status', { name: /no badges earned yet/i })).toBeInTheDocument();
    expect(screen.getByText(/no badges yet/i)).toBeInTheDocument();
    expect(screen.getByText(/contribute consistently/i)).toBeInTheDocument();
  });

  it('renders error message when error prop is provided', () => {
    const errorMsg = 'Failed to load badges.';
    render(<BadgeGallery badges={[]} isLoading={false} error={errorMsg} />);
    
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(errorMsg);
  });

  it('renders all provided badges in a grid', () => {
    render(<BadgeGallery badges={mockBadges} isLoading={false} />);
    
    expect(screen.getByText('Founder')).toBeInTheDocument();
    expect(screen.getByText('5-Cycle Streak')).toBeInTheDocument();
    expect(screen.getByText('🏛️')).toBeInTheDocument();
    expect(screen.getByText('🔥')).toBeInTheDocument();
  });

  it('displays badge count when badges are present', () => {
    render(<BadgeGallery badges={mockBadges} isLoading={false} />);
    
    expect(screen.getByText(/2 badges earned/i)).toBeInTheDocument();
  });

  it('renders share button on each badge card', () => {
    render(<BadgeGallery badges={mockBadges} isLoading={false} walletAddress="GABCD..." />);
    
    const shareButtons = screen.getAllByRole('button', { name: /share .* badge/i });
    expect(shareButtons.length).toBe(mockBadges.length);
  });

  it('renders earned dates with proper datetime attribute', () => {
    render(<BadgeGallery badges={mockBadges} isLoading={false} />);
    
    const times = screen.getAllByRole('time');
    expect(times.length).toBe(mockBadges.length);
    times.forEach((time, idx) => {
      expect(time).toHaveAttribute('datetime');
      expect(time.getAttribute('datetime')).toContain('T'); // ISO format check
    });
  });

  it('respects custom title prop', () => {
    const customTitle = 'My Achievements';
    render(<BadgeGallery badges={[]} isLoading={false} title={customTitle} />);
    
    expect(screen.getByText(customTitle)).toBeInTheDocument();
  });

  it('renders badges with correct accessibility roles', () => {
    render(<BadgeGallery badges={mockBadges} isLoading={false} />);
    
    const list = screen.getByRole('list', { name: /2 earned badges/i });
    expect(list).toBeInTheDocument();

    const listItems = screen.getAllByRole('listitem');
    expect(listItems.length).toBe(mockBadges.length);
  });

  it('badge cards are keyboard accessible', () => {
    render(<BadgeGallery badges={mockBadges} isLoading={false} />);
    
    const cards = screen.getAllByRole('listitem');
    cards.forEach((card) => {
      expect(card).toHaveAttribute('tabIndex', '0');
    });
  });
});
