import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import BrowseGroupsPage from '../pages/BrowseGroupsPage';
import { routeConfig } from '../routing/routes';
import { ROUTES } from '../routing/constants';
import { fetchGroups } from '../utils/groupApi';
import type { PublicGroup } from '../utils/groupApi';

vi.mock('../ui', () => ({
  AppLayout: ({ children, title, subtitle }: any) => (
    <div>
      {title && <h1>{title}</h1>}
      {subtitle && <p>{subtitle}</p>}
      {children}
    </div>
  ),
  AppCard: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('../utils/groupApi', () => ({
  createGroup: vi.fn(),
  fetchGroups: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockFetchGroups = vi.mocked(fetchGroups);

const mockGroups: PublicGroup[] = [
  { id: '1', name: 'Alpha Savers', description: 'First group', memberCount: 5, contributionAmount: 100, currency: 'XLM', status: 'active', createdAt: new Date('2024-01-01') },
  { id: '2', name: 'Beta Circle', description: 'Second group', memberCount: 3, contributionAmount: 50, currency: 'XLM', status: 'pending', createdAt: new Date('2024-02-01') },
  { id: '3', name: 'Gamma Fund', description: 'Third group', memberCount: 8, contributionAmount: 200, currency: 'XLM', status: 'completed', createdAt: new Date('2024-03-01') },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <BrowseGroupsPage />
    </MemoryRouter>
  );
}

describe('BrowseGroupsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchGroups.mockResolvedValue(mockGroups);
  });

  it("renders with title 'Browse Groups' and subtitle 'Discover and join public savings groups'", async () => {
    renderPage();
    expect(screen.getByText('Browse Groups')).toBeInTheDocument();
    expect(screen.getByText('Discover and join public savings groups')).toBeInTheDocument();
  });

  it('calls fetchGroups once on mount', async () => {
    renderPage();
    await waitFor(() => {
      expect(mockFetchGroups).toHaveBeenCalledTimes(1);
    });
  });

  it('shows loading state while fetch is pending', async () => {
    mockFetchGroups.mockReturnValue(new Promise(() => {}));
    renderPage();
    const busyEl = document.querySelector('[aria-busy="true"]');
    expect(busyEl).toBeInTheDocument();
  });

  it('renders group cards after successful fetch', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Alpha Savers')).toBeInTheDocument();
      expect(screen.getByText('Beta Circle')).toBeInTheDocument();
      expect(screen.getByText('Gamma Fund')).toBeInTheDocument();
    });
  });

  it('shows error message and Retry button on fetch failure', async () => {
    mockFetchGroups.mockRejectedValue(new Error('Network error'));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
  });

  it('shows fallback error message when error has no message', async () => {
    mockFetchGroups.mockRejectedValue(new Error(''));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/failed to load groups/i)).toBeInTheDocument();
    });
  });

  it('Retry button re-invokes fetchGroups', async () => {
    const user = userEvent.setup();
    mockFetchGroups.mockRejectedValue(new Error('Network error'));
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() => {
      expect(mockFetchGroups).toHaveBeenCalledTimes(2);
    });
  });

  it('SearchBar renders with correct placeholder', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search groups by name or keyword/i)).toBeInTheDocument();
    });
  });

  it('GroupFilters renders', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/status:/i)).toBeInTheDocument();
    });
  });

  it("shows 'No groups available' empty state when fetch returns empty array and no filters active", async () => {
    mockFetchGroups.mockResolvedValue([]);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('No groups available')).toBeInTheDocument();
    });
  });

  it("shows 'No groups found' empty state when search query matches nothing", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Alpha Savers')).toBeInTheDocument();
    });
    const searchInput = screen.getByPlaceholderText(/search groups by name or keyword/i);
    await user.type(searchInput, 'zzznomatch');
    await waitFor(() => {
      expect(screen.getByText('No groups found')).toBeInTheDocument();
    });
  });

  it('aria-live region is present in the DOM', () => {
    renderPage();
    const liveRegion = document.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeInTheDocument();
  });

  it('route config contains GROUPS_BROWSE entry', () => {
    const entry = routeConfig.find(r => r.path === ROUTES.GROUPS_BROWSE);
    expect(entry).toBeDefined();
    expect(entry?.path).toBe('/groups/browse');
  });
});
