/**
 * useOfflineSync.ts — React hooks for offline-first functionality
 */

import { useEffect, useState, useCallback } from 'react';
import {
  initSyncService,
  stopSyncService,
  syncAll,
  onSyncStatusChange,
  onConnectionStatusChange,
  getConnectionStatus,
  getLastSyncTime,
  queueAction,
  type SyncStatus,
  type ConnectionStatus,
} from '../lib/syncService';
import { getSyncQueueCount } from '../lib/db';

/**
 * Initialize offline sync service on app mount
 */
export function useOfflineSyncInit(): void {
  useEffect(() => {
    console.log('[useOfflineSync] Initializing sync service');
    void initSyncService();

    return () => {
      console.log('[useOfflineSync] Stopping sync service');
      stopSyncService();
    };
  }, []);
}

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

/**
 * Hook to check if app is online
 */
export function useIsOnline(): boolean {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

/**
 * Hook to queue an action when offline
 */
export function useQueueAction(): {
  queueContribution: (groupId: string, amount: number) => Promise<string>;
  queueJoinGroup: (groupId: string) => Promise<string>;
  queueCreateGroup: (groupData: unknown) => Promise<string>;
} {
  const queueContribution = useCallback(async (groupId: string, amount: number) => {
    return await queueAction('contribution', { groupId, amount, timestamp: new Date() });
  }, []);

  const queueJoinGroup = useCallback(async (groupId: string) => {
    return await queueAction('join_group', { groupId, timestamp: new Date() });
  }, []);

  const queueCreateGroup = useCallback(async (groupData: unknown) => {
    return await queueAction('create_group', { data: groupData, timestamp: new Date() });
  }, []);

  return {
    queueContribution,
    queueJoinGroup,
    queueCreateGroup,
  };
}
