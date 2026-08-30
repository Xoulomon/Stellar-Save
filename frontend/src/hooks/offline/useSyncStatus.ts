import { useEffect, useState, useCallback } from 'react';

import { getSyncQueueCount } from '../../lib/db';
import {
  syncAll,
  onSyncStatusChange,
  onConnectionStatusChange,
  getConnectionStatus,
  getLastSyncTime,
  type SyncStatus,
  type ConnectionStatus,
} from '../../lib/syncService';

/**
 * Hook to monitor sync status
 */
export function useSyncStatus(): {
  syncStatus: SyncStatus;
  connectionStatus: ConnectionStatus;
  queueCount: number;
  lastSyncTime: Date | null;
  triggerSync: () => Promise<void>;
} {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('unknown');
  const [queueCount, setQueueCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Subscribe to status changes
  useEffect(() => {
    const unsubSync = onSyncStatusChange(setSyncStatus);
    const unsubConnection = onConnectionStatusChange(setConnectionStatus);

    // Get initial status
    void (async () => {
      const connStatus = await getConnectionStatus();
      setConnectionStatus(connStatus);
      const lastSync = await getLastSyncTime();
      setLastSyncTime(lastSync);
      const count = await getSyncQueueCount();
      setQueueCount(count);
    })();

    // Poll queue count periodically
    const intervalId = setInterval(async () => {
      const count = await getSyncQueueCount();
      setQueueCount(count);
      const lastSync = await getLastSyncTime();
      setLastSyncTime(lastSync);
    }, 5000);

    return () => {
      unsubSync();
      unsubConnection();
      clearInterval(intervalId);
    };
  }, []);

  const triggerSync = useCallback(async () => {
    await syncAll();
    const count = await getSyncQueueCount();
    setQueueCount(count);
  }, []);

  return {
    syncStatus,
    connectionStatus,
    queueCount,
    lastSyncTime,
    triggerSync,
  };
}
