/**
 * Tests for useGroupEvents (issue #2046 — unify toast/notification handling).
 *
 * Verifies that the hook subscribes to Soroban events and surfaces them via
 * the shared useNotification hook rather than calling the low-level
 * useToast context directly.
 */
import { renderHook } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { ToastProvider } from '../../components/Toast/ToastProvider';
import { useGroupEvents } from '../useGroupEvents';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockOn = vi.fn();
const mockTriggerRefresh = vi.fn();

vi.mock('../useEventService', () => ({
  useEventService: () => ({
    on: mockOn,
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    isWatching: false,
    service: {},
  }),
}));

vi.mock('../useEventTrigger', () => ({
  useEventTrigger: () => ({ triggerRefresh: mockTriggerRefresh }),
}));

// Spy on useNotification.notify to verify it is called (not useToast directly)
const mockNotify = vi.fn().mockReturnValue('toast-id');

vi.mock('../useNotification', () => ({
  useNotification: () => ({
    notify: mockNotify,
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    dismiss: vi.fn(),
    showNotification: vi.fn(),
    notifications: [],
    queue: [],
  }),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useGroupEvents (issue #2046)', () => {
  beforeEach(() => {
    mockOn.mockReset();
    mockTriggerRefresh.mockReset();
    mockNotify.mockReset();

    // Default: on() returns a no-op unsubscribe
    mockOn.mockReturnValue(() => undefined);
  });

  it('subscribes to ContributionMade, PayoutExecuted, and GroupPaused', () => {
    renderHook(() => useGroupEvents(), { wrapper });

    expect(mockOn).toHaveBeenCalledWith('ContributionMade', expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith('PayoutExecuted', expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith('GroupPaused', expect.any(Function));
  });

  it('calls notify (not useToast.showToast) with success type on ContributionMade', () => {
    let contributionCallback: ((event: unknown) => void) | undefined;
    mockOn.mockImplementation((eventType: string, cb: (event: unknown) => void) => {
      if (eventType === 'ContributionMade') {
        contributionCallback = cb;
      }
      return () => undefined;
    });

    renderHook(() => useGroupEvents(), { wrapper });
    expect(contributionCallback).toBeDefined();

    contributionCallback!({ type: 'ContributionMade', groupId: 42n, contributor: 'GXXX', amount: 100n });

    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success' })
    );
  });

  it('calls notify with info type on PayoutExecuted', () => {
    let payoutCallback: ((event: unknown) => void) | undefined;
    mockOn.mockImplementation((eventType: string, cb: (event: unknown) => void) => {
      if (eventType === 'PayoutExecuted') {
        payoutCallback = cb;
      }
      return () => undefined;
    });

    renderHook(() => useGroupEvents(), { wrapper });
    payoutCallback!({ type: 'PayoutExecuted', groupId: 7n, recipient: 'GABC', amount: 500n });

    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'info' })
    );
  });

  it('calls notify with warning type on GroupPaused', () => {
    let pausedCallback: ((event: unknown) => void) | undefined;
    mockOn.mockImplementation((eventType: string, cb: (event: unknown) => void) => {
      if (eventType === 'GroupPaused') {
        pausedCallback = cb;
      }
      return () => undefined;
    });

    renderHook(() => useGroupEvents(), { wrapper });
    pausedCallback!({ type: 'GroupPaused', groupId: 3n });

    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'warning' })
    );
  });

  it('triggers a cache refresh for the affected group on each event type', () => {
    const callbacks: Record<string, (event: unknown) => void> = {};
    mockOn.mockImplementation((eventType: string, cb: (event: unknown) => void) => {
      callbacks[eventType] = cb;
      return () => undefined;
    });

    renderHook(() => useGroupEvents(), { wrapper });

    callbacks['ContributionMade']({ type: 'ContributionMade', groupId: 1n, contributor: 'G', amount: 10n });
    callbacks['PayoutExecuted']({ type: 'PayoutExecuted', groupId: 2n, recipient: 'G', amount: 20n });
    callbacks['GroupPaused']({ type: 'GroupPaused', groupId: 3n });

    expect(mockTriggerRefresh).toHaveBeenCalledWith('1');
    expect(mockTriggerRefresh).toHaveBeenCalledWith('2');
    expect(mockTriggerRefresh).toHaveBeenCalledWith('3');
  });
});
