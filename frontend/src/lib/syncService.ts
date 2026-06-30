/**
 * syncService.ts — Handles offline/online sync and queue management
 * 
 * Manages:
 * - Online/offline detection
 * - Background sync on foreground and interval
 * - Queue replay on reconnection
 * - Optimistic local updates
 */

import {
  addToSyncQueue,
  cacheGroup,
  cacheGroupsList,
  cacheContributions,
  cacheMembers,
  getCachedGroup,
  getCachedGroupsList,
  getPendingSyncItems,
  getSyncMetadata,
  initDB,
  markGroupsAsStale,
  removeSyncQueueItem,
  updateSyncMetadata,
  updateSyncQueueItem,
  type SyncQueueItem,
} from './db';
import { fetchGroup, fetchGroups, type DetailedGroup } from '../utils/groupApi';
import type { PublicGroup } from '../types/group';

const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes
const STALE_THRESHOLD = 2 * 60 * 1000; // 2 minutes

export type SyncStatus = 'idle' | 'syncing' | 'error';
export type ConnectionStatus = 'online' | 'offline' | 'unknown';

let syncIntervalId: number | null = null;
let isCurrentlySyncing = false;

// Callbacks for status updates
const statusCallbacks: Set<(status: SyncStatus) => void> = new Set();
const connectionCallbacks: Set<(status: ConnectionStatus) => void> = new Set();

/**
 * Initialize the sync service
 */
export async function initSyncService(): Promise<void> {
  await initDB();

  // Set up online/offline listeners
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Initial connection status
  const isOnline = navigator.onLine;
  await updateSyncMetadata({ isOnline });
  notifyConnectionStatus(isOnline ? 'online' : 'offline');

  // Start periodic sync if online
  if (isOnline) {
    startPeriodicSync();
  }

  // Sync on visibility change (tab comes to foreground)
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

/**
 * Stop the sync service
 */
export function stopSyncService(): void {
  window.removeEventListener('online', handleOnline);
  window.removeEventListener('offline', handleOffline);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  stopPeriodicSync();
}

// ─── Connection Status Handlers ───────────────────────────────────────────────

async function handleOnline(): Promise<void> {
  console.log('[SyncService] Connection restored');
  await updateSyncMetadata({ isOnline: true });
  notifyConnectionStatus('online');
  
  // Trigger sync immediately
  void syncAll();
  
  // Start periodic sync
  startPeriodicSync();
}

async function handleOffline(): Promise<void> {
  console.log('[SyncService] Connection lost');
  await updateSyncMetadata({ isOnline: false });
  notifyConnectionStatus('offline');
  
  // Mark cached data as potentially stale
  await markGroupsAsStale();
  
  // Stop periodic sync
  stopPeriodicSync();
}

async function handleVisibilityChange(): Promise<void> {
  if (document.visibilityState === 'visible' && navigator.onLine) {
    console.log('[SyncService] App came to foreground, syncing...');
    void syncAll();
  }
}

// ─── Periodic Sync ────────────────────────────────────────────────────────────

function startPeriodicSync(): void {
  if (syncIntervalId !== null) return;
  
  syncIntervalId = window.setInterval(() => {
    if (navigator.onLine) {
      void syncAll();
    }
  }, SYNC_INTERVAL);
}

function stopPeriodicSync(): void {
  if (syncIntervalId !== null) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
  }
}

// ─── Main Sync Logic ──────────────────────────────────────────────────────────

/**
 * Sync all data: replay queue, refresh cached data
 */
export async function syncAll(): Promise<void> {
  if (isCurrentlySyncing) {
    console.log('[SyncService] Sync already in progress, skipping');
    return;
  }

  if (!navigator.onLine) {
    console.log('[SyncService] Offline, skipping sync');
    return;
  }

  isCurrentlySyncing = true;
  notifySyncStatus('syncing');

  try {
    // 1. Replay queued actions
    await replayQueue();

    // 2. Refresh cached data
    await refreshCache();

    // 3. Update metadata
    await updateSyncMetadata({ lastSync: new Date(), isOnline: true });

    notifySyncStatus('idle');
    console.log('[SyncService] Sync completed successfully');
  } catch (error) {
    console.error('[SyncService] Sync failed:', error);
    notifySyncStatus('error');
  } finally {
    isCurrentlySyncing = false;
  }
}

/**
 * Replay queued offline actions
 */
async function replayQueue(): Promise<void> {
  const queue = await getPendingSyncItems();
  
  if (queue.length === 0) {
    console.log('[SyncService] No queued actions to replay');
    return;
  }

  console.log(`[SyncService] Replaying ${queue.length} queued actions`);

  for (const item of queue) {
    try {
      await updateSyncQueueItem(item.id, { status: 'processing' });
      await executeQueuedAction(item);
      await removeSyncQueueItem(item.id);
      console.log(`[SyncService] Successfully executed queued action: ${item.type}`);
    } catch (error) {
      console.error(`[SyncService] Failed to execute queued action: ${item.type}`, error);
      const retryCount = item.retryCount + 1;
      const maxRetries = 3;

      if (retryCount >= maxRetries) {
        await updateSyncQueueItem(item.id, {
          status: 'failed',
          retryCount,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      } else {
        await updateSyncQueueItem(item.id, {
          status: 'pending',
          retryCount,
        });
      }
    }
  }
}

/**
 * Execute a queued action
 */
async function executeQueuedAction(item: SyncQueueItem): Promise<void> {
  switch (item.type) {
    case 'contribution':
      // TODO: Call actual contract method when integrated
      console.log('[SyncService] Executing contribution:', item.payload);
      await new Promise((resolve) => setTimeout(resolve, 500));
      break;
    case 'join_group':
      // TODO: Call actual contract method when integrated
      console.log('[SyncService] Executing join_group:', item.payload);
      await new Promise((resolve) => setTimeout(resolve, 500));
      break;
    case 'create_group':
      // TODO: Call actual contract method when integrated
      console.log('[SyncService] Executing create_group:', item.payload);
      await new Promise((resolve) => setTimeout(resolve, 500));
      break;
    case 'update_group':
      // TODO: Call actual contract method when integrated
      console.log('[SyncService] Executing update_group:', item.payload);
      await new Promise((resolve) => setTimeout(resolve, 500));
      break;
    default:
      console.warn(`[SyncService] Unknown action type: ${(item as SyncQueueItem).type}`);
  }
}

/**
 * Refresh cached data from the network
 */
async function refreshCache(): Promise<void> {
  try {
    // Refresh groups list
    const groupsList = await fetchGroups();
    await cacheGroupsList(groupsList);
    console.log('[SyncService] Refreshed groups list cache');

    // Refresh individual groups that are in cache
    const cachedGroupsList = await getCachedGroupsList();
    if (cachedGroupsList && cachedGroupsList.groups.length > 0) {
      // Only refresh first 10 groups to avoid overloading
      const groupsToRefresh = cachedGroupsList.groups.slice(0, 10);
      
      for (const group of groupsToRefresh) {
        try {
          const detailedGroup = await fetchGroup(group.id);
          if (detailedGroup) {
            await cacheGroup(detailedGroup);
            await cacheMembers(group.id, detailedGroup.members);
            await cacheContributions(group.id, detailedGroup.contributions);
          }
        } catch (error) {
          console.error(`[SyncService] Failed to refresh group ${group.id}:`, error);
        }
      }
      console.log(`[SyncService] Refreshed ${groupsToRefresh.length} group details`);
    }
  } catch (error) {
    console.error('[SyncService] Failed to refresh cache:', error);
    throw error;
  }
}

// ─── Queue Management API ─────────────────────────────────────────────────────

/**
 * Queue an action for later execution (when offline)
 */
export async function queueAction(
  type: SyncQueueItem['type'],
  payload: unknown
): Promise<string> {
  const id = await addToSyncQueue({
    type,
    payload,
    timestamp: new Date(),
    retryCount: 0,
    status: 'pending',
  });
  
  console.log(`[SyncService] Queued action: ${type} (id: ${id})`);
  
  // Try to sync immediately if online
  if (navigator.onLine) {
    void syncAll();
  }
  
  return id;
}

// ─── Cache Helpers ────────────────────────────────────────────────────────────

/**
 * Get cached data with staleness check
 */
export async function getCachedGroupWithStatus(
  groupId: string
): Promise<{ group: DetailedGroup | null; isStale: boolean; fromCache: boolean }> {
  const cached = await getCachedGroup(groupId);
  
  if (!cached) {
    return { group: null, isStale: false, fromCache: false };
  }

  const age = Date.now() - cached.timestamp.getTime();
  const isStale = cached.stale || age > STALE_THRESHOLD;

  return { group: cached.group, isStale, fromCache: true };
}

/**
 * Get cached groups list with staleness check
 */
export async function getCachedGroupsListWithStatus(): Promise<{
  groups: PublicGroup[];
  isStale: boolean;
  fromCache: boolean;
}> {
  const cached = await getCachedGroupsList();
  
  if (!cached) {
    return { groups: [], isStale: false, fromCache: false };
  }

  const age = Date.now() - cached.timestamp.getTime();
  const isStale = cached.stale || age > STALE_THRESHOLD;

  return { groups: cached.groups, isStale, fromCache: true };
}

// ─── Status Subscriptions ─────────────────────────────────────────────────────

export function onSyncStatusChange(callback: (status: SyncStatus) => void): () => void {
  statusCallbacks.add(callback);
  return () => statusCallbacks.delete(callback);
}

export function onConnectionStatusChange(callback: (status: ConnectionStatus) => void): () => void {
  connectionCallbacks.add(callback);
  return () => connectionCallbacks.delete(callback);
}

function notifySyncStatus(status: SyncStatus): void {
  statusCallbacks.forEach((callback) => callback(status));
}

function notifyConnectionStatus(status: ConnectionStatus): void {
  connectionCallbacks.forEach((callback) => callback(status));
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Get current connection status
 */
export async function getConnectionStatus(): Promise<ConnectionStatus> {
  const metadata = await getSyncMetadata();
  if (!metadata) return 'unknown';
  return metadata.isOnline ? 'online' : 'offline';
}

/**
 * Get last sync timestamp
 */
export async function getLastSyncTime(): Promise<Date | null> {
  const metadata = await getSyncMetadata();
  return metadata?.lastSync ?? null;
}

/**
 * Force a manual sync
 */
export async function forceSyncNow(): Promise<void> {
  console.log('[SyncService] Manual sync triggered');
  await syncAll();
}
