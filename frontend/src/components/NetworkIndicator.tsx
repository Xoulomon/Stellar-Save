import { useWallet } from '../hooks/useWallet';
import './NetworkIndicator.css';

export function NetworkIndicator() {
  const { network } = useWallet();

  const currentNetwork = network || 'testnet';

  return (
    <div className="network-indicator-container">
      <span
        className={`network-indicator network-${currentNetwork}`}
        aria-label={`Current network: ${currentNetwork}`}
      >
        <span className="network-dot" aria-hidden="true" />
        <span className="network-name">{currentNetwork}</span>
      </span>
    </div>
  );
}
