/**
 * ActivityFeed.test.tsx
 *
 * Tests for the ActivityFeed component and useActivityFeed hook.
 * Uses vitest + @testing-library/react.
 *
 * The EventService is mocked so tests run without a live Stellar RPC node.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { ActivityFeed } from './ActivityFeed';
import type { AppEvent } from '../../types/events';

// ─── Mock EventService ────────────────────────────────────────────────────────

// vi.mock is hoisted to the top of the file by vitest, so we must use
// vi.hoisted() to declare variables that are referenced inside the factory.
const { mockFetchEvents, mockStartWatching, mockOn, mockServiceInstance } =
  vi.hoisted(() => {
    const listeners: Array<{ type: string; cb: (e: AppEvent) => void }> = [];

    const mockFetchEvents = vi.fn();
    const mockStartWatching = vi.fn(() => Promise.resolve(undefined));
    const mockOn = vi.fn();

    const mockServiceInstance = {
      fetchEvents: mockFetchEvents,
      startWatching: mockStartWatching,
      stopWatching: vi.fn(),
      isWatching: false,
      on: (type: string, cb: (e: AppEvent) => void) => {
        listeners.push({ type, cb });
        mockOn(type, cb);
        return () => {
          const idx = listeners.findIndex((l) => l.cb === cb);
          if (idx !== -1) listeners.splice(idx, 1);
        };
      },
      _emit: (event: AppEvent) => {
        for (const l of listeners) {
          if (l.type === 'all' || l.type === event.type) l.cb(event);
        }
      },
      _clearListeners: () => {
        listeners.length = 0;
      },
    };

    return { mockFetchEvents, mockStartWatching, mockOn, mockServiceInstance };
  });

vi.mock('../../lib/EventService', () => ({
  EventService: {
    getInstance: () => mockServiceInstance,
  },
  eventService: mockServiceInstance,
  PAGE_SIZE: 20,
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makeContribution = (overrides: Partial<AppEvent> = {}): AppEvent => ({
  type: 'ContributionMade',
  groupId: 1n,
  contributor: 'GABC1234567890ABCDEF',
  amount: 10_000_000n, // 1 XLM
  cycle: 1,
  cycleTotal: 10_000_000n,
  contributedAt: BigInt(Math.floor(Date.now() / 1000) - 60),
  ...overrides,
} as AppEvent);

const makePayout = (overrides: Partial<AppEvent> = {}): AppEvent => ({
  type: 'PayoutExecuted',
  groupId: 1n,
  recipient: 'GXYZ9876543210FEDCBA',
  amount: 100_000_000n, // 10 XLM
  cycle: 1,
  executedAt: BigInt(Math.floor(Date.now() / 1000) - 120),
  ...overrides,
} as AppEvent);

const makeMemberJoin = (overrides: Partial<AppEvent> = {}): AppEvent => ({
  type: 'MemberJoined',
  groupId: 1n,
  member: 'GJOIN123456789ABCDEF',
  memberCount: 3,
  joinedAt: BigInt(Math.floor(Date.now() / 1000) - 180),
  ...overrides,
} as AppEvent);

const makeGroupCreated = (overrides: Partial<AppEvent> = {}): AppEvent => ({
  type: 'GroupCreated',
  groupId: 2n,
  creator: 'GCREATOR123456789AB',
  contributionAmount: 10_000_000n,
  cycleDuration: 604800n,
  maxMembers: 10,
  createdAt: BigInt(Math.floor(Date.now() / 1000) - 300),
  ...overrides,
} as AppEvent);

const emptyResult = { events: [], nextCursor: null, hasMore: false };

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ActivityFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchEvents.mockResolvedValue(emptyResult);

    // jsdom doesn't implement IntersectionObserver — stub it globally
    vi.stubGlobal('IntersectionObserver', vi.fn(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    })));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Rendering ──────────────────────────────────────────────────────────────

  it('renders the section with accessible label', async () => {
    render(<ActivityFeed />);
    expect(screen.getByRole('region', { name: /activity feed/i })).toBeInTheDocument();
  });

  it('shows skeleton loaders while fetching', () => {
    // fetchEvents never resolves during this test
    mockFetchEvents.mockReturnValue(new Promise(() => {}));
    render(<ActivityFeed />);
    // aria-hidden skeletons are present; the feed list is loading
    expect(screen.getByRole('feed', { hidden: true })).toHaveAttribute('aria-busy', 'true');
  });

  it('shows empty state when there are no events', async () => {
    mockFetchEvents.mockResolvedValue(emptyResult);
    render(<ActivityFeed />);
    await waitFor(() => {
      expect(screen.getByText(/no activity yet/i)).toBeInTheDocument();
    });
  });

  it('renders contribution events', async () => {
    mockFetchEvents.mockResolvedValue({
      events: [makeContribution()],
      nextCursor: null,
      hasMore: false,
    });

    render(<ActivityFeed />);

    await waitFor(() => {
      expect(screen.getByText(/contributed/i)).toBeInTheDocument();
    });
    expect(screen.getByText((t) => t.includes('1 XLM'))).toBeInTheDocument();
  });

  it('renders payout events', async () => {
    mockFetchEvents.mockResolvedValue({
      events: [makePayout()],
      nextCursor: null,
      hasMore: false,
    });

    render(<ActivityFeed />);

    await waitFor(() => {
      expect(screen.getByText(/received payout/i)).toBeInTheDocument();
    });
    expect(screen.getByText((t) => t.includes('10 XLM'))).toBeInTheDocument();
  });

  it('renders member join events', async () => {
    mockFetchEvents.mockResolvedValue({
      events: [makeMemberJoin()],
      nextCursor: null,
      hasMore: false,
    });

    render(<ActivityFeed />);

    await waitFor(() => {
      expect(screen.getByText(/joined/i)).toBeInTheDocument();
    });
    expect(screen.getByText((t) => t.includes('3 members total'))).toBeInTheDocument();
  });

  it('renders group created events', async () => {
    mockFetchEvents.mockResolvedValue({
      events: [makeGroupCreated()],
      nextCursor: null,
      hasMore: false,
    });

    render(<ActivityFeed />);

    await waitFor(() => {
      expect(screen.getByText(/group #2 created/i)).toBeInTheDocument();
    });
  });

  // ── Filtering ──────────────────────────────────────────────────────────────

  it('renders filter buttons', async () => {
    render(<ActivityFeed showFilters />);
    expect(screen.getByRole('button', { name: /all/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /contributions/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /payouts/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /members/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /groups/i })).toBeInTheDocument();
  });

  it('"All" filter is active by default', async () => {
    render(<ActivityFeed showFilters />);
    const allBtn = screen.getByRole('button', { name: /all/i });
    expect(allBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('activates the selected filter button', async () => {
    mockFetchEvents.mockResolvedValue(emptyResult);
    render(<ActivityFeed showFilters />);

    const contributionsBtn = screen.getByRole('button', { name: /contributions/i });
    fireEvent.click(contributionsBtn);

    await waitFor(() => {
      expect(contributionsBtn).toHaveAttribute('aria-pressed', 'true');
    });
    expect(screen.getByRole('button', { name: /all/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('re-fetches with the correct type filter when filter changes', async () => {
    mockFetchEvents.mockResolvedValue(emptyResult);
    render(<ActivityFeed showFilters />);

    await waitFor(() => expect(mockFetchEvents).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: /payouts/i }));

    await waitFor(() => expect(mockFetchEvents).toHaveBeenCalledTimes(2));

    const lastCall = mockFetchEvents.mock.calls[1][0] as { types?: string[] };
    expect(lastCall.types).toEqual(['PayoutExecuted']);
  });

  it('hides filter toolbar when showFilters=false', () => {
    render(<ActivityFeed showFilters={false} />);
    expect(screen.queryByRole('group', { name: /filter by activity type/i })).not.toBeInTheDocument();
  });

  // ── Refresh ────────────────────────────────────────────────────────────────

  it('calls fetchEvents again when refresh button is clicked', async () => {
    mockFetchEvents.mockResolvedValue(emptyResult);
    render(<ActivityFeed showRefresh />);

    await waitFor(() => expect(mockFetchEvents).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: /refresh activity feed/i }));

    await waitFor(() => expect(mockFetchEvents).toHaveBeenCalledTimes(2));
  });

  it('hides refresh button when showRefresh=false', () => {
    render(<ActivityFeed showRefresh={false} />);
    expect(screen.queryByRole('button', { name: /refresh/i })).not.toBeInTheDocument();
  });

  // ── Error state ────────────────────────────────────────────────────────────

  it('shows an error banner when fetch fails', async () => {
    mockFetchEvents.mockRejectedValue(new Error('Network error'));
    render(<ActivityFeed />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByText(/network error/i)).toBeInTheDocument();
  });

  it('retries fetch when Retry button is clicked', async () => {
    mockFetchEvents
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValue(emptyResult);

    render(<ActivityFeed />);

    await waitFor(() => screen.getByRole('alert'));

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  // ── Live updates ───────────────────────────────────────────────────────────

  it('prepends live events to the feed', async () => {
    mockFetchEvents.mockResolvedValue(emptyResult);

    const { unmount } = render(<ActivityFeed />);

    await waitFor(() => screen.getByText(/no activity yet/i));

    // Simulate a live event arriving via the mock service
    act(() => {
      mockServiceInstance._emit(makeContribution());
    });

    await waitFor(() => {
      expect(screen.getByText(/contributed/i)).toBeInTheDocument();
    });

    unmount();
  });

  it('deduplicates live events that are already in the list', async () => {
    const contribution = makeContribution();
    mockFetchEvents.mockResolvedValue({
      events: [contribution],
      nextCursor: null,
      hasMore: false,
    });

    render(<ActivityFeed />);
    await waitFor(() => screen.getByText(/contributed/i));

    act(() => {
      mockServiceInstance._emit(contribution); // same event again
    });

    await waitFor(() => {
      // Should still only have one "contributed" title span
      const items = screen.getAllByText(/contributed/i);
      expect(items).toHaveLength(1);
    });
  });

  // ── Infinite scroll ────────────────────────────────────────────────────────

  it('shows "All caught up" when hasMore is false and items exist', async () => {
    mockFetchEvents.mockResolvedValue({
      events: [makeContribution()],
      nextCursor: null,
      hasMore: false,
    });

    render(<ActivityFeed />);

    await waitFor(() => {
      expect(screen.getByText(/all caught up/i)).toBeInTheDocument();
    });
  });

  it('calls loadMore when sentinel intersects', async () => {
    // mockFetchEvents is called by:
    // 1. Initial load (returns contribution + hasMore: true)
    // 2. loadMore triggered by IO intersection
    mockFetchEvents
      .mockResolvedValueOnce({
        events: [makeContribution({ contributedAt: BigInt(Math.floor(Date.now() / 1000) - 60) })],
        nextCursor: 'cursor-1',
        hasMore: true,
      })
      .mockResolvedValueOnce({
        events: [makePayout()],
        nextCursor: null,
        hasMore: false,
      });

    // Capture the latest IO callback via an array
    const callbacks: IntersectionObserverCallback[] = [];
    vi.stubGlobal('IntersectionObserver', vi.fn((cb: IntersectionObserverCallback) => {
      callbacks.push(cb);
      return {
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
      };
    }));

    render(<ActivityFeed />);

    // Wait for first page to render
    await waitFor(() => screen.getByText(/contributed/i));

    // Fire the most recent IO callback
    const latestCb = callbacks[callbacks.length - 1];
    await act(async () => {
      latestCb?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    });

    await waitFor(() => {
      // initial + loadMore = 2 total calls
      expect(mockFetchEvents).toHaveBeenCalledTimes(2);
    });
  });

  // ── groupId scoping ────────────────────────────────────────────────────────

  it('passes groupId to fetchEvents', async () => {
    mockFetchEvents.mockResolvedValue(emptyResult);
    render(<ActivityFeed groupId={42n} />);

    await waitFor(() => expect(mockFetchEvents).toHaveBeenCalled());

    const call = mockFetchEvents.mock.calls[0][0] as { groupId?: bigint };
    expect(call.groupId).toBe(42n);
  });

  // ── Timestamps ────────────────────────────────────────────────────────────

  it('renders a <time> element with ISO dateTime attribute', async () => {
    mockFetchEvents.mockResolvedValue({
      events: [makeContribution()],
      nextCursor: null,
      hasMore: false,
    });

    render(<ActivityFeed />);

    await waitFor(() => screen.getByText(/contributed/i));

    const timeEl = document.querySelector('time');
    expect(timeEl).not.toBeNull();
    expect(timeEl?.getAttribute('dateTime')).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
