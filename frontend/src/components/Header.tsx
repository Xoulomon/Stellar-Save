import { useState } from 'react';
import { Link } from 'react-router-dom';
import { isConnected, getPublicKey, requestAccess } from '@stellar/freighter-api';
import { ROUTES } from '../routing/constants';
import './Header.css';

export default function Header() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const connectWallet = async () => {
    try {
      if (await isConnected()) {
        await requestAccess();
        const publicKey = await getPublicKey();
        setWalletAddress(publicKey);
      }
    } catch (error) {
      console.error('Wallet connection failed:', error);
    }
  };

  const formatAddress = (address: string) => 
    `${address.slice(0, 4)}...${address.slice(-4)}`;

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

        <nav className={`header-nav ${isMenuOpen ? 'open' : ''}`}>
          <Link to={ROUTES.GROUPS}>Groups</Link>
          <Link to={ROUTES.DASHBOARD}>Dashboard</Link>
          <Link to={ROUTES.PROFILE}>Profile</Link>
        </nav>

        <button 
          className="wallet-button"
          onClick={connectWallet}
        >
          {walletAddress ? formatAddress(walletAddress) : 'Connect Wallet'}
        </button>
      </div>
    </header>
  );
}
