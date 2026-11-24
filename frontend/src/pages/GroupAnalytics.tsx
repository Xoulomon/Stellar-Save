import { useParams } from 'react-router-dom';

import { GroupAnalyticsView } from './group-analytics';
import { ErrorState } from '../components/ErrorState';
import { useGroupAnalytics } from '../hooks/useGroupAnalytics';
import { AppLayout } from '../ui';

export default function GroupAnalytics() {
  const { groupId } = useParams<{ groupId: string }>();
  const { cycleRates, onTimePercent, projectedCompletionDate, isLoading, error } =
    useGroupAnalytics(groupId ?? '');

  if (error) {
    return (
      <AppLayout title="Group Analytics" subtitle={`Analytics for group: ${groupId}`}>
        <ErrorState message={`Error loading analytics: ${error}`} />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Group Analytics" subtitle={`Analytics for group: ${groupId}`}>
      <GroupAnalyticsView
        groupId={groupId}
        cycleRates={cycleRates}
        onTimePercent={onTimePercent}
        projectedCompletionDate={projectedCompletionDate}
        isLoading={isLoading}
      />
    </AppLayout>
  );
}
