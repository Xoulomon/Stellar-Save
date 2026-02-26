import { Badge } from './Badge';
import './GroupBadge.css';

export type GroupBadgeStatus = 'active' | 'pending' | 'complete' | 'completed';

interface GroupBadgeProps {
  status: GroupBadgeStatus;
  className?: string;
  showIcon?: boolean;
}

type NormalizedStatus = 'active' | 'pending' | 'complete';

function normalizeStatus(status: GroupBadgeStatus): NormalizedStatus {
  if (status === 'completed') {
    return 'complete';
  }

  return status;
}

function getStatusVariant(status: NormalizedStatus): 'success' | 'warning' | 'info' {
  switch (status) {
    case 'active':
      return 'success';
    case 'pending':
      return 'warning';
    case 'complete':
      return 'info';
    default:
      return 'info';
  }
}

function getStatusLabel(status: GroupBadgeStatus): string {
  switch (status) {
    case 'active':
      return 'active';
    case 'pending':
      return 'pending';
    case 'complete':
      return 'complete';
    case 'completed':
      return 'completed';
    default:
      return 'completed';
  }
}

function getStatusIcon(status: NormalizedStatus): React.ReactNode {
  switch (status) {
    case 'active':
      return (
        <svg
          className="group-badge-icon"
          viewBox="0 0 16 16"
          width="12"
          height="12"
          aria-hidden="true"
          focusable="false"
        >
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M5.5 8.1L7.2 9.8L10.8 6.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case 'pending':
      return (
        <svg
          className="group-badge-icon"
          viewBox="0 0 16 16"
          width="12"
          height="12"
          aria-hidden="true"
          focusable="false"
        >
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 4.5V8L10.5 9.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case 'complete':
      return (
        <svg
          className="group-badge-icon"
          viewBox="0 0 16 16"
          width="12"
          height="12"
          aria-hidden="true"
          focusable="false"
        >
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M5.5 8.2L7.2 9.8L10.8 6.1" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    default:
      return null;
  }
}

export function GroupBadge({ status, className = '', showIcon = true }: GroupBadgeProps) {
  const normalizedStatus = normalizeStatus(status);

  return (
    <Badge
      variant={getStatusVariant(normalizedStatus)}
      size="sm"
      className={['group-badge', className].filter(Boolean).join(' ')}
      icon={showIcon ? getStatusIcon(normalizedStatus) : undefined}
    >
      {getStatusLabel(status)}
    </Badge>
  );
}
