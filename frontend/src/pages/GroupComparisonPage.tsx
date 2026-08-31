import { GroupComparison } from '../components/GroupComparison';
import { Spinner } from '../components/Spinner';
import { useGroupsQuery } from '../hooks/useGroupsQuery';
import { AppCard, AppLayout } from '../ui';

export default function GroupComparisonPage() {
  const { groups, isLoading, error, refresh } = useGroupsQuery({ initialPageSize: 50 });

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
