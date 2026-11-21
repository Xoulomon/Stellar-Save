import { adminRoutes } from './domains/admin';
import { coreRoutes } from './domains/core';
import { fallbackRoutes } from './domains/fallback';
import { governanceRoutes } from './domains/governance';
import { savingsRoutes } from './domains/savings';
import { walletRoutes } from './domains/wallet';

import type { RouteConfig } from './types';

/**
 * Top-level route table, composed from per-feature domain modules.
 * See docs/routing.md for how to register a new feature's routes.
 */
export const routeConfig: RouteConfig[] = [
  ...coreRoutes,
  ...savingsRoutes,
  ...walletRoutes,
  ...governanceRoutes,
  ...adminRoutes,
  // Keep fallback routes (404, error) last.
  ...fallbackRoutes,
];
