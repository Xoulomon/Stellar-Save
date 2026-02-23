import { Link } from 'react-router-dom';
import { useWallet, useGroups } from '../store';
import { ROUTES } from '../constants/routes';

export default function Dashboard() {
  const wallet = useWallet();
  const groups = useGroups();

  return (
    <div className="dashboard-page">
      <header>
        <h1>Dashboard</h1>
        <p>Welcome back, {wallet.address?.slice(0, 8)}...</p>
      </header>

      <section className="stats">
        <div className="stat-card">
          <h3>Total Groups</h3>
          <p>{groups.length}</p>
        </div>
        <div className="stat-card">
          <h3>Network</h3>
          <p>{wallet.network}</p>
        </div>
      </section>

      <section className="actions">
        <Link to={ROUTES.GROUPS} className="button">
          View All Groups
        </Link>
        <Link to={ROUTES.CREATE_GROUP} className="button primary">
          Create New Group
        </Link>
      </section>
    </div>
  );
}
