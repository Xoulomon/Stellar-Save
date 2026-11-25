import { DashboardView } from './dashboard';
import { ErrorBoundary } from '../components/ErrorBoundary/ErrorBoundary';
import { ToastProvider } from '../components/Toast/ToastProvider';
import { useBalanceWarning } from '../hooks/useBalanceWarning';
import { useDashboardData } from '../hooks/useDashboardData';
import { AppLayout } from '../ui';

function DashboardContent() {
  const { stats, groups, payouts, transactions, isLoading } = useDashboardData();
  const balanceWarning = useBalanceWarning(groups);

  return (
    <DashboardView
      stats={stats}
      groups={groups}
      payouts={payouts}
      transactions={transactions}
      balanceWarning={balanceWarning}
      isLoading={isLoading}
    />
  );
}

export default function DashboardPage() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AppLayout
          title="Dashboard"
          subtitle="Your savings overview"
          footerText="Stellar Save — Built for transparent, on-chain savings"
        >
          <DashboardContent />
        </AppLayout>
      </ToastProvider>
    </ErrorBoundary>
  );
}
