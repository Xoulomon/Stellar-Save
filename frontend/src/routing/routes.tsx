import { lazy } from 'react';
import { ROUTES } from './constants';
import type { RouteConfig } from './types';

// Lazy load page components
const HomePage = lazy(() => import('../pages/HomePage'));
const DashboardPage = lazy(() => import('../pages/DashboardPage'));
const GroupsPage = lazy(() => import('../pages/GroupsPage'));
const GroupDetailPage = lazy(() => import('../pages/GroupDetailPage'));
const ProfilePage = lazy(() => import('../pages/ProfilePage'));
const SettingsPage = lazy(() => import('../pages/SettingsPage'));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'));

/**
 * Centralized route configuration.
 * All application routes are defined here with their properties.
 */
export const routeConfig: RouteConfig[] = [
  {
    path: ROUTES.HOME,
    component: HomePage,
    protected: false,
    title: 'Stellar Save - Secure DeFi Savings',
    description: 'Transparent, on-chain savings powered by Stellar',
  },
  {
    path: ROUTES.DASHBOARD,
    component: DashboardPage,
    protected: true,
    title: 'Dashboard - Stellar Save',
    description: 'View your savings groups and contributions',
  },
  {
    path: ROUTES.GROUPS,
    component: GroupsPage,
    protected: true,
    title: 'Groups - Stellar Save',
    description: 'Browse and join savings groups',
  },
  {
    path: ROUTES.GROUP_DETAIL,
    component: GroupDetailPage,
    protected: true,
    title: 'Group Details - Stellar Save',
  },
  {
    path: ROUTES.PROFILE,
    component: ProfilePage,
    protected: true,
    title: 'Profile - Stellar Save',
  },
  {
    path: ROUTES.SETTINGS,
    component: SettingsPage,
    protected: true,
    title: 'Settings - Stellar Save',
  },
  {
    path: ROUTES.NOT_FOUND,
    component: NotFoundPage,
    protected: false,
    title: '404 - Page Not Found',
  },
];

