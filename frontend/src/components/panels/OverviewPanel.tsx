import { formatAmount, formatDate } from '../../utils/format';
import { Badge } from '../Badge';
import { GroupMetrics } from '../GroupMetrics';

import type { DetailedGroup, GroupContribution, GroupCycle } from '../../utils/groupApi';

interface OverviewPanelProps {
  group: DetailedGroup;
  contributions: GroupContribution[];
  cycles: GroupCycle[];
}

export function OverviewPanel({ group, contributions, cycles }: OverviewPanelProps) {
  const progressPercentage =
    group.targetAmount > 0 ? Math.min((group.currentAmount / group.targetAmount) * 100, 100) : 0;

  const getStatusVariant = (status: string): 'success' | 'warning' | 'info' | 'danger' => {
    switch (status) {
      case 'active':
      case 'completed':
        return 'success';
      case 'paused':
        return 'warning';
      case 'pending':
        return 'info';
      case 'failed':
        return 'danger';
      default:
        return 'info';
    }
  };

  return (
    <div className="group-details-overview">
      <div className="group-details-info-grid">
        <div className="group-details-info-item">
          <span className="group-details-info-label">Created</span>
          <span className="group-details-info-value">{formatDate(group.createdAt)}</span>
        </div>
        <div className="group-details-info-item">
          <span className="group-details-info-label">Members</span>
          <span className="group-details-info-value">{group.totalMembers}</span>
        </div>
        <div className="group-details-info-item">
          <span className="group-details-info-label">Frequency</span>
          <span className="group-details-info-value">{group.contributionFrequency}</span>
        </div>
        <div className="group-details-info-item">
          <span className="group-details-info-label">Status</span>
          <Badge variant={getStatusVariant(group.status)} size="sm">
            {group.status}
          </Badge>
        </div>
      </div>

      {group.description && (
        <div className="group-details-description">
          <h4>Description</h4>
          <p>{group.description}</p>
        </div>
      )}

      <div className="group-details-progress-section">
        <div className="group-details-progress-header">
          <h4>Progress</h4>
          <span className="group-details-progress-text">
            {formatAmount(group.currentAmount)} / {formatAmount(group.targetAmount)}
          </span>
        </div>
        <div className="group-details-progress-bar">
          <div
            className="group-details-progress-fill"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        <span className="group-details-progress-percentage">
          {progressPercentage.toFixed(1)}% Complete
        </span>
      </div>

      <GroupMetrics group={group} contributions={contributions} cycles={cycles} />
    </div>
  );
}
