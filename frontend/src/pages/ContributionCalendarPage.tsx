import { useNavigate, useParams } from 'react-router-dom';

import { ContributionCalendar } from '../components/ContributionCalendar';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { useContributions } from '../hooks/useContributions';
import { buildRoute } from '../routing/constants';
import { AppCard, AppLayout } from '../ui';

export default function ContributionCalendarPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { contributions, currentCycle, isLoading, error, refresh } = useContributions(groupId);

  const handleContribute = () => {
    if (groupId) navigate(buildRoute.groupDetail(groupId));
  };

  return (
    <AppLayout
      title="Contribution Calendar"
      subtitle="View deadlines and contribution history"
      footerText="Stellar Save - Built for transparent, on-chain savings"
    >
      <AppCard>
        {isLoading && <LoadingState message="Loading contributions…" />}
        {error && <ErrorState message={error} onRetry={refresh} />}
        {!isLoading && !error && (
          <ContributionCalendar
            contributions={contributions}
            currentCycle={currentCycle}
            onContribute={handleContribute}
          />
        )}
      </AppCard>
    </AppLayout>
  );
}
