import { formatAddress } from '@shared-utils/formatting';
import { memo, useState, useMemo } from 'react';

import './MemberList.css';
import { Avatar } from './Avatar';
import { Badge } from './Badge';
import { Card } from './Card';

type SortField = 'address' | 'contribution' | 'payout';
type SortOrder = 'asc' | 'desc';

export interface Member {
  address: string;
  hasContributed: boolean;
  hasPaidOut: boolean;
}

interface MemberListProps {
  members: Member[];
  className?: string;
}

function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return formatAddress(address);
}

/**
 * A single row. Memoized so that re-sorting or a parent re-render with
 * unchanged member objects does not re-render every row.
 */
const MemberRow = memo(function MemberRow({ member }: { member: Member }) {
  return (
    <div className="member-row">
      <div className="member-info">
        <Avatar name={member.address} size="sm" />
        <span className="member-address" title={member.address}>
          {truncateAddress(member.address)}
        </span>
      </div>
      <div className="member-status">
        <Badge variant={member.hasContributed ? 'success' : 'secondary'} size="sm">
          {member.hasContributed ? '✓' : '○'}
        </Badge>
      </div>
      <div className="member-status">
        <Badge variant={member.hasPaidOut ? 'success' : 'secondary'} size="sm">
          {member.hasPaidOut ? '✓' : '○'}
        </Badge>
      </div>
    </div>
  );
});

export function MemberList({ members, className = '' }: MemberListProps) {
  const [sortField, setSortField] = useState<SortField>('address');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'address':
          comparison = a.address.localeCompare(b.address);
          break;
        case 'contribution':
          comparison = Number(a.hasContributed) - Number(b.hasContributed);
          break;
        case 'payout':
          comparison = Number(a.hasPaidOut) - Number(b.hasPaidOut);
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [members, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return '↕';
    return sortOrder === 'asc' ? '↑' : '↓';
  };

  return (
    <Card className={`member-list ${className}`} variant="outlined">
      <div className="member-list-header">
        <h3 className="member-list-title">Members ({members.length})</h3>
      </div>

      <div className="member-list-table">
        <div className="member-list-table-header">
          <button
            className="sort-button"
            onClick={() => handleSort('address')}
            aria-label="Sort by address"
          >
            Member {getSortIcon('address')}
          </button>
          <button
            className="sort-button"
            onClick={() => handleSort('contribution')}
            aria-label="Sort by contribution status"
          >
            Contributed {getSortIcon('contribution')}
          </button>
          <button
            className="sort-button"
            onClick={() => handleSort('payout')}
            aria-label="Sort by payout status"
          >
            Paid Out {getSortIcon('payout')}
          </button>
        </div>

        <div className="member-list-body">
          {sortedMembers.map((member) => (
            <MemberRow key={member.address} member={member} />
          ))}
        </div>
      </div>

      {members.length === 0 && <div className="member-list-empty">No members yet</div>}
    </Card>
  );
}
