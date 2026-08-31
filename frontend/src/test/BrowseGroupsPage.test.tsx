import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, vi } from 'vitest';

import BrowseGroupsPage from '../pages/BrowseGroupsPage';
import { ROUTES } from '../routing/constants';
import { routeConfig } from '../routing/routes';
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
  {
    id: '1',
    name: 'Alpha Savers',
    description: 'First group',
    memberCount: 5,
    contributionAmount: 100,
    currency: 'XLM',
    status: 'active',
    createdAt: new Date('2024-01-01'),
  },
  {
    id: '2',
    name: 'Beta Circle',
    description: 'Second group',
    memberCount: 3,
    contributionAmount: 50,
    currency: 'XLM',
    status: 'pending',
    createdAt: new Date('2024-02-01'),
  },
  {
    id: '3',
    name: 'Gamma Fund',
    description: 'Third group',
    memberCount: 8,
    contributionAmount: 200,
    currency: 'XLM',
    status: 'completed',
    createdAt: new Date('2024-03-01'),
  },
];

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <BrowseGroupsPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('BrowseGroupsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // BrowseGroupsPage persists the active search/filter state to
    // localStorage (stellar-save:search-preferences) so it survives
    // navigation. Clear it between tests so one test's search term
    // doesn't leak into the next test's initial filters.
    window.localStorage.clear();
    mockFetchGroups.mockResolvedValue(mockGroups);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (typeof vi.unstubAllGlobals === 'function') {
      vi.unstubAllGlobals();
    }
  });

  it("renders with title 'Browse Groups' and subtitle 'Discover recommended groups based on your preferences and activity'", async () => {
    renderPage();
    expect(screen.getAllByText('Browse Groups').length).toBeGreaterThan(0);
    expect(
      screen.getByText('Discover recommended groups based on your preferences and activity')
    ).toBeInTheDocument();
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

  it('refresh button reloads recommendations', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(mockFetchGroups).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole('button', { name: /refresh/i }));
    await waitFor(() => expect(mockFetchGroups).toHaveBeenCalledTimes(2));
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

  it("shows 'No recommendations yet' empty state when fetch returns empty array and no filters active", async () => {
    mockFetchGroups.mockResolvedValue([]);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('No recommendations yet')).toBeInTheDocument();
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

  it('loads more recommendations when the sentinel intersects', async () => {
    const observers: IntersectionObserverCallback[] = [];
    vi.stubGlobal(
      'IntersectionObserver',
      vi.fn((callback: IntersectionObserverCallback) => {
        observers.push(callback);
        return {
          observe: () => undefined,
          disconnect: () => undefined,
        } as unknown as IntersectionObserver;
      })
    );

    const manyGroups: PublicGroup[] = Array.from({ length: 12 }, (_, index) => ({
      id: `${index + 1}`,
      name: `Group ${index + 1}`,
      description: `Description ${index + 1}`,
      memberCount: index + 1,
      contributionAmount: 100 + index * 10,
      currency: 'XLM',
      status: 'active',
      createdAt: new Date('2024-01-01'),
    }));

    mockFetchGroups.mockResolvedValue(manyGroups);
    renderPage();

    // The discovery feed ranks by recommendation score (higher memberCount
    // scores higher), so with initialPageSize: 6 the first item shown is
    // "Group 12" (memberCount 12), not "Group 1".
    await waitFor(() => expect(screen.getByText('Group 12')).toBeInTheDocument(), {
      timeout: 3000,
    });
    expect(observers).toHaveLength(1);
    expect(screen.queryByText('Group 1')).not.toBeInTheDocument();

    act(() => {
      observers[0](
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
      );
    });

    // After loadMore, all 12 (including the lowest-ranked "Group 1") are visible.
    await waitFor(
      () => {
        expect(screen.getByText('Group 1')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it('aria-live region is present in the DOM', () => {
    renderPage();
    const liveRegion = document.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeInTheDocument();
  });

  it('route config contains GROUPS_BROWSE entry', () => {
    const entry = routeConfig.find((r) => r.path === ROUTES.GROUPS_BROWSE);
    expect(entry).toBeDefined();
    expect(entry?.path).toBe('/groups/browse');
  });
});
