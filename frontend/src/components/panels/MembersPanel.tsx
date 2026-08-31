import { formatAmount } from '../../utils/format';
import { Avatar } from '../Avatar';
import { Badge } from '../Badge';

import type { GroupMember } from '../../utils/groupApi';

interface MembersPanelProps {
  members: GroupMember[];
  onMemberClick?: (member: GroupMember) => void;
}

export function MembersPanel({ members, onMemberClick }: MembersPanelProps) {
  return (
    <div className="group-details-members">
      <div className="group-details-members-header">
        <h4>Members ({members.length})</h4>
      </div>
      <div className="group-details-members-list">
        {members.map((member) => (
          <div
            key={member.id}
            className={`group-details-member-item ${onMemberClick ? 'group-details-member-clickable' : ''}`}
            onClick={() => onMemberClick?.(member)}
          >
            <Avatar name={member.name || member.address} size="md" />
            <div className="group-details-member-info">
              <div className="group-details-member-name">{member.name || 'Anonymous'}</div>
              <div className="group-details-member-address">
                {member.address.substring(0, 8)}...
                {member.address.substring(member.address.length - 6)}
              </div>
            </div>
            <div className="group-details-member-stats">
              <div className="group-details-member-contributions">
                {formatAmount(member.totalContributions)}
              </div>
              <Badge variant={member.isActive ? 'success' : 'secondary'} size="sm">
                {member.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
