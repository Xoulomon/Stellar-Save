import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useWallet } from '../wallet/WalletProvider';
import { Button } from './Button';

export const Navbar: React.FC = () => {
  const { publicKey, isConnected, connect, disconnect, loading } = useWallet();
  const navigate = useNavigate();

  const handleConnect = async () => {
    await connect();
    // Redirect to dashboard after successful connection
    if (!isConnected) {
      navigate('/dashboard');
    }
  };

  const formatPublicKey = (key: string) => {
    return `${key.slice(0, 6)}...${key.slice(-4)}`;
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        {/* Logo */}
        <div className="navbar-brand">
          <Link to="/">StellarSave</Link>
        </div>

        {/* Navigation Links */}
        <div className="navbar-links">
          <Link to="/dashboard" className="nav-link">Dashboard</Link>
          <Link to="/create-group" className="nav-link">Create Group</Link>
          <Link to="/my-groups" className="nav-link">My Groups</Link>
        </div>

        {/* Wallet Section */}
        <div className="navbar-wallet">
          {isConnected && publicKey ? (
            <div className="wallet-connected">
              <span className="wallet-address">
                {formatPublicKey(publicKey)}
              </span>
              <Button 
                variant="secondary" 
                size="sm"
                onClick={disconnect}
              >
                Disconnect
              </Button>
            </div>
          ) : (
            <Button 
              onClick={handleConnect} 
              loading={loading}
              disabled={loading}
            >
              Connect Freighter
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
};