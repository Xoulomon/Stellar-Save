/**
 * Snapshot tests for ProfilePage
 *
 * Captures rendering state to detect unintended UI regressions
 */
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ProfilePage from '../pages/ProfilePage';

// ── Mock dependencies ─────────────────────────────────────────────────────────

vi.mock('../ui', () => ({
  AppLayout: ({ children, title }: { children: React.ReactNode; title?: string }) => (
    <div data-testid="app-layout">
      {title && <h1>{title}</h1>}
      {children}
    </div>
  ),
  AppCard: ({ children }: { children: React.ReactNode }) => <div data-testid="app-card">{children}</div>,
}));

vi.mock('../hooks/useWallet', () => ({
  useWallet: () => ({ 
    address: 'GABC123XYZ456DEF789', 
    isConnected: true,
  }),
}));

vi.mock('../hooks/useClipboard', () => ({
  useClipboard: () => ({ 
    copyToClipboard: vi.fn(),
    isCopied: false,
  }),
}));

// Mock fixture data
const mockUserProfile = {
  address: 'GABC123XYZ456DEF789',
  displayName: 'John Doe',
  email: 'john@example.com',
  avatar: null,
  joinedAt: new Date('2024-01-10'),
  notificationsEnabled: true,
  emailNotifications: false,
  language: 'en',
  timezone: 'UTC',
};

const mockUserStats = {
  totalGroups: 5,
  activeGroups: 3,
  completedGroups: 2,
  totalContributions: 12500,
  totalPayoutsReceived: 8000,
  currentStreak: 14,
  longestStreak: 28,
  reputationScore: 92,
};

const mockTransactions = [
  { 
    id: 'tx1', 
    type: 'contribution', 
    groupName: 'Alpha Circle', 
    amount: 100, 
    timestamp: new Date('2024-06-01'), 
    status: 'confirmed',
    hash: 'abc123',
  },
  { 
    id: 'tx2', 
    type: 'payout', 
    groupName: 'Beta Pool', 
    amount: 4000, 
    timestamp: new Date('2024-05-15'), 
    status: 'confirmed',
    hash: 'def456',
  },
  { 
    id: 'tx3', 
    type: 'contribution', 
    groupName: 'Gamma Savings', 
    amount: 250, 
    timestamp: new Date('2024-05-28'), 
    status: 'confirmed',
    hash: 'ghi789',
  },
];

vi.mock('../hooks/useUserProfile', () => ({
  useUserProfile: () => ({
    profile: mockUserProfile,
    stats: mockUserStats,
    isLoading: false,
    error: null,
    updateProfile: vi.fn(),
  }),
}));

vi.mock('../hooks/useTransactions', () => ({
  useTransactions: () => ({
    transactions: mockTransactions,
    isLoading: false,
    error: null,
  }),
}));

// ── Snapshot tests ────────────────────────────────────────────────────────────

describe('ProfilePage snapshot tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('matches snapshot with full profile data', () => {
    const { container } = render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );
    expect(container).toMatchSnapshot();
  });

  it('matches snapshot with loading state', () => {
    vi.mock('../hooks/useUserProfile', () => ({
      useUserProfile: () => ({
        profile: null,
        stats: null,
        isLoading: true,
        error: null,
        updateProfile: vi.fn(),
      }),
    }));

    vi.mock('../hooks/useTransactions', () => ({
      useTransactions: () => ({
        transactions: [],
        isLoading: true,
        error: null,
      }),
    }));

    const { container } = render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );
    expect(container).toMatchSnapshot();
  });

  it('matches snapshot with no wallet connected', () => {
    vi.mock('../hooks/useWallet', () => ({
      useWallet: () => ({ 
        address: null, 
        isConnected: false,
      }),
    }));

    const { container } = render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );
    expect(container).toMatchSnapshot();
  });

  it('matches snapshot with empty transaction history', () => {
    vi.mock('../hooks/useTransactions', () => ({
      useTransactions: () => ({
        transactions: [],
        isLoading: false,
        error: null,
      }),
    }));

    const { container } = render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );
    expect(container).toMatchSnapshot();
  });

  it('matches snapshot with error state', () => {
    vi.mock('../hooks/useUserProfile', () => ({
      useUserProfile: () => ({
        profile: null,
        stats: null,
        isLoading: false,
        error: new Error('Failed to fetch profile'),
        updateProfile: vi.fn(),
      }),
    }));

    const { container } = render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );
    expect(container).toMatchSnapshot();
  });
});
