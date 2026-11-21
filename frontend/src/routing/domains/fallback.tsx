import { lazy } from 'react';

import { ROUTES } from '../constants';

import type { RouteConfig } from '../types';

const NotFoundPage = lazy(() => import('../../pages/NotFoundPage'));
const ErrorPage = lazy(() => import('../../pages/ErrorPage'));

export const fallbackRoutes: RouteConfig[] = [
  {
    path: ROUTES.NOT_FOUND,
    component: NotFoundPage,
    protected: false,
    title: '404 - Page Not Found',
  },
  {
    path: ROUTES.ERROR,
    component: ErrorPage,
    protected: false,
    title: 'Error - Stellar Save',
  },
  ...(import.meta.env['VITE_VISUAL_GALLERY'] === 'true'
    ? [
        {
          path: ROUTES.VISUAL_GALLERY,
          component: lazy(() => import('../../pages/VisualGalleryPage')),
          protected: false,
          title: 'Visual Component Gallery',
        } satisfies RouteConfig,
      ]
    : []),
];
