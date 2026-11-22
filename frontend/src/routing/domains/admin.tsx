import { lazy } from 'react';

import { ROUTES } from '../constants';

import type { RouteConfig } from '../types';

const PlatformAnalyticsDashboard = lazy(() => import('../../pages/PlatformAnalyticsDashboard'));
const FeedbackAdminPage = lazy(() => import('../../pages/FeedbackAdminPage'));
const AdminDashboardPage = lazy(() => import('../../pages/AdminDashboardPage'));

export const adminRoutes: RouteConfig[] = [
  {
    path: ROUTES.PLATFORM_ANALYTICS,
    component: PlatformAnalyticsDashboard,
    protected: true,
    title: 'Platform Analytics - Stellar Save',
    description: 'Platform-wide metrics and stakeholder insights',
  },
  {
    path: ROUTES.FEEDBACK_ADMIN,
    component: FeedbackAdminPage,
    protected: true,
    title: 'Feedback Dashboard - Stellar Save',
    description: 'Review and respond to user feedback',
  },
  {
    path: ROUTES.ADMIN_DASHBOARD,
    component: AdminDashboardPage,
    protected: true,
    adminOnly: true,
    title: 'Admin Dashboard - Stellar Save',
    description: 'Platform health, moderation, and audit logs',
  },
];
