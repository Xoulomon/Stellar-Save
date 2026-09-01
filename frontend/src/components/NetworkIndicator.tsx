import { useState } from 'react';

import { useWallet } from '../hooks/useWallet';
import './NetworkIndicator.css';

const NETWORKS = ['testnet', 'mainnet', 'futurenet'] as const;

export function NetworkIndicator() {
  const { network } = useWallet();
  const [showSwitcher, setShowSwitcher] = useState(false);

  const currentNetwork = network || 'testnet';

  const handleNetworkSwitch = (_newNetwork: string) => {
    // TODO: Implement network switching logic
    setShowSwitcher(false);
  };

  return (
    <div className="network-indicator-container">
      <button
        className={`network-indicator network-${currentNetwork}`}
        onClick={() => setShowSwitcher(!showSwitcher)}
        aria-label={`Current network: ${currentNetwork}. Click to switch network`}
        aria-expanded={showSwitcher}
        aria-haspopup="listbox"
      >
        <span className="network-dot" aria-hidden="true" />
        <span className="network-name">{currentNetwork}</span>
      </button>

      {showSwitcher && (
        <div className="network-switcher" role="listbox" aria-label="Select network">
          {NETWORKS.map((net) => (
            <button
              key={net}
              className={`network-option ${net === currentNetwork ? 'active' : ''}`}
              onClick={() => handleNetworkSwitch(net)}
              role="option"
              aria-selected={net === currentNetwork}
              aria-label={`Switch to ${net}`}
            >
              <span className={`network-dot network-${net}`} aria-hidden="true" />
              <span>{net}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
