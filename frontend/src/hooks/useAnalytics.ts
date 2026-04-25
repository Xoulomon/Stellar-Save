import { useEffect, useState } from 'react';
import type { AnalyticsData } from '../types/analytics';

const MOCK_DATA: Omit<AnalyticsData, 'isLoading' | 'error'> = {
  stats: {
    totalContributed: 8_750,
    totalReceived: 5_000,
    roi: -42.9,
    onTimePercent: 91.7,
    activeGroups: 3,
    completedGroups: 1,
  },
  history: [
    { month: 'Nov 2025', contributed: 750, received: 0 },
    { month: 'Dec 2025', contributed: 750, received: 0 },
    { month: 'Jan 2026', contributed: 1_250, received: 0 },
    { month: 'Feb 2026', contributed: 1_250, received: 0 },
    { month: 'Mar 2026', contributed: 1_750, received: 2_400 },
    { month: 'Apr 2026', contributed: 1_750, received: 2_600 },
    { month: 'May 2026', contributed: 1_250, received: 0 },
  ],
  memberComparison: [
    { address: 'GSELF...', label: 'You', onTimePercent: 91.7, totalContributed: 8_750 },
    { address: 'GABC1...', label: 'GABC1...', onTimePercent: 100, totalContributed: 9_500 },
    { address: 'GDEF2...', label: 'GDEF2...', onTimePercent: 83.3, totalContributed: 7_200 },
    { address: 'GHIJ3...', label: 'GHIJ3...', onTimePercent: 75.0, totalContributed: 6_000 },
  ],
};

export function useAnalytics(): AnalyticsData {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 1000);
    return () => clearTimeout(t);
  }, []);

  return { ...MOCK_DATA, isLoading, error: null };
}
