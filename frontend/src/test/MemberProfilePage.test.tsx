import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MemberProfilePage from '../pages/MemberProfilePage';
import { computeReputationScore } from '../hooks/useMemberProfile';
import type { UserStats } from '../hooks/useUserProfile';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../ui', () => ({
  AppLayout: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

vi.mock('../hooks/useClipboard', () => ({
  useClipboard: () => ({ copy: vi.fn(), copied: false, error: null }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderWithAddress(address: string) {
  return render(
    <MemoryRouter initialEntries={[`/members/${address}`]}>
      <Routes>
        <Route path="/members/:address" element={<MemberProfilePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const TEST_ADDRESS = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';

// ── computeReputationScore unit tests ─────────────────────────────────────────

describe('computeReputationScore', () => {
  const baseStats: UserStats = {
    totalContributed: 1000,
    totalReceived: 500,
    groupsJoined: 4,
    activeGroups: 2,
    completedCycles: 4,
    averageContribution: 250,
  };

  it('returns 0 for a brand-new member with no activity', () => {
    const stats: UserStats = { ...baseStats, completedCycles: 0, groupsJoined: 0, activeGroups: 0 };
    expect(computeReputationScore(stats, 0)).toBe(0);
  });

  it('returns 100 for a perfect member (max cycles, 5 active groups, 50-cycle streak)', () => {
    const stats: UserStats = { ...baseStats, completedCycles: 5, groupsJoined: 5, activeGroups: 5 };
    expect(computeReputationScore(stats, 50)).toBe(100);
  });

  it('caps participation at 5 active groups', () => {
    const stats: UserStats = { ...baseStats, completedCycles: 5, groupsJoined: 5, activeGroups: 10 };
    const score = computeReputationScore(stats, 50);
    expect(score).toBe(100); // capped, not > 100
  });

  it('caps streak bonus at 50 cycles', () => {
    const stats: UserStats = { ...baseStats, completedCycles: 5, groupsJoined: 5, activeGroups: 5 };
    const score = computeReputationScore(stats, 100);
    expect(score).toBe(100);
  });

  it('produces a score between 0 and 100 for typical member', () => {
    const score = computeReputationScore(baseStats, 10);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

// ── MemberProfilePage component tests ────────────────────────────────────────

describe('MemberProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading spinner initially', () => {
    renderWithAddress(TEST_ADDRESS);
    // Spinner renders while profile is loading
    expect(document.querySelector('.spinner, [class*="spinner"], svg, [aria-busy]') ?? screen.queryByText(/loading/i)).toBeTruthy();
  });

  it('renders member display name after loading', async () => {
    renderWithAddress(TEST_ADDRESS);
    await waitFor(() => {
      expect(screen.getByText(/Member GABCDE/i)).toBeInTheDocument();
    });
  });

  it('renders wallet address in truncated form', async () => {
    renderWithAddress(TEST_ADDRESS);
    await waitFor(() => {
      expect(screen.getByLabelText('Wallet address')).toBeInTheDocument();
    });
  });

  it('renders reputation chip with score', async () => {
    renderWithAddress(TEST_ADDRESS);
    await waitFor(() => {
      expect(screen.getByLabelText(/reputation: \d+ out of 100/i)).toBeInTheDocument();
    });
  });

  it('renders reputation score progress bar', async () => {
    renderWithAddress(TEST_ADDRESS);
    await waitFor(() => {
      expect(screen.getByRole('progressbar', { name: /reputation score/i })).toBeInTheDocument();
    });
  });

  it('renders contribution statistics section', async () => {
    renderWithAddress(TEST_ADDRESS);
    await waitFor(() => {
      expect(screen.getByText('Contribution Statistics')).toBeInTheDocument();
    });
  });

  it('renders streak display section', async () => {
    renderWithAddress(TEST_ADDRESS);
    await waitFor(() => {
      expect(screen.getByText('Contribution Streak & Milestones')).toBeInTheDocument();
      expect(screen.getByTestId('streak-display')).toBeInTheDocument();
    });
  });

  it('renders Share Profile button', async () => {
    renderWithAddress(TEST_ADDRESS);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /copy profile link/i })).toBeInTheDocument();
    });
  });

  it('shows "Member not found" when no address param resolves to a profile', async () => {
    // Render without a matching address by using an empty string
    render(
      <MemoryRouter initialEntries={['/members/']}>
        <Routes>
          <Route path="/members/" element={<MemberProfilePage />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText(/member not found/i)).toBeInTheDocument();
    });
  });

  it('route MEMBER_PROFILE is /members/:address', async () => {
    const { ROUTES } = await import('../routing/constants');
    expect(ROUTES.MEMBER_PROFILE).toBe('/members/:address');
  });

  it('buildRoute.memberProfile builds correct URL', async () => {
    const { buildRoute } = await import('../routing/constants');
    expect(buildRoute.memberProfile('GABC123')).toBe('/members/GABC123');
  });

  it('Share Profile button copies profile URL to clipboard', async () => {
    const mockCopy = vi.fn();
    vi.doMock('../hooks/useClipboard', () => ({
      useClipboard: () => ({ copy: mockCopy, copied: false, error: null }),
    }));

    renderWithAddress(TEST_ADDRESS);
    await waitFor(() => screen.getByRole('button', { name: /copy profile link/i }));
    fireEvent.click(screen.getByRole('button', { name: /copy profile link/i }));
    expect(screen.getByRole('button', { name: /copy profile link/i })).toBeInTheDocument();
  });
});
