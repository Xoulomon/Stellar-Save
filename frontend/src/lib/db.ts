/**
 * db.ts — IndexedDB wrapper for offline storage
 * 
 * Stores groups, members, contributions, and sync queue for offline-first functionality
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { PublicGroup } from '../types/group';
import type { DetailedGroup, GroupContribution, GroupMember } from '../utils/groupApi';

const DB_NAME = 'stellar-save-offline';
const DB_VERSION = 1;

export interface SyncQueueItem {
  id: string;
  type: 'contribution' | 'join_group' | 'create_group' | 'update_group';
  payload: unknown;
  timestamp: Date;
  retryCount: number;
  status: 'pending' | 'processing' | 'failed';
  error?: string;
}

export interface CachedGroup {
  group: DetailedGroup;
  timestamp: Date;
  stale: boolean;
}

export interface CachedGroupsList {
  groups: PublicGroup[];
  timestamp: Date;
  stale: boolean;
}

export interface DBSchema {
  groups: {
    key: string;
    value: CachedGroup;
  };
  groupsList: {
    key: string;
    value: CachedGroupsList;
  };
  members: {
    key: string;
    value: { groupId: string; members: GroupMember[]; timestamp: Date };
    indexes: { groupId: string };
  };
  contributions: {
    key: string;
    value: { groupId: string; contributions: GroupContribution[]; timestamp: Date };
    indexes: { groupId: string };
  };
  syncQueue: {
    key: string;
    value: SyncQueueItem;
    indexes: { status: string; timestamp: Date };
  };
  metadata: {
    key: string;
    value: { lastSync: Date; isOnline: boolean };
  };
}

let dbInstance: IDBPDatabase<DBSchema> | null = null;

/**
 * Initialize IndexedDB with schema
 */
export async function initDB(): Promise<IDBPDatabase<DBSchema>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<DBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Groups store - detailed group data
      if (!db.objectStoreNames.contains('groups')) {
        db.createObjectStore('groups', { keyPath: 'group.id' });
      }

      // Groups list store - list view of all groups
      if (!db.objectStoreNames.contains('groupsList')) {
        db.createObjectStore('groupsList');
      }

      // Members store with groupId index
      if (!db.objectStoreNames.contains('members')) {
        const membersStore = db.createObjectStore('members', { keyPath: 'groupId' });
        membersStore.createIndex('groupId', 'groupId');
      }

      // Contributions store with groupId index
      if (!db.objectStoreNames.contains('contributions')) {
        const contribStore = db.createObjectStore('contributions', { keyPath: 'groupId' });
        contribStore.createIndex('groupId', 'groupId');
      }

      // Sync queue for offline actions
      if (!db.objectStoreNames.contains('syncQueue')) {
        const queueStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
        queueStore.createIndex('status', 'status');
        queueStore.createIndex('timestamp', 'timestamp');
      }

      // Metadata store for sync status
      if (!db.objectStoreNames.contains('metadata')) {
        db.createObjectStore('metadata');
      }
    },
  });

  return dbInstance;
}

/**
 * Get the database instance
 */
export async function getDB(): Promise<IDBPDatabase<DBSchema>> {
  if (!dbInstance) {
    return await initDB();
  }
  return dbInstance;
}

// ─── Groups Operations ────────────────────────────────────────────────────────

export async function cacheGroup(group: DetailedGroup): Promise<void> {
  const db = await getDB();
  await db.put('groups', {
    group,
    timestamp: new Date(),
    stale: false,
  });
}

export async function getCachedGroup(groupId: string): Promise<CachedGroup | null> {
  const db = await getDB();
  const cached = await db.get('groups', groupId);
  return cached ?? null;
}

export async function cacheGroupsList(groups: PublicGroup[]): Promise<void> {
  const db = await getDB();
  await db.put('groupsList', {
    groups,
    timestamp: new Date(),
    stale: false,
  }, 'all');
}

export async function getCachedGroupsList(): Promise<CachedGroupsList | null> {
  const db = await getDB();
  const cached = await db.get('groupsList', 'all');
  return cached ?? null;
}

export async function markGroupsAsStale(): Promise<void> {
  const db = await getDB();
  
  // Mark all groups as stale
  const allGroups = await db.getAll('groups');
  for (const cached of allGroups) {
    cached.stale = true;
    await db.put('groups', cached);
  }

  // Mark groups list as stale
  const groupsList = await db.get('groupsList', 'all');
  if (groupsList) {
    groupsList.stale = true;
    await db.put('groupsList', groupsList, 'all');
  }
}

// ─── Members Operations ───────────────────────────────────────────────────────

export async function cacheMembers(groupId: string, members: GroupMember[]): Promise<void> {
  const db = await getDB();
  await db.put('members', {
    groupId,
    members,
    timestamp: new Date(),
  });
}

export async function getCachedMembers(groupId: string): Promise<GroupMember[] | null> {
  const db = await getDB();
  const cached = await db.get('members', groupId);
  return cached?.members ?? null;
}

// ─── Contributions Operations ─────────────────────────────────────────────────

export async function cacheContributions(
  groupId: string,
  contributions: GroupContribution[]
): Promise<void> {
  const db = await getDB();
  await db.put('contributions', {
    groupId,
    contributions,
    timestamp: new Date(),
  });
}

export async function getCachedContributions(groupId: string): Promise<GroupContribution[] | null> {
  const db = await getDB();
  const cached = await db.get('contributions', groupId);
  return cached?.contributions ?? null;
}

// ─── Sync Queue Operations ────────────────────────────────────────────────────

export async function addToSyncQueue(item: Omit<SyncQueueItem, 'id'>): Promise<string> {
  const db = await getDB();
  const id = `${item.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const queueItem: SyncQueueItem = { ...item, id };
  await db.add('syncQueue', queueItem);
  return id;
}

export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  const db = await getDB();
  const allItems = await db.getAllFromIndex('syncQueue', 'status', 'pending');
  return allItems.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

export async function updateSyncQueueItem(id: string, updates: Partial<SyncQueueItem>): Promise<void> {
  const db = await getDB();
  const item = await db.get('syncQueue', id);
  if (item) {
    await db.put('syncQueue', { ...item, ...updates });
  }
}

export async function removeSyncQueueItem(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('syncQueue', id);
}

export async function getSyncQueueCount(): Promise<number> {
  const db = await getDB();
  const pending = await db.getAllFromIndex('syncQueue', 'status', 'pending');
  return pending.length;
}

// ─── Metadata Operations ──────────────────────────────────────────────────────

export async function updateSyncMetadata(data: { lastSync?: Date; isOnline?: boolean }): Promise<void> {
  const db = await getDB();
  const current = (await db.get('metadata', 'sync')) ?? { lastSync: new Date(), isOnline: true };
  await db.put('metadata', { ...current, ...data }, 'sync');
}

export async function getSyncMetadata(): Promise<{ lastSync: Date; isOnline: boolean } | null> {
  const db = await getDB();
  const metadata = await db.get('metadata', 'sync');
  return metadata ?? null;
}

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
  const isStale = cached.stale || age > 120000; // 2 minutes

  return { groups: cached.groups, isStale, fromCache: true };
}

export async function clearAllCache(): Promise<void> {
  const db = await getDB();
  await db.clear('groups');
  await db.clear('groupsList');
  await db.clear('members');
  await db.clear('contributions');
}

export async function clearSyncQueue(): Promise<void> {
  const db = await getDB();
  await db.clear('syncQueue');
}
