import { useCallback } from 'react';

import { queueAction } from '../../lib/syncService';

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
