import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';
import { Button } from './Button';

export const Navbar: React.FC = () => {
  const { activeAddress, status, connect, disconnect } = useWallet();
  const navigate = useNavigate();
  const isConnected = status === 'connected';
  const loading = status === 'connecting';

  const handleConnect = async () => {
    await connect();
    if (isConnected) {
      navigate('/dashboard');
    }
  };

  const formatAddress = (key: string) => `${key.slice(0, 6)}...${key.slice(-4)}`;

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-brand">
          <Link to="/">StellarSave</Link>
        </div>
        <div className="navbar-links">
          <Link to="/dashboard" className="nav-link">Dashboard</Link>
          <Link to="/create-group" className="nav-link">Create Group</Link>
          <Link to="/my-groups" className="nav-link">My Groups</Link>
        </div>
        <div className="navbar-wallet">
          {isConnected && activeAddress ? (
            <div className="wallet-connected">
              <span className="wallet-address">{formatAddress(activeAddress)}</span>
              <Button variant="secondary" size="sm" onClick={disconnect}>Disconnect</Button>
            </div>
          ) : (
            <Button onClick={handleConnect} loading={loading} disabled={loading}>
              Connect Wallet
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
};