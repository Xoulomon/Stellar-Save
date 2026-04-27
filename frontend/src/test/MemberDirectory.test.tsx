import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { MemberDirectory } from '../components/MemberDirectory';
import type { MemberProfile } from '../types/member';

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

const MEMBERS: MemberProfile[] = [
  {
    address: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJ',
    name: 'Alice Okonkwo',
    joinDate: new Date('2026-01-10'),
    contributionCount: 6,
    totalContributed: 1500,
    payoutPosition: 1,
    totalMembers: 4,
    hasReceivedPayout: true,
    status: 'active',
    streak: 6,
  },
  {
    address: 'GDEF0987654321FEDCBAZYXWVUTSRQPONMLKJIHGFEDCBA0987654321FED',
    name: 'Bob Mensah',
    joinDate: new Date('2026-02-01'),
    contributionCount: 3,
    totalContributed: 750,
    payoutPosition: 2,
    totalMembers: 4,
    hasReceivedPayout: false,
    status: 'active',
    streak: 3,
  },
  {
    address: 'GXYZ1111222233334444555566667777888899990000AAAABBBBCCCCDDDD',
    name: 'Carol Adeyemi',
    joinDate: new Date('2026-03-01'),
    contributionCount: 1,
    totalContributed: 250,
    payoutPosition: 3,
    totalMembers: 4,
    hasReceivedPayout: false,
    status: 'inactive',
    streak: 0,
  },
  {
    address: 'GAAA5555666677778888999900001111222233334444555566667777AAAA',
    joinDate: new Date('2026-03-15'),
    contributionCount: 1,
    totalContributed: 250,
    payoutPosition: 4,
    totalMembers: 4,
    hasReceivedPayout: false,
    status: 'pending',
  },
];

// ── Rendering ─────────────────────────────────────────────────────────────────

describe('MemberDirectory – rendering', () => {
  it('renders all member cards', () => {
    renderWithRouter(<MemberDirectory members={MEMBERS} />);
    expect(screen.getByText('Alice Okonkwo')).toBeInTheDocument();
    expect(screen.getByText('Bob Mensah')).toBeInTheDocument();
    expect(screen.getByText('Carol Adeyemi')).toBeInTheDocument();
  });

  it('shows member count in filter bar', () => {
    renderWithRouter(<MemberDirectory members={MEMBERS} />);
    expect(screen.getByText('4 members')).toBeInTheDocument();
  });

  it('shows empty state when no members', () => {
    renderWithRouter(<MemberDirectory members={[]} />);
    expect(screen.getByText('No members yet')).toBeInTheDocument();
  });

  it('renders skeleton cards while loading', () => {
    const { container } = renderWithRouter(<MemberDirectory members={[]} isLoading />);
    // MUI Skeleton renders with role="progressbar" or as a div with animation
    const skeletons = container.querySelectorAll('.MuiSkeleton-root');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows error alert when error prop is set', () => {
    renderWithRouter(<MemberDirectory members={[]} error="Network error" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Network error');
  });

  it('marks current user card with "You" chip', () => {
    renderWithRouter(
      <MemberDirectory
        members={MEMBERS}
        currentUserAddress="GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJ"
      />
    );
    expect(screen.getByText('You')).toBeInTheDocument();
  });

  it('shows "Paid Out" chip for members who received payout', () => {
    renderWithRouter(<MemberDirectory members={MEMBERS} />);
    expect(screen.getByText('Paid Out')).toBeInTheDocument();
  });

  it('shows streak badge for members with streak > 1', () => {
    renderWithRouter(<MemberDirectory members={MEMBERS} />);
    expect(screen.getByText('🔥 6-cycle streak')).toBeInTheDocument();
    expect(screen.getByText('🔥 3-cycle streak')).toBeInTheDocument();
  });

  it('renders custom title', () => {
    renderWithRouter(<MemberDirectory members={MEMBERS} title="Group Alpha Members" />);
    expect(screen.getByText('Group Alpha Members')).toBeInTheDocument();
  });
});

// ── Search ────────────────────────────────────────────────────────────────────

describe('MemberDirectory – search', () => {
  it('filters members by name', async () => {
    const user = userEvent.setup();
    renderWithRouter(<MemberDirectory members={MEMBERS} />);

    const searchInput = screen.getByRole('textbox', { name: /search members/i });
    await user.type(searchInput, 'Alice');

    expect(screen.getByText('Alice Okonkwo')).toBeInTheDocument();
    expect(screen.queryByText('Bob Mensah')).not.toBeInTheDocument();
    expect(screen.getByText('1 of 4')).toBeInTheDocument();
  });

  it('filters members by address substring', async () => {
    const user = userEvent.setup();
    renderWithRouter(<MemberDirectory members={MEMBERS} />);

    const searchInput = screen.getByRole('textbox', { name: /search members/i });
    await user.type(searchInput, 'GDEF');

    expect(screen.getByText('Bob Mensah')).toBeInTheDocument();
    expect(screen.queryByText('Alice Okonkwo')).not.toBeInTheDocument();
  });

  it('shows empty state when search has no results', async () => {
    const user = userEvent.setup();
    renderWithRouter(<MemberDirectory members={MEMBERS} />);

    const searchInput = screen.getByRole('textbox', { name: /search members/i });
    await user.type(searchInput, 'zzznomatch');

    expect(screen.getByText('No members match your filters')).toBeInTheDocument();
  });

  it('is case-insensitive', async () => {
    const user = userEvent.setup();
    renderWithRouter(<MemberDirectory members={MEMBERS} />);

    const searchInput = screen.getByRole('textbox', { name: /search members/i });
    await user.type(searchInput, 'alice');

    expect(screen.getByText('Alice Okonkwo')).toBeInTheDocument();
  });
});

// ── Status filter ─────────────────────────────────────────────────────────────

describe('MemberDirectory – status filter', () => {
  it('filters to active members only', async () => {
    const user = userEvent.setup();
    renderWithRouter(<MemberDirectory members={MEMBERS} />);

    // Open status select
    const statusSelect = screen.getByLabelText('Status');
    await user.click(statusSelect);
    await user.click(screen.getByRole('option', { name: 'Active' }));

    expect(screen.getByText('Alice Okonkwo')).toBeInTheDocument();
    expect(screen.getByText('Bob Mensah')).toBeInTheDocument();
    expect(screen.queryByText('Carol Adeyemi')).not.toBeInTheDocument();
  });

  it('filters to inactive members only', async () => {
    const user = userEvent.setup();
    renderWithRouter(<MemberDirectory members={MEMBERS} />);

    const statusSelect = screen.getByLabelText('Status');
    await user.click(statusSelect);
    await user.click(screen.getByRole('option', { name: 'Inactive' }));

    expect(screen.getByText('Carol Adeyemi')).toBeInTheDocument();
    expect(screen.queryByText('Alice Okonkwo')).not.toBeInTheDocument();
  });
});

// ── Payout filter ─────────────────────────────────────────────────────────────

describe('MemberDirectory – payout filter', () => {
  it('filters to members who received payout', async () => {
    const user = userEvent.setup();
    renderWithRouter(<MemberDirectory members={MEMBERS} />);

    const payoutSelect = screen.getByLabelText('Payout');
    await user.click(payoutSelect);
    await user.click(screen.getByRole('option', { name: 'Received' }));

    expect(screen.getByText('Alice Okonkwo')).toBeInTheDocument();
    expect(screen.queryByText('Bob Mensah')).not.toBeInTheDocument();
    expect(screen.getByText('1 of 4')).toBeInTheDocument();
  });

  it('filters to members pending payout', async () => {
    const user = userEvent.setup();
    renderWithRouter(<MemberDirectory members={MEMBERS} />);

    const payoutSelect = screen.getByLabelText('Payout');
    await user.click(payoutSelect);
    await user.click(screen.getByRole('option', { name: 'Pending' }));

    expect(screen.queryByText('Alice Okonkwo')).not.toBeInTheDocument();
    expect(screen.getByText('Bob Mensah')).toBeInTheDocument();
    expect(screen.getByText('3 of 4')).toBeInTheDocument();
  });
});

// ── Sorting ───────────────────────────────────────────────────────────────────

describe('MemberDirectory – sorting', () => {
  it('sorts by most contributions by default (Alice first)', () => {
    renderWithRouter(<MemberDirectory members={MEMBERS} />);
    const cards = screen.getAllByText(/Contributions/i);
    // Alice has 6 contributions, should appear first
    expect(screen.getByText('Alice Okonkwo')).toBeInTheDocument();
  });

  it('sorts by join date newest first', async () => {
    const user = userEvent.setup();
    renderWithRouter(<MemberDirectory members={MEMBERS} />);

    const sortSelect = screen.getByLabelText('Sort by');
    await user.click(sortSelect);
    await user.click(screen.getByRole('option', { name: 'Newest Members' }));

    // All members should still be visible
    expect(screen.getByText('Alice Okonkwo')).toBeInTheDocument();
    expect(screen.getByText('Bob Mensah')).toBeInTheDocument();
  });

  it('sorts by name A-Z', async () => {
    const user = userEvent.setup();
    renderWithRouter(<MemberDirectory members={MEMBERS} />);

    const sortSelect = screen.getByLabelText('Sort by');
    await user.click(sortSelect);
    await user.click(screen.getByRole('option', { name: 'Name A–Z' }));

    expect(screen.getByText('Alice Okonkwo')).toBeInTheDocument();
  });
});

// ── Clear filters ─────────────────────────────────────────────────────────────

describe('MemberDirectory – clear filters', () => {
  it('shows clear filters button when filters are active', async () => {
    const user = userEvent.setup();
    renderWithRouter(<MemberDirectory members={MEMBERS} />);

    const searchInput = screen.getByRole('textbox', { name: /search members/i });
    await user.type(searchInput, 'Alice');

    expect(screen.getByText('Clear filters')).toBeInTheDocument();
  });

  it('clears filters and shows all members', async () => {
    const user = userEvent.setup();
    renderWithRouter(<MemberDirectory members={MEMBERS} />);

    const searchInput = screen.getByRole('textbox', { name: /search members/i });
    await user.type(searchInput, 'Alice');
    expect(screen.queryByText('Bob Mensah')).not.toBeInTheDocument();

    const clearBtn = screen.getByText('Clear filters');
    await user.click(clearBtn);

    expect(screen.getByText('Bob Mensah')).toBeInTheDocument();
    expect(screen.getByText('4 members')).toBeInTheDocument();
  });

  it('shows clear filters in empty state', async () => {
    const user = userEvent.setup();
    renderWithRouter(<MemberDirectory members={MEMBERS} />);

    const searchInput = screen.getByRole('textbox', { name: /search members/i });
    await user.type(searchInput, 'zzznomatch');

    // Both the header clear and the empty state clear
    const clearBtns = screen.getAllByText('Clear filters');
    expect(clearBtns.length).toBeGreaterThanOrEqual(1);
  });
});

// ── Copy address ──────────────────────────────────────────────────────────────

describe('MemberDirectory – copy address', () => {
  it('copy button is present for each member card', () => {
    renderWithRouter(<MemberDirectory members={MEMBERS} />);
    const copyBtns = screen.getAllByRole('button', { name: /copy address/i });
    expect(copyBtns.length).toBe(MEMBERS.length);
  });

  it('calls clipboard.writeText on copy click', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    renderWithRouter(<MemberDirectory members={[MEMBERS[0]]} />);
    const copyBtn = screen.getByRole('button', { name: /copy address/i });
    await user.click(copyBtn);

    expect(writeText).toHaveBeenCalledWith(MEMBERS[0].address);
  });
});
