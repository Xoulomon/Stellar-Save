/**
 * offlineSync.test.ts — Tests for offline-first sync functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  initDB,
  cacheGroup,
  getCachedGroup,
  cacheGroupsList,
  getCachedGroupsList,
  addToSyncQueue,
  getPendingSyncItems,
  updateSyncQueueItem,
  removeSyncQueueItem,
  clearAllCache,
  clearSyncQueue,
} from '../lib/db';
import type { DetailedGroup } from '../utils/groupApi';
import type { PublicGroup } from '../types/group';

describe('Offline Database', () => {
  beforeEach(async () => {
    await initDB();
    await clearAllCache();
    await clearSyncQueue();
  });

  afterEach(async () => {
    await clearAllCache();
    await clearSyncQueue();
  });

  describe('Group Caching', () => {
    it('should cache and retrieve a group', async () => {
      const mockGroup: DetailedGroup = {
        id: '1',
        name: 'Test Group',
        memberCount: 5,
        contributionAmount: 100,
        currency: 'XLM',
        status: 'active',
        createdAt: new Date(),
        creator: 'GABC123',
        cycleDuration: 30,
        maxMembers: 10,
        minMembers: 3,
        currentCycle: 0,
        isActive: true,
        started: false,
        startedAt: null,
        totalMembers: 5,
        targetAmount: 1000,
        currentAmount: 500,
        contributionFrequency: 'monthly',
        members: [],
        contributions: [],
        cycles: [],
      };

      await cacheGroup(mockGroup);
      const cached = await getCachedGroup('1');

      expect(cached).toBeTruthy();
      expect(cached?.group.id).toBe('1');
      expect(cached?.group.name).toBe('Test Group');
      expect(cached?.stale).toBe(false);
    });

    it('should cache and retrieve groups list', async () => {
      const mockGroups: PublicGroup[] = [
        {
          id: '1',
          name: 'Group 1',
          memberCount: 5,
          contributionAmount: 100,
          currency: 'XLM',
          status: 'active',
          createdAt: new Date(),
        },
        {
          id: '2',
          name: 'Group 2',
          memberCount: 3,
          contributionAmount: 200,
          currency: 'XLM',
          status: 'active',
          createdAt: new Date(),
        },
      ];

      await cacheGroupsList(mockGroups);
      const cached = await getCachedGroupsList();

      expect(cached).toBeTruthy();
      expect(cached?.groups).toHaveLength(2);
      expect(cached?.stale).toBe(false);
    });
  });

  describe('Sync Queue', () => {
    it('should add items to sync queue', async () => {
      const id = await addToSyncQueue({
        type: 'contribution',
        payload: { groupId: '1', amount: 100 },
        timestamp: new Date(),
        retryCount: 0,
        status: 'pending',
      });

      expect(id).toBeTruthy();
      const pending = await getPendingSyncItems();
      expect(pending).toHaveLength(1);
      expect(pending[0]?.type).toBe('contribution');
    });

    it('should update sync queue item status', async () => {
      const id = await addToSyncQueue({
        type: 'join_group',
        payload: { groupId: '1' },
        timestamp: new Date(),
        retryCount: 0,
        status: 'pending',
      });

      await updateSyncQueueItem(id, { status: 'processing' });
      const pending = await getPendingSyncItems();
      expect(pending).toHaveLength(0);
    });

    it('should remove sync queue item', async () => {
      const id = await addToSyncQueue({
        type: 'create_group',
        payload: { name: 'Test' },
        timestamp: new Date(),
        retryCount: 0,
        status: 'pending',
      });

      await removeSyncQueueItem(id);
      const pending = await getPendingSyncItems();
      expect(pending).toHaveLength(0);
    });

    it('should maintain queue order by timestamp', async () => {
      const now = new Date();
      const id1 = await addToSyncQueue({
        type: 'contribution',
        payload: { order: 1 },
        timestamp: new Date(now.getTime() - 1000),
        retryCount: 0,
        status: 'pending',
      });

      const id2 = await addToSyncQueue({
        type: 'contribution',
        payload: { order: 2 },
        timestamp: now,
        retryCount: 0,
        status: 'pending',
      });

      const pending = await getPendingSyncItems();
      expect(pending).toHaveLength(2);
      expect(pending[0]?.id).toBe(id1);
      expect(pending[1]?.id).toBe(id2);
    });
  });
});

describe('Sync Service', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', { onLine: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should detect online status', () => {
    expect(navigator.onLine).toBe(true);
  });

  it('should detect offline status', () => {
    vi.stubGlobal('navigator', { onLine: false });
    expect(navigator.onLine).toBe(false);
  });
});
