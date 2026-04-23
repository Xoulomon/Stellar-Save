import { Box, Typography } from '@mui/material';
import { AppLayout } from '../ui';
import { ToastProvider } from '../components/Toast/ToastProvider';
import { DashboardOverview } from '../components/dashboard/DashboardOverview';
import { DashboardGroupCard } from '../components/dashboard/DashboardGroupCard';
import { PayoutSchedule } from '../components/dashboard/PayoutSchedule';
import { TransactionTable } from '../components/dashboard/TransactionTable';
import { QuickActionSidebar } from '../components/dashboard/QuickActionSidebar';
import { useDashboard } from '../hooks/useDashboard';

// Bento-box grid layout:
//  ┌─────────────────────────────────┬──────────────┐
//  │  Overview (full-width hero)     │              │
//  ├──────────────────┬──────────────┤  Quick       │
//  │  My Groups       │  Payout      │  Actions     │
//  ├──────────────────┴──────────────┤  (sticky)    │
//  │  Recent Transactions            │              │
//  └─────────────────────────────────┴──────────────┘

function DashboardContent() {
  const { stats, groups, payouts, transactions, isLoading } = useDashboard();

  const skeletonGroups = [1, 2, 3, 4];

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: '1fr 280px' },
        gridTemplateRows: 'auto',
        gap: 3,
        alignItems: 'start',
      }}
    >
      {/* ── Left column ── */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

        {/* 1. Overview hero */}
        <DashboardOverview stats={stats} isLoading={isLoading} />

        {/* 2. My Groups + Payout Schedule side-by-side */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 300px' }, gap: 3, alignItems: 'start' }}>

          {/* My Groups grid */}
          <Box>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>My Groups</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 2 }}>
              {isLoading
                ? skeletonGroups.map((i) => <DashboardGroupCard key={i} isLoading />)
                : groups.map((g) => <DashboardGroupCard key={g.id} group={g} />)}
            </Box>
          </Box>

          {/* Payout Schedule */}
          <PayoutSchedule payouts={payouts} isLoading={isLoading} />
        </Box>

        {/* 3. Recent Transactions */}
        <TransactionTable transactions={transactions} isLoading={isLoading} />
      </Box>

      {/* ── Right column: Quick Actions (sticky) ── */}
      <Box sx={{ position: { lg: 'sticky' }, top: { lg: 88 } }}>
        <QuickActionSidebar />
      </Box>
    </Box>
  );
}

export default function DashboardPage() {
  return (
    <ToastProvider>
      <AppLayout title="Dashboard" subtitle="Your savings overview" footerText="Stellar Save — Built for transparent, on-chain savings">
        <DashboardContent />
      </AppLayout>
    </ToastProvider>
  );
}
