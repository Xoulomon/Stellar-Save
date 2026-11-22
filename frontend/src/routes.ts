/**
 * Centralized route table with typed path builders.
 *
 * Route literals must not appear outside this module. Use the builders
 * (e.g. `paths.group(id)`) in links, navigation calls, and tests so that
 * renaming a route only requires editing this file.
 */

export const routes = {
  home: '/',
  dashboard: '/dashboard',
  profile: '/profile',
  groups: '/groups',
  group: '/groups/:id',
  groupSettings: '/groups/:id/settings',
  transactions: '/transactions',
  transaction: '/transactions/:id',
  transactionBuilder: '/transactions/builder',
  settings: '/settings',
  login: '/login',
  register: '/register',
  notFound: '*',
} as const;

export type RouteName = keyof typeof routes;

/**
 * Returns all route pattern strings defined in the route table.
 * Useful for programmatic enumeration (e.g. breadcrumb matchers, test assertions).
 */
export function getRoutePatterns(): string[] {
  return Object.values(routes);
}

export const paths = {
  home: (): string => routes.home,
  dashboard: (): string => routes.dashboard,
  profile: (): string => routes.profile,
  groups: (): string => routes.groups,
  group: (id: string | number): string => `/groups/${encodeURIComponent(String(id))}`,
  groupSettings: (id: string | number): string =>
    `/groups/${encodeURIComponent(String(id))}/settings`,
  transactions: (): string => routes.transactions,
  transaction: (id: string | number): string => `/transactions/${encodeURIComponent(String(id))}`,
  transactionBuilder: (): string => routes.transactionBuilder,
  settings: (): string => routes.settings,
  login: (): string => routes.login,
  register: (): string => routes.register,
  notFound: (): string => routes.notFound,
} as const;

export default paths;
