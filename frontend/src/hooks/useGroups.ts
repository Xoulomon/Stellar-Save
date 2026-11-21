import { useGroupsQuery } from './useGroupsQuery';

import type { UseGroupsQueryOptions } from './useGroupsQuery';

/**
 * @deprecated Use useGroupsQuery for reads and useGroupMutations for writes. Removal planned for v2.0.
 * Kept so existing imports keep resolving while call sites migrate.
 */
export const useGroups = useGroupsQuery;

export type UseGroupsOptions = UseGroupsQueryOptions;
