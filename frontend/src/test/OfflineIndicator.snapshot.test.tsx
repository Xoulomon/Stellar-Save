/**
 * Snapshot tests for OfflineIndicator
 *
 * Captures rendering state across connection/sync states to detect
 * unintended UI regressions.
 */
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { OfflineIndicator } from '../components/OfflineIndicator';

const mockUseSyncStatus = vi.fn();

vi.mock('../hooks/useOfflineSync', () => ({
  useSyncStatus: () => mockUseSyncStatus(),
}));

describe('OfflineIndicator snapshots', () => {
  it('renders nothing when online, idle, and queue is empty', () => {
    mockUseSyncStatus.mockReturnValue({
      connectionStatus: 'online',
      syncStatus: 'idle',
      queueCount: 0,
      lastSyncTime: null,
    });
    const { container } = render(<OfflineIndicator />);
    expect(container).toMatchSnapshot();
  });

  it('renders the offline-with-queue state', () => {
    mockUseSyncStatus.mockReturnValue({
      connectionStatus: 'offline',
      syncStatus: 'idle',
      queueCount: 3,
      lastSyncTime: new Date('2026-01-01T00:00:00Z'),
    });
    const { container } = render(<OfflineIndicator />);
    expect(container).toMatchSnapshot();
  });

  it('renders the syncing state', () => {
    mockUseSyncStatus.mockReturnValue({
      connectionStatus: 'online',
      syncStatus: 'syncing',
      queueCount: 1,
      lastSyncTime: null,
    });
    const { container } = render(<OfflineIndicator />);
    expect(container).toMatchSnapshot();
  });

  it('renders the sync error state', () => {
    mockUseSyncStatus.mockReturnValue({
      connectionStatus: 'online',
      syncStatus: 'error',
      queueCount: 0,
      lastSyncTime: null,
    });
    const { container } = render(<OfflineIndicator />);
    expect(container).toMatchSnapshot();
  });
});
