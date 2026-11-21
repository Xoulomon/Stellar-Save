import { describe, it, expect } from 'vitest';
import { contractInvoker, executeQueuedAction } from '../lib/syncService';
import type { SyncQueueItem } from '../lib/db';

describe('syncService contract invoker', () => {
  it.each([
    ['contribution'],
    ['join_group'],
    ['create_group'],
    ['update_group'],
  ] as const)('routes %s operation through contractInvoker and rejects with not implemented error', async (type) => {
    await expect(contractInvoker(type, { test: 123 })).rejects.toThrow(
      `Contract method not yet implemented: ${type}`
    );
  });

  it('executeQueuedAction calls contractInvoker and propagates error', async () => {
    const item: SyncQueueItem = {
      id: 'test-1',
      type: 'contribution',
      payload: { amount: 100 },
      timestamp: new Date(),
      retryCount: 0,
      status: 'pending',
    };

    await expect(executeQueuedAction(item)).rejects.toThrow(
      'Contract method not yet implemented: contribution'
    );
  });
});
