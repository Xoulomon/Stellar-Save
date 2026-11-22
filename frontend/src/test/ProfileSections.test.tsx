import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import { NotificationPreferences } from '../pages/profile/NotificationPreferences';
import { ProfileHeader } from '../pages/profile/ProfileHeader';
import { ProfileOverview } from '../pages/profile/ProfileOverview';
import { ProfileSettings } from '../pages/profile/ProfileSettings';

import type { UserProfile, UserStats } from '../hooks/useUserProfile';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../hooks/useClipboard', () => ({
  useClipboard: () => ({ copy: vi.fn(), copied: false }),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const STATS: UserStats = {
  totalContributed: 1000,
  totalReceived: 500,
  groupsJoined: 2,
  activeGroups: 1,
  completedCycles: 3,
  averageContribution: 250,
};

const PROFILE: UserProfile = {
  address: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJ',
  name: 'Test User',
  joinDate: new Date('2025-01-15'),
  stats: STATS,
  timeline: [
    {
      id: 'tx1',
      hash: 'hash1',
      createdAt: '2025-06-01T00:00:00Z',
      type: 'payment',
      amount: '-250',
      assetCode: 'XLM',
      from: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJ',
      to: 'GCONTRACT',
      memo: '',
      status: 'success',
      fee: '0.0000100',
    },
  ],
};

// ── ProfileHeader ─────────────────────────────────────────────────────────────

describe('ProfileHeader', () => {
  it('renders the display name', () => {
    render(<ProfileHeader address="GABC…" displayName="Alice" onEditName={vi.fn()} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('renders truncated address', () => {
    render(
      <ProfileHeader
        address="GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJ"
        displayName="Alice"
        onEditName={vi.fn()}
      />,
    );
    expect(screen.getByText(/GABC1234567890/)).toBeInTheDocument();
  });

  it('shows "Wallet not connected" when address is null', () => {
    render(<ProfileHeader address={null} displayName="Alice" onEditName={vi.fn()} />);
    expect(screen.getByText(/wallet not connected/i)).toBeInTheDocument();
  });

  it('calls onEditName when edit button is clicked', async () => {
    const onEditName = vi.fn();
    const user = userEvent.setup();
    render(<ProfileHeader address="GABC…" displayName="Alice" onEditName={onEditName} />);
    await user.click(screen.getByRole('button', { name: /edit display name/i }));
    expect(onEditName).toHaveBeenCalled();
  });

  it('shows join date when provided', () => {
    render(
      <ProfileHeader
        address="GABC…"
        displayName="Alice"
        joinDate={new Date('2025-01-15')}
        onEditName={vi.fn()}
      />,
    );
    expect(screen.getByText(/January 15, 2025/)).toBeInTheDocument();
  });
});

// ── ProfileOverview ───────────────────────────────────────────────────────────

describe('ProfileOverview', () => {
  it('shows loading text', () => {
    render(<ProfileOverview profile={null} isLoading />);
    expect(screen.getByText(/loading profile/i)).toBeInTheDocument();
  });

  it('shows connect wallet prompt when no profile and not loading', () => {
    render(<ProfileOverview profile={null} isLoading={false} />);
    expect(screen.getByText(/connect your wallet/i)).toBeInTheDocument();
  });

  it('renders timeline section with a profile', () => {
    render(<ProfileOverview profile={PROFILE} isLoading={false} />);
    expect(screen.getByText(/participation timeline/i)).toBeInTheDocument();
  });

  it('shows no history message when timeline is empty', () => {
    render(<ProfileOverview profile={{ ...PROFILE, timeline: [] }} isLoading={false} />);
    expect(screen.getByText(/no savings history/i)).toBeInTheDocument();
  });
});

// ── ProfileSettings ───────────────────────────────────────────────────────────

describe('ProfileSettings', () => {
  it('populates display name field with current name', () => {
    render(<ProfileSettings displayName="Bob" onSave={vi.fn()} />);
    expect(screen.getByLabelText(/display name/i)).toHaveValue('Bob');
  });

  it('calls onSave with name when save is clicked', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(<ProfileSettings displayName="Bob" onSave={onSave} />);
    await user.click(screen.getByRole('button', { name: /save settings/i }));
    expect(onSave).toHaveBeenCalledWith('Bob', expect.any(String), expect.any(String));
  });

  it('shows success alert after save', async () => {
    const user = userEvent.setup();
    render(<ProfileSettings displayName="Bob" onSave={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /save settings/i }));
    expect(screen.getByText(/settings saved/i)).toBeInTheDocument();
  });
});

// ── NotificationPreferences ───────────────────────────────────────────────────

describe('NotificationPreferences', () => {
  it('renders all notification rows', () => {
    render(<NotificationPreferences />);
    expect(screen.getByText(/email — contributions/i)).toBeInTheDocument();
    expect(screen.getByText(/push — payouts/i)).toBeInTheDocument();
    expect(screen.getByText(/sms alerts/i)).toBeInTheDocument();
  });

  it('shows success alert after saving preferences', async () => {
    const user = userEvent.setup();
    render(<NotificationPreferences />);
    await user.click(screen.getByRole('button', { name: /save preferences/i }));
    expect(screen.getByText(/preferences saved/i)).toBeInTheDocument();
  });

  it('toggles a switch when clicked', () => {
    render(<NotificationPreferences />);
    const switches = screen.getAllByRole('checkbox');
    const initial = (switches[0] as HTMLInputElement).checked;
    fireEvent.click(switches[0]);
    expect((switches[0] as HTMLInputElement).checked).toBe(!initial);
  });
});
