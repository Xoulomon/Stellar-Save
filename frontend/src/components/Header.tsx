import { useState } from 'react';
import { isConnected, getPublicKey, requestAccess } from '@stellar/freighter-api';
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
        <div className="header-logo">
          <span className="logo-icon">⭐</span>
          <span className="logo-text">Stellar-Save</span>
        </div>

        <button 
          className="menu-toggle"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Toggle menu"
        >
          ☰
        </button>

        <nav className={`header-nav ${isMenuOpen ? 'open' : ''}`}>
          <a href="#groups">Groups</a>
          <a href="#create">Create</a>
          <a href="#about">About</a>
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
