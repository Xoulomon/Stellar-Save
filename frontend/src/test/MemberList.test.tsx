import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemberList, Member } from '../components/MemberList';

const mockMembers: Member[] = [
  {
    address: 'GABC123DEF456GHI789JKL012MNO345PQR678STU901VWX234YZA567BCD890',
    hasContributed: true,
    hasPaidOut: false,
  },
  {
    address: 'GXYZ987WVU654TSR321PON098MLK765JIH432GFE109DCB876AZY543XWV210',
    hasContributed: false,
    hasPaidOut: true,
  },
  {
    address: 'GDEF456ABC123XYZ789MNO012PQR345STU678VWX901YZA234BCD567EFG890',
    hasContributed: true,
    hasPaidOut: true,
  },
];

describe('MemberList', () => {
  it('renders member list with correct count', () => {
    render(<MemberList members={mockMembers} />);
    expect(screen.getByText('Members (3)')).toBeInTheDocument();
  });

  it('displays truncated member addresses', () => {
    render(<MemberList members={mockMembers} />);
    expect(screen.getByText('GABC12...D890')).toBeInTheDocument();
    expect(screen.getByText('GXYZ98...V210')).toBeInTheDocument();
  });

  it('shows contribution status badges', () => {
    const { container } = render(<MemberList members={mockMembers} />);
    const badges = container.querySelectorAll('.badge');
    expect(badges.length).toBeGreaterThan(0);
  });

  it('shows empty state when no members', () => {
    render(<MemberList members={[]} />);
    expect(screen.getByText('No members yet')).toBeInTheDocument();
    expect(screen.getByText('Members (0)')).toBeInTheDocument();
  });

  it('sorts by address when clicking address header', async () => {
    const user = userEvent.setup();
    render(<MemberList members={mockMembers} />);
    
    const sortButton = screen.getByLabelText('Sort by address');
    await user.click(sortButton);
    
    expect(sortButton).toHaveTextContent('↑');
  });

  it('toggles sort order on repeated clicks', async () => {
    const user = userEvent.setup();
    render(<MemberList members={mockMembers} />);
    
    const sortButton = screen.getByLabelText('Sort by address');
    await user.click(sortButton);
    expect(sortButton).toHaveTextContent('↑');
    
    await user.click(sortButton);
    expect(sortButton).toHaveTextContent('↓');
  });

  it('sorts by contribution status', async () => {
    const user = userEvent.setup();
    render(<MemberList members={mockMembers} />);
    
    const sortButton = screen.getByLabelText('Sort by contribution status');
    await user.click(sortButton);
    
    expect(sortButton).toHaveTextContent('↑');
  });

  it('sorts by payout status', async () => {
    const user = userEvent.setup();
    render(<MemberList members={mockMembers} />);
    
    const sortButton = screen.getByLabelText('Sort by payout status');
    await user.click(sortButton);
    
    expect(sortButton).toHaveTextContent('↑');
  });

  it('applies custom className', () => {
    const { container } = render(
      <MemberList members={mockMembers} className="custom-class" />
    );
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });

  it('displays full address in title attribute', () => {
    render(<MemberList members={mockMembers} />);
    const addressElement = screen.getByText('GABC12...D890');
    expect(addressElement).toHaveAttribute(
      'title',
      'GABC123DEF456GHI789JKL012MNO345PQR678STU901VWX234YZA567BCD890'
    );
  });
});
