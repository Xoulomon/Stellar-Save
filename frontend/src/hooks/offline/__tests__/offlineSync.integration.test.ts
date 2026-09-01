import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { useQueueAction } from '../useQueueAction';
import { useSyncStatus } from '../useSyncStatus';

import type { ConnectionStatus, SyncStatus } from '../../../lib/syncService';

// In-memory fake queue shared between the mocked syncService and db modules,
// so queueing via useQueueAction and flushing via useSyncStatus exercise the
// same underlying "storage" the way they would against real IndexedDB.
let queue: string[] = [];
let syncStatusCallback: ((status: SyncStatus) => void) | null = null;

vi.mock('../../../lib/syncService', () => ({
  queueAction: vi.fn(async (type: string) => {
    const id = `${type}_${queue.length + 1}`;
    queue.push(id);
    return id;
  }),
  syncAll: vi.fn(async () => {
    syncStatusCallback?.('syncing');
    queue = [];
    syncStatusCallback?.('idle');
  }),
  onSyncStatusChange: vi.fn((cb: (s: SyncStatus) => void) => {
    syncStatusCallback = cb;
    return () => {
      syncStatusCallback = null;
    };
  }),
  onConnectionStatusChange: vi.fn((cb: (s: ConnectionStatus) => void) => {
    return () => {
      void cb;
    };
  }),
  getConnectionStatus: vi.fn(async (): Promise<ConnectionStatus> => 'online'),
  getLastSyncTime: vi.fn(async (): Promise<Date | null> => null),
}));

vi.mock('../../../lib/db', () => ({
  getSyncQueueCount: vi.fn(async () => queue.length),
}));

describe('offline hooks integration: queue then flush', () => {
  beforeEach(() => {
    queue = [];
    vi.clearAllMocks();
  });

  it('reflects a queued action in queueCount, then clears it once triggerSync flushes', async () => {
    const { result: queueApi } = renderHook(() => useQueueAction());
    const { result: status } = renderHook(() => useSyncStatus());

    await waitFor(() => expect(status.current.queueCount).toBe(0));

    await act(async () => {
      await queueApi.current.queueContribution('group-1', 50);
    });
    expect(queue).toHaveLength(1);

    await act(async () => {
      await status.current.triggerSync();
    });

    expect(queue).toHaveLength(0);
    expect(status.current.queueCount).toBe(0);
    expect(status.current.syncStatus).toBe('idle');
  });

  it('accumulates multiple queued actions before a flush, then drains them all', async () => {
    const { result: queueApi } = renderHook(() => useQueueAction());
    const { result: status } = renderHook(() => useSyncStatus());

    await waitFor(() => expect(status.current.queueCount).toBe(0));

    await act(async () => {
      await queueApi.current.queueContribution('group-1', 10);
      await queueApi.current.queueJoinGroup('group-2');
    });
    expect(queue).toHaveLength(2);

    await act(async () => {
      await status.current.triggerSync();
    });

    expect(queue).toHaveLength(0);
    expect(status.current.queueCount).toBe(0);
  });
});
