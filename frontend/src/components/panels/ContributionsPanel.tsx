import { formatAmount, formatDate } from '../../utils/format';
import { Avatar } from '../Avatar';
import { Badge } from '../Badge';

import type { GroupContribution } from '../../utils/groupApi';

interface ContributionsPanelProps {
  contributions: GroupContribution[];
  onContributionClick?: (contribution: GroupContribution) => void;
}

export function ContributionsPanel({ contributions, onContributionClick }: ContributionsPanelProps) {
  const getStatusVariant = (status: string): 'success' | 'warning' | 'info' | 'danger' => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'pending':
        return 'warning';
      case 'failed':
        return 'danger';
      default:
        return 'info';
    }
  };

  return (
    <div className="group-details-contributions">
      <div className="group-details-contributions-header">
        <h4>Contribution History ({contributions.length})</h4>
      </div>
      <div className="group-details-contributions-list">
        {contributions.map((contribution) => (
          <div
            key={contribution.id}
            className={`group-details-contribution-item ${onContributionClick ? 'group-details-contribution-clickable' : ''}`}
            onClick={() => onContributionClick?.(contribution)}
          >
            <div className="group-details-contribution-main">
              <Avatar name={contribution.memberName || contribution.memberId} size="sm" />
              <div className="group-details-contribution-info">
                <div className="group-details-contribution-member">
                  {contribution.memberName || 'Anonymous'}
                </div>
                <div className="group-details-contribution-date">
                  {formatDate(contribution.timestamp)}
                </div>
              </div>
            </div>
            <div className="group-details-contribution-details">
              <div className="group-details-contribution-amount">
                {formatAmount(contribution.amount)}
              </div>
              <Badge variant={getStatusVariant(contribution.status)} size="sm">
                {contribution.status}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
