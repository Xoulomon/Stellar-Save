/**
 * Application route paths as immutable constants.
 * Use these constants instead of hardcoded strings throughout the application.
 */
export const ROUTES = {
  HOME: "/",
  LANDING: "/welcome",
  DASHBOARD: "/dashboard",
  GROUPS: "/groups",
  GROUP_DETAIL: "/groups/:groupId",
  GROUP_CREATE: "/groups/create",
  GROUPS_BROWSE: "/groups/browse",
  GROUPS_COMPARE: "/groups/compare",
  GROUP_CALENDAR: "/groups/:groupId/calendar",
  GROUP_ANALYTICS: "/groups/:groupId/analytics",
  GROUP_MEMBERS: "/groups/:groupId/members",
  GROUP_JOIN: "/join/:inviteCode",
  PROFILE: "/profile",
  PROFILE_DETAIL: "/profile/:address",
  SETTINGS: "/settings",
  SETTINGS_NOTIFICATIONS: "/settings/notifications",
  LEADERBOARD: "/leaderboard",
  TEMPLATES: "/templates",
  ANALYTICS: "/analytics",
  TRANSACTIONS: "/transactions",
  MEMBER_PROFILE: "/members/:address",
  ABOUT: "/about",
  NOT_FOUND: "/404",
  ERROR: "/500",
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
  groupAnalytics: (groupId: string) => `/groups/${groupId}/analytics`,
  groupMembers: (groupId: string) => `/groups/${groupId}/members`,
  groupJoin: (inviteCode: string) => `/join/${inviteCode}`,
  memberProfile: (address: string) => `/members/${address}`,
} as const;
