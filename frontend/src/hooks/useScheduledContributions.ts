import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';

export interface ScheduledContribution {
  id: string;
  groupId: string;
  groupName: string;
  amount: number;
  scheduledDate: string; // ISO string
  note?: string;
  createdAt: string;
}

export type ScheduledContributionInput = Omit<ScheduledContribution, 'id' | 'createdAt'>;

const STORAGE_KEY = 'stellar_save_scheduled_contributions';

export function useScheduledContributions() {
  const [items, setItems] = useLocalStorage<ScheduledContribution[]>(STORAGE_KEY, []);

  const add = useCallback(
    (input: ScheduledContributionInput): ScheduledContribution => {
      const entry: ScheduledContribution = {
        ...input,
        id: `sc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        createdAt: new Date().toISOString(),
      };
      setItems((prev) => [...prev, entry]);
      return entry;
    },
    [setItems],
  );

  const update = useCallback(
    (id: string, patch: Partial<ScheduledContributionInput>) => {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      );
    },
    [setItems],
  );

  const remove = useCallback(
    (id: string) => {
      setItems((prev) => prev.filter((item) => item.id !== id));
    },
    [setItems],
  );

  const getByGroup = useCallback(
    (groupId: string) => items.filter((item) => item.groupId === groupId),
    [items],
  );

  return { items, add, update, remove, getByGroup };
}
