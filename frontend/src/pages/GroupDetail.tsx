import { useParams, Link, Navigate } from 'react-router-dom';
import { useGroups } from '../store';
import { ROUTES } from '../constants/routes';

export default function GroupDetail() {
  const { groupId } = useParams<{ groupId: string }>();
  const groups = useGroups();

  const group = groups.find((g) => g.id === groupId);

  if (!group) {
    return <Navigate to={ROUTES.NOT_FOUND} replace />;
  }

  return (
    <div className="group-detail-page">
      <header>
        <Link to={ROUTES.GROUPS} className="back-link">
          ← Back to Groups
        </Link>
        <h1>{group.name}</h1>
      </header>

      <section className="group-info">
        <div className="info-card">
          <h3>Target Amount</h3>
          <p>{group.targetAmount} XLM</p>
        </div>
        <div className="info-card">
          <h3>Group ID</h3>
          <p>{group.id}</p>
        </div>
      </section>

      <section className="group-actions">
        <button className="button primary">Contribute</button>
        <button className="button">View Members</button>
      </section>
    </div>
  );
}
