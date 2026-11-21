import { lazy } from 'react';

import { ROUTES } from '../constants';

import type { RouteConfig } from '../types';

const HomePage = lazy(() => import('../../pages/HomePage'));
const LandingPage = lazy(() => import('../../pages/LandingPage'));
const DashboardPage = lazy(() => import('../../pages/DashboardPage'));
const ProfilePage = lazy(() => import('../../pages/ProfilePage'));
const SettingsPage = lazy(() => import('../../pages/SettingsPage'));
const NotificationSettings = lazy(() => import('../../pages/settings/NotificationSettings'));
const AppDownloadPage = lazy(() => import('../../pages/AppDownloadPage'));
const MemberProfilePage = lazy(() => import('../../pages/MemberProfilePage'));
const AboutPage = lazy(() => import('../../pages/AboutPage'));

export const coreRoutes: RouteConfig[] = [
  {
    path: ROUTES.HOME,
    component: HomePage,
    protected: false,
    title: 'Stellar Save - Secure DeFi Savings',
    description: 'Transparent, on-chain savings powered by Stellar',
  },
  {
    path: ROUTES.LANDING,
    component: LandingPage,
    protected: false,
    title: 'Welcome to Stellar Save',
    description: 'Community savings circles on Stellar',
  },
  {
    path: ROUTES.DASHBOARD,
    component: DashboardPage,
    protected: true,
    title: 'Dashboard - Stellar Save',
    description: 'View your savings groups and contributions',
  },
  {
    path: ROUTES.PROFILE,
    component: ProfilePage,
    protected: true,
    title: 'Profile - Stellar Save',
  },
  {
    path: ROUTES.PROFILE_DETAIL,
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
    path: ROUTES.SETTINGS_NOTIFICATIONS,
    component: NotificationSettings,
    protected: true,
    title: 'Notification Preferences - Stellar Save',
    description: 'Configure your notification preferences',
  },
  {
    path: ROUTES.APP_DOWNLOAD,
    component: AppDownloadPage,
    protected: false,
    title: 'Get the App - Stellar Save',
    description: 'Download Stellar Save mobile app',
  },
  {
    path: ROUTES.MEMBER_PROFILE,
    component: MemberProfilePage,
    protected: false,
    title: 'Member Profile - Stellar Save',
    description: "View a member's contribution history and reputation",
  },
  {
    path: ROUTES.ABOUT,
    component: AboutPage,
    protected: false,
    title: 'About - Stellar Save',
    description: 'Learn about Stellar Save',
  },
];
