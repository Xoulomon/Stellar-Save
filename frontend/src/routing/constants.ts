/**
 * Application route paths as immutable constants.
 * Use these constants instead of hardcoded strings throughout the application.
 */
export const ROUTES = {
  HOME: "/",
  DASHBOARD: "/dashboard",
  GROUPS: "/groups",
  GROUP_DETAIL: "/groups/:groupId",
  PROFILE: "/profile",
  SETTINGS: "/settings",
  NOT_FOUND: "/404",
  ERROR: "/500",
  GROUP_CREATE: "/groups/create",
  GROUPS_BROWSE: "/groups/browse",

  GROUP_CALENDAR: "/groups/:groupId/calendar",

  GROUPS_COMPARE: "/groups/compare",

  LEADERBOARD: "/leaderboard",

} as const;

/**
 * Type-safe route path type
 */
export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];

/**
 * Helper to build parameterized routes
 */
export const buildRoute = {
  groupDetail: (groupId: string) => `/groups/${groupId}`,
  groupCalendar: (groupId: string) => `/groups/${groupId}/calendar`,
} as const;
