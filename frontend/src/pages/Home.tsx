import { Link } from 'react-router-dom';
import { useWallet } from '../store';
import { ROUTES } from '../constants/routes';

export default function Home() {
  const wallet = useWallet();

  return (
    <div className="home-page">
      <header>
        <h1>Stellar Save</h1>
        <p>Decentralized Rotational Savings on Stellar</p>
      </header>

      <section className="hero">
        <h2>Welcome to Stellar Save</h2>
        <p>
          A trustless, transparent, and accessible way to participate in
          traditional community-based savings groups (ROSCA) on the blockchain.
        </p>

        {wallet.isConnected ? (
          <Link to={ROUTES.DASHBOARD} className="cta-button">
            Go to Dashboard
          </Link>
        ) : (
          <p>Please connect your wallet to get started</p>
        )}
      </section>

      <section className="features">
        <h3>Features</h3>
        <ul>
          <li>Create and join savings groups</li>
          <li>Automatic payouts with smart contracts</li>
          <li>Transparent on-chain transactions</li>
          <li>Native XLM support</li>
        </ul>
      </section>
    </div>
  );
}
