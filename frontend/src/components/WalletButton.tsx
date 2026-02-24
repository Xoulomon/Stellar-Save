import { useState } from 'react';
import { useWallet } from '../hooks/useWallet';
import { useAuthRedirect } from '../routing/useAuthRedirect';
import { Button } from './Button';
import './WalletButton.css';

export function WalletButton() {
  const { status, activeAddress, connect, disconnect } = useWallet();
  const [showMenu, setShowMenu] = useState(false);
  const [balance] = useState('0.00'); // TODO: Fetch actual balance
  
  // Handle post-authentication redirect
  useAuthRedirect();

  if (status === 'connected' && activeAddress) {
    return (
      <div className="wallet-button-container">
        <Button
          variant="secondary"
          onClick={() => setShowMenu(!showMenu)}
          className="wallet-button-connected"
        >
          <span className="wallet-address">
            {activeAddress.slice(0, 6)}...{activeAddress.slice(-4)}
          </span>
          <span className="wallet-balance">{balance} XLM</span>
        </Button>
        {showMenu && (
          <div className="wallet-menu">
            <div className="wallet-menu-item wallet-menu-address">
              {activeAddress}
            </div>
            <div className="wallet-menu-item wallet-menu-balance">
              Balance: {balance} XLM
            </div>
            <button
              className="wallet-menu-item wallet-menu-disconnect"
              onClick={() => {
                disconnect();
                setShowMenu(false);
              }}
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <Button
      onClick={() => void connect()}
      loading={status === 'connecting'}
      disabled={status === 'connecting'}
    >
      {status === 'connecting' ? 'Connecting...' : 'Connect Wallet'}
    </Button>
  );
}
