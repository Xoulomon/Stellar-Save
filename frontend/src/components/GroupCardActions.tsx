import { Button } from './Button';

interface GroupCardActionsProps {
  onViewDetails?: () => void;
  onJoin?: () => void;
  /** Group name, used to construct contextual aria-labels for screen readers */
  groupName?: string;
}

export function GroupCardActions({ onViewDetails, onJoin, groupName }: GroupCardActionsProps) {
  const label = groupName ? ` ${groupName}` : '';

  return (
    <div className="group-card-footer">
      {onViewDetails && (
        <Button
          variant="secondary"
          size="sm"
          onClick={(e) => { e.stopPropagation(); onViewDetails(); }}
          aria-label={`View details${label}`}
        >
          View Details
        </Button>
      )}
      {onJoin && (
        <Button
          variant="primary"
          size="sm"
          onClick={(e) => { e.stopPropagation(); onJoin(); }}
          aria-label={`Join group${label}`}
        >
          Join Group
        </Button>
      )}
    </div>
  );
}
