/**
 * useAdminQueries — React Query bindings for the admin dashboard.
 *
 * These queries and mutations previously lived inline in
 * `pages/AdminDashboardPage.tsx` and its private sub-components, which meant the
 * page owned its data layer directly. They now sit behind the same hook-based
 * convention the rest of the app uses (`hooks/useX.ts` over `utils/*Api.ts`),
 * and reuse the centralised `queryKeys.admin.*` factory instead of a local
 * duplicate.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../lib/queryKeys';
import {
  deleteAdminUser,
  fetchAdminGroups,
  fetchAdminUsers,
  fetchAuditLogs,
  fetchPlatformStats,
  flagGroup,
  updateAdminUser,
} from '../utils/adminApi';

import type { AdminGroup, AdminUser } from '../utils/adminApi';

/** Platform health metrics, refreshed once a minute. */
export function usePlatformStatsQuery() {
  return useQuery({
    queryKey: queryKeys.admin.stats(),
    queryFn: fetchPlatformStats,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

/** Registered users, refreshed on demand after moderation actions. */
export function useAdminUsersQuery() {
  return useQuery({
    queryKey: queryKeys.admin.users(),
    queryFn: fetchAdminUsers,
    staleTime: 30_000,
  });
}

/** All groups, refreshed on demand after moderation actions. */
export function useAdminGroupsQuery() {
  return useQuery({
    queryKey: queryKeys.admin.groups(),
    queryFn: fetchAdminGroups,
    staleTime: 30_000,
  });
}

/** Audit log tail, polled every 30s. */
export function useAuditLogsQuery() {
  return useQuery({
    queryKey: queryKeys.admin.auditLogs(),
    queryFn: fetchAuditLogs,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

/** Flag/unflag a user, then refresh the user list. */
export function useUpdateAdminUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ user, flagged, adminId }: { user: AdminUser; flagged: boolean; adminId: string }) =>
      updateAdminUser(user.id, { flagged }, adminId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.admin.users() }),
  });
}

/** Delete a user, then refresh the user list. */
export function useDeleteAdminUserMutation() {
  return useMutation({
    mutationFn: ({ userId, adminId }: { userId: string; adminId: string }) =>
      deleteAdminUser(userId, adminId),
  });
}

/** Flag/unflag a group, then refresh the group list. */
export function useFlagGroupMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ group, flagged, adminId }: { group: AdminGroup; flagged: boolean; adminId: string }) =>
      flagGroup(group.id, flagged, adminId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.admin.groups() }),
  });
}
