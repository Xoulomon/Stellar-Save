<<<<<<< HEAD
import { useState, useEffect } from 'react';

import type { DashboardStats, DashboardGroup, PayoutItem, Transaction } from '../types/dashboard';
=======
import { useDashboardData } from './useDashboardData';
>>>>>>> fdf2a8f283604cda2c06a98035b0edb0abbe6fb9

export { useDashboardData };
export const useDashboard = useDashboardData;
export type { DashboardData } from './useDashboardData';
