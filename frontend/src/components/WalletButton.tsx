/**
 * WalletButton — Issue #443
 * Thin wrapper that renders WalletIntegration in the header/nav context.
 * WalletIntegration handles: connection, selection UI, disconnection,
 * address storage, transaction signing, error handling, status indicator.
 */
import { WalletIntegration } from './WalletIntegration';
import './WalletButton.css';

export function WalletButton() {
  return <WalletIntegration />;
}
