import './GroupCard.css';
import { Button } from './Button';
import { Badge } from './Badge';

interface GroupCardProps {
  groupName: string;
  memberCount: number;
  contributionAmount: number;
  currency?: string;
  status?: 'active' | 'completed' | 'pending';
  onClick?: () => void;
  onViewDetails?: () => void;
  onJoin?: () => void;
  className?: string;
}

export function GroupCard({
  groupName,
  memberCount,
  contributionAmount,
  currency = 'XLM',
  status = 'active',
  onClick,
  onViewDetails,
  onJoin,
  className = '',
}: GroupCardProps) {
  const classes = ['group-card', className].filter(Boolean).join(' ');

  const handleCardClick = (e: React.MouseEvent) => {
    // Prevent card click when clicking buttons
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }
    onClick?.();
  };

  const getStatusVariant = () => {
    switch (status) {
      case 'active':
        return 'success';
      case 'completed':
        return 'info';
      case 'pending':
        return 'warning';
      default:
        return 'primary';
    }
  };

  return (
    <div className={classes} onClick={handleCardClick}>
      <div className="group-card-header">
        <h3 className="group-card-title">{groupName}</h3>
        <Badge variant={getStatusVariant()} size="sm">
          {status}
        </Badge>
      </div>

      <div className="group-card-body">
        <div className="group-card-stats">
          <div className="group-card-stat">
            <span className="group-card-stat-label">Members</span>
            <span className="group-card-stat-value">{memberCount}</span>
          </div>
          <div className="group-card-stat">
            <span className="group-card-stat-label">Total Contributions</span>
            <span className="group-card-stat-value">
              {contributionAmount.toLocaleString()} {currency}
            </span>
          </div>
        </div>
      </div>

      <div className="group-card-footer">
        {onViewDetails && (
          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails();
            }}
          >
            View Details
          </Button>
        )}
        {onJoin && (
          <Button
            variant="primary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onJoin();
            }}
          >
            Join Group
          </Button>
        )}
      </div>
    </div>
  );
}
