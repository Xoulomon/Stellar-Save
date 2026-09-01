import { Box, Typography } from '@mui/material';
import { AppLayout } from '../ui';
import { ToastProvider } from '../components/Toast/ToastProvider';
import { ErrorBoundary } from '../components/ErrorBoundary/ErrorBoundary';
import {
  DashboardOverview,
  DashboardGroupCard,
  PayoutSchedule,
  TransactionTable,
  QuickActionSidebar,
  DashboardSummary,
  DashboardChart,
  DashboardActions,
} from '../components/dashboard';
import { BalanceWarningBanner } from '../components/BalanceWarningBanner';
import { useDashboardData } from '../hooks/useDashboardData';
import { useBalanceWarning } from '../hooks/useBalanceWarning';

function DashboardContent() {
  const { stats, groups, payouts, transactions, isLoading } = useDashboardData();
  const balanceWarning = useBalanceWarning(groups);

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 280px' }, gap: 3, alignItems: 'start' }}>

      {/* Left column */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

        {/* Balance warning banner */}
        <BalanceWarningBanner warning={balanceWarning} />

        {/* 1. Dashboard summary & quick actions */}
        <DashboardSummary stats={stats} isLoading={isLoading} />
        <DashboardActions />

        {/* 2. Overview hero & charts */}
        <DashboardOverview stats={stats} isLoading={isLoading} />
        <DashboardChart groups={groups} isLoading={isLoading} />

        {/* 3. My Groups + Payout Schedule */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 300px' }, gap: 3, alignItems: 'start' }}>
          <Box>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>My Groups</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 2 }}>
              {isLoading
                ? [1, 2, 3, 4].map((i) => <DashboardGroupCard key={i} isLoading />)
                : groups.map((g) => <DashboardGroupCard key={g.id} group={g} />)}
            </Box>
          </Box>
          <PayoutSchedule payouts={payouts} isLoading={isLoading} />
        </Box>

        {/* 4. Recent Transactions */}
        <TransactionTable transactions={transactions} isLoading={isLoading} />
      </Box>

      {/* Right column: Quick Actions (sticky on desktop) */}
      <Box sx={{ position: { lg: 'sticky' }, top: { lg: 88 } }}>
        <QuickActionSidebar />
      </Box>
    </Box>
  );
}

export default function DashboardPage() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AppLayout title="Dashboard" subtitle="Your savings overview" footerText="Stellar Save — Built for transparent, on-chain savings">
          <DashboardContent />
        </AppLayout>
      </ToastProvider>
    </ErrorBoundary>
  );
}
