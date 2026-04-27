import { useNavigate, useParams } from 'react-router-dom';
import { AppCard, AppLayout } from '../ui';
import { ContributionCalendar } from '../components/ContributionCalendar';
import { Spinner } from '../components/Spinner';
import { useContributions } from '../hooks/useContributions';
import { buildRoute } from '../routing/constants';

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
        {isLoading && <Spinner />}
        {error && (
          <div role="alert">
            <p>{error}</p>
            <button onClick={refresh}>Retry</button>
          </div>
        )}
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
