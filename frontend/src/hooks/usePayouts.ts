import { useCallback, useEffect, useRef, useState } from 'react';
import { useContract } from './useContract';
import type { PayoutEntry, PayoutQueueData, PayoutStatus } from '../types/contribution';

interface UsePayoutsReturn {
  queue: PayoutQueueData | null;
  history: PayoutEntry[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

interface CacheEntry {
  queue: PayoutQueueData;
  history: PayoutEntry[];
  fetchedAt: number;
}

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();

function getFromCache(key: string): CacheEntry | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry;
}

function setInCache(key: string, value: CacheEntry): void {
  cache.set(key, { ...value, fetchedAt: Date.now() });
}

function toBigInt(value: unknown, fallback = 0n): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(Math.floor(value));
  if (typeof value === 'string' && /^[0-9]+$/.test(value)) return BigInt(value);
  return fallback;
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string' && !Number.isNaN(Number(value))) return Number(value);
  return fallback;
}

export function usePayouts(groupId: string | number | null | undefined): UsePayoutsReturn {
  const { getPayoutSchedule, getGroup } = useContract();

  const [queue, setQueue] = useState<PayoutQueueData | null>(null);
  const [history, setHistory] = useState<PayoutEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIdRef = useRef(0);

  const load = useCallback(
    async (rawGroupId: string | number | null | undefined, bust = false) => {
      const id = rawGroupId === null || rawGroupId === undefined ? '' : String(rawGroupId).trim();
      if (!id) {
        setQueue(null);
        setHistory([]);
        setError(null);
        setIsLoading(false);
        return;
      }

      if (!bust) {
        const cached = getFromCache(id);
        if (cached) {
          setQueue(cached.queue);
          setHistory(cached.history);
          setError(null);
          setIsLoading(false);
          return;
        }
      }

      let groupIdBigInt: bigint;
      try {
        groupIdBigInt = BigInt(id);
      } catch {
        setError('Invalid group ID');
        setQueue(null);
        setHistory([]);
        setIsLoading(false);
        return;
      }

      const fetchId = ++fetchIdRef.current;
      setIsLoading(true);
      setError(null);

      try {
        const schedule = await getPayoutSchedule(groupIdBigInt);
        const groupData = await getGroup(groupIdBigInt);

        if (fetchId !== fetchIdRef.current) return;

        const currentCycle = Math.max(0, toNumber(groupData.current_cycle, 0));
        const contributionAmountStroops = toBigInt(groupData.contribution_amount, 0n);
        const maxMembers = Math.max(
          0,
          toNumber(groupData.max_members, schedule.length),
          schedule.length,
        );

        const contributionXlm = Number(contributionAmountStroops) / 10_000_000;
        const payoutAmount = contributionXlm * maxMembers;

        const sortedSchedule = [...schedule].sort((a, b) => Number(a.cycle) - Number(b.cycle));

        const entries: PayoutEntry[] = sortedSchedule.map((item) => {
          const position = Number(item.cycle) + 1;
          const entryDate = new Date(Number(item.payout_date) * 1000);

          let status: PayoutStatus = 'upcoming';
          if (Number(item.cycle) < currentCycle) status = 'completed';
          else if (Number(item.cycle) === currentCycle) status = 'next';

          const paidAt = status === 'completed' ? entryDate : undefined;

          return {
            position,
            memberAddress: item.recipient,
            estimatedDate: entryDate,
            amount: payoutAmount,
            status,
            txHash: undefined,
            paidAt,
          };
        });

        const queueData: PayoutQueueData = {
          cycleId: currentCycle + 1,
          totalMembers: sortedSchedule.length,
          entries,
        };

        const historyData = entries.filter((entry) => entry.status === 'completed');

        setQueue(queueData);
        setHistory(historyData);
        setError(null);

        setInCache(id, {
          queue: queueData,
          history: historyData,
          fetchedAt: Date.now(),
        });
      } catch (err) {
        setError(err instanceof Error && err.message ? err.message : 'Unable to load payout data');
        setQueue(null);
        setHistory([]);
      } finally {
        if (fetchId === fetchIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [getGroup, getPayoutSchedule],
  );

  useEffect(() => {
    void load(groupId);
  }, [groupId, load]);

  const refresh = useCallback(() => {
    void load(groupId, true);
  }, [groupId, load]);

  return {
    queue,
    history,
    isLoading,
    error,
    refresh,
  };
}
