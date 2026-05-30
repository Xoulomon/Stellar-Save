/**
 * Centralised React Query key factory.
 * Using factory functions keeps keys consistent and makes targeted
 * invalidation easy (e.g. invalidate all queries for a specific group).
 */
export const queryKeys = {
  // Group state — staleTime: 30_000
  groups: {
    all: () => ['groups'] as const,
    list: (filters: object) => ['groups', 'list', filters] as const,
    detail: (groupId: string) => ['groups', 'detail', groupId] as const,
    members: (groupId: string) => ['groups', 'members', groupId] as const,
    payouts: (groupId: string) => ['groups', 'payouts', groupId] as const,
  },

  // Contribution status — staleTime: 0 (always fresh)
  contributions: {
    byGroup: (groupId: string) => ['contributions', groupId] as const,
  },
} as const;
