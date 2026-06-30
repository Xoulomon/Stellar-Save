import { lazy } from "react";
import { ROUTES } from "./constants";
import type { RouteConfig } from "./types";

const AdminDashboardPage = lazy(() => import("../pages/AdminDashboardPage"));
const RecoverySetupPage = lazy(() => import("../pages/RecoverySetupPage"));
const HomePage = lazy(() => import("../pages/HomePage"));
const LandingPage = lazy(() => import("../pages/LandingPage"));
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
const GroupAnalyticsPage = lazy(() => import("../pages/GroupAnalytics"));
const NotFoundPage = lazy(() => import("../pages/NotFoundPage"));
const ErrorPage = lazy(() => import("../pages/ErrorPage"));
const TemplateGalleryPage = lazy(() => import("../pages/TemplateGalleryPage"));
const AnalyticsDashboardPage = lazy(() => import("../pages/AnalyticsDashboardPage"));
const PlatformAnalyticsDashboard = lazy(() => import("../pages/PlatformAnalyticsDashboard"));
const JoinViaInvite = lazy(() => import("../pages/JoinViaInvite"));
const AppDownloadPage = lazy(() => import("../pages/AppDownloadPage"));
const MemberProfilePage = lazy(() => import("../pages/MemberProfilePage"));
const NotificationSettings = lazy(() => import("../pages/settings/NotificationSettings"));
const AboutPage = lazy(() => import("../pages/AboutPage"));
const FeedbackAdminPage = lazy(() => import("../pages/FeedbackAdminPage"));
const TransactionHistoryPage = lazy(() => import("../pages/TransactionHistoryPage"));
const GovernancePage = lazy(() => import("../pages/GovernancePage"));

export const routeConfig: RouteConfig[] = [
  {
    path: ROUTES.HOME,
    component: HomePage,
    protected: false,
    title: "Stellar Save - Secure DeFi Savings",
    description: "Transparent, on-chain savings powered by Stellar",
  },
  {
    path: ROUTES.LANDING,
    component: LandingPage,
    protected: false,
    title: "Welcome to Stellar Save",
    description: "Community savings circles on Stellar",
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
  },
  {
    path: ROUTES.GROUPS_COMPARE,
    component: GroupComparisonPage,
    protected: true,
    title: "Compare Groups - Stellar Save",
    description: "Compare savings groups side-by-side before joining",
  },
  {
    path: ROUTES.GROUP_ANALYTICS,
    component: GroupAnalyticsPage,
    protected: true,
    title: "Group Analytics - Stellar Save",
    description: "Detailed analytics for your savings group",
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
    path: ROUTES.PROFILE_DETAIL,
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
    path: ROUTES.SETTINGS_NOTIFICATIONS,
    component: NotificationSettings,
    protected: true,
    title: "Notification Preferences - Stellar Save",
    description: "Configure your notification preferences",
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
    path: ROUTES.PLATFORM_ANALYTICS,
    component: PlatformAnalyticsDashboard,
    protected: true,
    title: "Platform Analytics - Stellar Save",
    description: "Platform-wide metrics and stakeholder insights",
  },
  {
    path: ROUTES.TRANSACTIONS,
    component: TransactionHistoryPage,
    protected: true,
    title: "Transaction History - Stellar Save",
    description: "Your full transaction history",
  },
  {
    path: ROUTES.TRANSACTION_BUILDER,
    component: TransactionBuilderPage,
    protected: true,
    title: "Transaction Builder - Stellar Save",
    description: "Build and simulate multi-step transactions",
  },
  {
    path: ROUTES.HARDWARE_WALLET,
    component: HardwareWalletPage,
    protected: true,
    title: "Hardware Wallet - Stellar Save",
    description: "Connect and manage Ledger/Trezor hardware wallets",
  },
  {
    path: ROUTES.DEPOSIT,
    component: DepositPage,
    protected: true,
    title: "Buy Crypto - Stellar Save",
    description: "Purchase XLM or stablecoins via bank transfer",
  },
  {
    path: ROUTES.WITHDRAW,
    component: WithdrawPage,
    protected: true,
    title: "Sell Crypto - Stellar Save",
    description: "Withdraw crypto to your bank account",
  },
  {
    path: ROUTES.GROUP_JOIN,
    component: JoinViaInvite,
    protected: false,
    title: "Join Group - Stellar Save",
    description: "Join a savings group via invitation link",
  },
  {
    path: ROUTES.APP_DOWNLOAD,
    component: AppDownloadPage,
    protected: false,
    title: "Get the App - Stellar Save",
    description: "Download Stellar Save mobile app",
  },
  {
    path: ROUTES.MEMBER_PROFILE,
    component: MemberProfilePage,
    protected: false,
    title: "Member Profile - Stellar Save",
    description: "View a member's contribution history and reputation",
  },
  {
    path: ROUTES.ABOUT,
    component: AboutPage,
    protected: false,
    title: "About - Stellar Save",
    description: "Learn about Stellar Save",
  },
  {
    path: ROUTES.FEEDBACK_ADMIN,
    component: FeedbackAdminPage,
    protected: true,
    title: "Feedback Dashboard - Stellar Save",
    description: "Review and respond to user feedback",
  },
  {
    path: ROUTES.ADMIN_DASHBOARD,
    component: AdminDashboardPage,
    protected: true,
    adminOnly: true,
    title: "Admin Dashboard - Stellar Save",
    description: "Platform health, moderation, and audit logs",
  },
  {
    path: ROUTES.RECOVERY,
    component: RecoverySetupPage,
    protected: true,
    title: "Social Recovery - Stellar Save",
    description: "Configure guardians and approve recovery requests",
  },
  {
    path: ROUTES.GOVERNANCE,
    component: GovernancePage,
    protected: false,
    title: "Governance - Stellar Save",
    description: "Protocol-level proposals: view, vote, and track timelock status",
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
];
