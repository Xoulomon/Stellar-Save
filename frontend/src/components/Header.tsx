import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ROUTES } from '../routing/constants';
import { ThemeToggle } from './ThemeToggle';
import { useWallet } from '../hooks/useWallet';
import { WalletIntegration } from './WalletIntegration';
import './Header.css';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { status, activeAddress } = useWallet();

  // Redirect to dashboard on successful wallet connection
  useEffect(() => {
    if (status === 'connected' && activeAddress) {
      navigate(ROUTES.DASHBOARD);
    }
  }, [status, activeAddress, navigate]);

  return (
    <header className="header">
      <div className="header-container">
        <Link to={ROUTES.HOME} className="header-logo" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className="logo-icon">⭐</span>
          <span className="logo-text">Stellar-Save</span>
        </Link>

        <button 
          className="menu-toggle"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Toggle menu"
        >
          ☰
        </button>

        <nav className={`header-nav ${isMenuOpen ? 'open' : ''}`} aria-label="Main navigation">
          <Link to={ROUTES.GROUPS}>Groups</Link>
          <Link to={ROUTES.DASHBOARD}>Dashboard</Link>
          <Link to={ROUTES.PROFILE}>Profile</Link>
        </nav>

        <ThemeToggle />

        <div className="wallet-integration-wrapper">
          <WalletIntegration />
        </div>
      </div>
    </header>
  );
}
