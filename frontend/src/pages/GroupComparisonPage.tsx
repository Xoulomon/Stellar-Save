import { AppCard, AppLayout } from '../ui';
import { GroupComparison } from '../components/GroupComparison';
import { useGroups } from '../hooks/useGroups';
import { Spinner } from '../components/Spinner';

export default function GroupComparisonPage() {
  const { groups, isLoading, error, refresh } = useGroups({ initialPageSize: 50 });

  return (
    <AppLayout
      title="Compare Groups"
      subtitle="Compare up to 3 groups side-by-side before joining"
      footerText="Stellar Save - Built for transparent, on-chain savings"
    >
      <AppCard>
        {isLoading && <Spinner />}
        {error && (
          <div role="alert">
            <p>{error}</p>
            <button onClick={refresh}>Retry</button>
          </div>
        )}
        {!isLoading && !error && <GroupComparison availableGroups={groups} />}
      </AppCard>
    </AppLayout>
  );
}
