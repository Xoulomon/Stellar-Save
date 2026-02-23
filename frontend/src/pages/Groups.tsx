import { Link } from 'react-router-dom';
import { useGroups } from '../store';
import { ROUTES } from '../constants/routes';

export default function Groups() {
  const groups = useGroups();

  return (
    <div className="groups-page">
      <header>
        <h1>Savings Groups</h1>
        <Link to={ROUTES.CREATE_GROUP} className="button primary">
          Create New Group
        </Link>
      </header>

      <section className="groups-list">
        {groups.length === 0 ? (
          <div className="empty-state">
            <p>No groups yet. Create your first savings group!</p>
            <Link to={ROUTES.CREATE_GROUP} className="button">
              Create Group
            </Link>
          </div>
        ) : (
          <div className="groups-grid">
            {groups.map((group) => (
              <Link
                key={group.id}
                to={ROUTES.GROUP_DETAIL.replace(':groupId', group.id)}
                className="group-card"
              >
                <h3>{group.name}</h3>
                <p>Target: {group.targetAmount} XLM</p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
