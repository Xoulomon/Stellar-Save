import { Box, Typography } from '@mui/material';

import { BalanceWarningBanner } from '../../components/BalanceWarningBanner';
import {
  DashboardActions,
  DashboardChart,
  DashboardGroupCard,
  DashboardOverview,
  DashboardSummary,
  PayoutSchedule,
  QuickActionSidebar,
  TransactionTable,
} from '../../components/dashboard';

import type { BalanceWarning } from '../../hooks/useBalanceWarning';
import type { DashboardStats, DashboardGroup, PayoutItem, Transaction } from '../../types/dashboard';

const EMPTY_STATS: DashboardStats = {
  totalBalance: 0,
  nextPayoutAmount: 0,
  nextPayoutDate: '',
  currency: 'XLM',
};

export interface DashboardViewProps {
  stats: DashboardStats | null;
  groups: DashboardGroup[];
  payouts: PayoutItem[];
  transactions: Transaction[];
  balanceWarning: BalanceWarning;
  isLoading: boolean;
}

export function DashboardView({
  stats,
  groups,
  payouts,
  transactions,
  balanceWarning,
  isLoading,
}: DashboardViewProps) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: '1fr 280px' },
        gap: 3,
        alignItems: 'start',
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <BalanceWarningBanner warning={balanceWarning} />

        <DashboardSummary stats={stats} isLoading={isLoading} />
        <DashboardActions />

        <DashboardOverview stats={stats ?? EMPTY_STATS} isLoading={isLoading} />
        <DashboardChart groups={groups} isLoading={isLoading} />

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 300px' },
            gap: 3,
            alignItems: 'start',
          }}
        >
          <Box>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
              My Groups
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                gap: 2,
              }}
            >
              {isLoading
                ? [1, 2, 3, 4].map((i) => <DashboardGroupCard key={i} isLoading />)
                : groups.map((g) => <DashboardGroupCard key={g.id} group={g} />)}
            </Box>
          </Box>
          <PayoutSchedule payouts={payouts} isLoading={isLoading} />
        </Box>

        <TransactionTable transactions={transactions} isLoading={isLoading} />
      </Box>

      <Box sx={{ position: { lg: 'sticky' }, top: { lg: 88 } }}>
        <QuickActionSidebar />
      </Box>
    </Box>
  );
}

export default DashboardView;
