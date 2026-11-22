/**
 * Centralized route table with typed path builders.
 *
 * Route literals must not appear outside this module. Use the builders
 * (e.g. `paths.group(id)`) in links, navigation calls, and tests so that
 * renaming a route only requires editing this file.
 */

export const routes = {
  home: '/',
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

export const paths = {
  home: (): string => routes.home,
  profile: (): string => routes.profile,
  groups: (): string => routes.groups,
  group: (id: string | number): string => `/groups/${id}`,
  groupSettings: (id: string | number): string => `/groups/${id}/settings`,
  transactions: (): string => routes.transactions,
  transaction: (id: string | number): string => `/transactions/${id}`,
  transactionBuilder: (): string => routes.transactionBuilder,
  settings: (): string => routes.settings,
  login: (): string => routes.login,
  register: (): string => routes.register,
  notFound: (): string => routes.notFound,
} as const;

export default paths;
