/**
 * TransactionHistoryPage — updated for Issue #769
 *
 * Now uses the new TransactionHistory component which wraps MUI DataGrid
 * with Horizon API fetching, sorting, and pagination.
 */
import { AppLayout } from '../ui';
import { TransactionHistory } from '../components/TransactionHistory';

export default function TransactionHistoryPage() {
  return (
    <AppLayout
      title="Transaction History"
      subtitle="Your full contribution and payout history from the Stellar network"
      footerText="Stellar Save - Built for transparent, on-chain savings"
    >
      <TransactionHistory pageSize={10} />
    </AppLayout>
  );
}
