import { GroupBadge, type GroupBadgeStatus } from './GroupBadge';

interface GroupCardHeaderProps {
  groupName: string;
  status: GroupBadgeStatus;
  description?: string;
  imageUrl?: string;
}

export function GroupCardHeader({ groupName, status, description, imageUrl }: GroupCardHeaderProps) {
  return (
    <>
      {imageUrl && (
        <div className="group-card-image">
          <img src={imageUrl} alt={groupName} />
        </div>
      )}

      <div className="group-card-header">
        <h3 className="group-card-title">{groupName}</h3>
        <GroupBadge status={status} />
      </div>

      {description && (
        <div className="group-card-description">
          <p>{description}</p>
        </div>
      )}
    </>
  );
}
