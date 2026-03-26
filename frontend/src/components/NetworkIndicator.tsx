import { useState } from 'react';
import { useWallet } from '../hooks/useWallet';
import './NetworkIndicator.css';

const NETWORKS = ['testnet', 'mainnet', 'futurenet'] as const;

export function NetworkIndicator() {
  const { network } = useWallet();
  const [showSwitcher, setShowSwitcher] = useState(false);

  const currentNetwork = network || 'testnet';

  const handleNetworkSwitch = (newNetwork: string) => {
    // TODO: Implement network switching logic
    console.log('Switching to:', newNetwork);
    setShowSwitcher(false);
  };

  return (
    <div className="network-indicator-container">
      <button
        className={`network-indicator network-${currentNetwork}`}
        onClick={() => setShowSwitcher(!showSwitcher)}
      >
        <span className="network-dot" />
        <span className="network-name">{currentNetwork}</span>
      </button>

      {showSwitcher && (
        <div className="network-switcher">
          {NETWORKS.map((net) => (
            <button
              key={net}
              className={`network-option ${net === currentNetwork ? 'active' : ''}`}
              onClick={() => handleNetworkSwitch(net)}
            >
              <span className={`network-dot network-${net}`} />
              <span>{net}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
