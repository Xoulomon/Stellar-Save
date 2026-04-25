import { lazy } from "react";
import { ROUTES } from "./constants";
import type { RouteConfig } from "./types";


// Lazy load page components
const HomePage = lazy(() => import("../pages/HomePage"));
const DashboardPage = lazy(() => import("../pages/DashboardPage"));
const GroupsPage = lazy(() => import("../pages/GroupsPage"));
const GroupDetailPage = lazy(() => import("../pages/GroupDetailPage"));
const ProfilePage = lazy(() => import("../pages/ProfilePage"));
const SettingsPage = lazy(() => import("../pages/SettingsPage"));
const CreateGroupPage = lazy(() => import("../pages/CreateGroupPage"));
const BrowseGroupsPage = lazy(() => import("../pages/BrowseGroupsPage"));

const ContributionCalendarPage = lazy(() => import("../pages/ContributionCalendarPage"));
const MemberDirectoryPage = lazy(() => import("../pages/MemberDirectoryPage"));
const LeaderboardPage = lazy(() => import("../pages/LeaderboardPage"));

const GroupComparisonPage = lazy(() => import("../pages/GroupComparisonPage"));

const NotFoundPage = lazy(() => import("../pages/NotFoundPage"));
const ErrorPage = lazy(() => import("../pages/ErrorPage"));
const TemplateGalleryPage = lazy(() => import("../pages/TemplateGalleryPage"));
const AnalyticsDashboardPage = lazy(() => import("../pages/AnalyticsDashboardPage"));
/**
 * Centralized route configuration.
 * All application routes are defined here with their properties.
 */
export const routeConfig: RouteConfig[] = [
  {
    path: ROUTES.HOME,
    component: HomePage,
    protected: false,
    title: "Stellar Save - Secure DeFi Savings",
    description: "Transparent, on-chain savings powered by Stellar",
  },
  {
    path: ROUTES.DASHBOARD,
    component: DashboardPage,
    protected: true,
    title: "Dashboard - Stellar Save",
    description: "View your savings groups and contributions",
  },
  {
    path: ROUTES.GROUPS,
    component: GroupsPage,
    protected: true,
    title: "Groups - Stellar Save",
    description: "Browse and join savings groups",
  },
  {
    path: ROUTES.GROUP_CREATE,
    component: CreateGroupPage,
    protected: true,
    title: "Create Group - Stellar Save",
    description: "Create a new savings group",
  },
  {
    path: ROUTES.GROUPS_BROWSE,
    component: BrowseGroupsPage,
    protected: true,
    title: "Browse Groups - Stellar Save",
    description: "Discover and join public savings groups",
  },
  {

    path: ROUTES.GROUP_CALENDAR,
    component: ContributionCalendarPage,
    protected: true,
    title: "Contribution Calendar - Stellar Save",
    description: "View contribution deadlines and payment history",

    path: ROUTES.GROUPS_COMPARE,
    component: GroupComparisonPage,
    protected: true,
    title: "Compare Groups - Stellar Save",
    description: "Compare savings groups side-by-side before joining",

  },
  {
    path: ROUTES.GROUP_DETAIL,
    component: GroupDetailPage,
    protected: true,
    title: "Group Details - Stellar Save",
  },
  {
    path: ROUTES.GROUP_MEMBERS,
    component: MemberDirectoryPage,
    protected: true,
    title: "Member Directory - Stellar Save",
    description: "Browse and search group members",
  },
  {
    path: ROUTES.LEADERBOARD,
    component: LeaderboardPage,
    protected: true,
    title: "Leaderboard - Stellar Save",
    description: "Top-performing groups and contributors",
  },
  {
    path: ROUTES.PROFILE,
    component: ProfilePage,
    protected: true,
    title: "Profile - Stellar Save",
  },
  {
    path: ROUTES.SETTINGS,
    component: SettingsPage,
    protected: true,
    title: "Settings - Stellar Save",
  },
  {
    path: ROUTES.NOT_FOUND,
    component: NotFoundPage,
    protected: false,
    title: "404 - Page Not Found",
  },
  {
    path: ROUTES.ERROR,
    component: ErrorPage,
    protected: false,
    title: "Error - Stellar Save",
  },
  {
    path: ROUTES.TEMPLATES,
    component: TemplateGalleryPage,
    protected: true,
    title: "Group Templates - Stellar Save",
    description: "Browse and use group templates",
  },
  {
    path: ROUTES.ANALYTICS,
    component: AnalyticsDashboardPage,
    protected: true,
    title: "Analytics - Stellar Save",
    description: "Your contribution analytics and statistics",
  },
  {
    path: ROUTES.LEADERBOARD,
    component: LeaderboardPage,
    protected: true,
    title: "Leaderboard - Stellar Save",
    description: "Top-performing groups and contributors",
  },
];
