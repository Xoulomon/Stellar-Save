import { lazy } from 'react';

import { ROUTES } from '../constants';

import type { RouteConfig } from '../types';

const GovernancePage = lazy(() => import('../../pages/GovernancePage'));

export const governanceRoutes: RouteConfig[] = [
  {
    path: ROUTES.GOVERNANCE,
    component: GovernancePage,
    protected: false,
    title: 'Governance - Stellar Save',
    description: 'Protocol-level proposals: view, vote, and track timelock status',
  },
];
