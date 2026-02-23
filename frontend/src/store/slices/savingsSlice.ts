export interface SavingsGroup {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
}

export interface SavingsSlice {
  groups: SavingsGroup[];
  activeGroupId: string | null;
  addGroup: (group: Omit<SavingsGroup, 'id' | 'currentAmount'>) => void;
  contributeToGroup: (groupId: string, amount: number) => void;
  setActiveGroup: (groupId: string | null) => void;
  resetSavings: () => void;
}

type SliceSetter<T> = (partial: Partial<T> | ((state: T) => Partial<T>)) => void;

export const createSavingsSlice = <T extends SavingsSlice>(set: SliceSetter<T>): SavingsSlice => ({
  groups: [],
  activeGroupId: null,
  addGroup: (group) =>
    set((state) => ({
      groups: [
        ...state.groups,
        {
          id: crypto.randomUUID(),
          name: group.name,
          targetAmount: group.targetAmount,
          currentAmount: 0,
        },
      ],
    })),
  contributeToGroup: (groupId, amount) =>
    set((state) => ({
      groups: state.groups.map((group) =>
        group.id === groupId
          ? { ...group, currentAmount: Math.max(0, group.currentAmount + amount) }
          : group,
      ),
    })),
  setActiveGroup: (groupId) =>
    set(() => ({
      activeGroupId: groupId,
    })),
  resetSavings: () =>
    set(() => ({
      groups: [],
      activeGroupId: null,
    })),
});