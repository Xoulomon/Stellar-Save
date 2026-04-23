import { useBalance } from "../hooks/useBalance";
import { Card } from "./Card";
import { Spinner } from "./Spinner";
import "./BalanceDisplay.css";

export interface BalanceDisplayProps {
  /**
   * Auto-refresh interval in milliseconds
   * @default 30000
   */
  refreshInterval?: number;

  /**
   * Whether to show all balances or just XLM
   * @default false
   */
  showAllBalances?: boolean;

  /**
   * Custom CSS class name
   */
  className?: string;
}

/**
 * Component to display account balance with auto-refresh
 *
 * @example
 * ```tsx
 * <BalanceDisplay refreshInterval={30000} showAllBalances={false} />
 * ```
 */
export function BalanceDisplay({
  refreshInterval = 30000,
  showAllBalances = false,
  className = "",
}: BalanceDisplayProps) {
  const {
    xlmBalance,
    allBalances,
    isLoading,
    error,
    lastUpdated,
    refresh,
    hasAddress,
  } = useBalance({ refreshInterval });

  // Format balance for display
  const formatBalance = (balance: string | null): string => {
    if (!balance) return "0.00";
    const num = parseFloat(balance);
    return num.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 7,
    });
  };

  // Format timestamp
  const formatTimestamp = (date: Date | null): string => {
    if (!date) return "Never";
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);

    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  if (!hasAddress) {
    return (
      <Card className={`balance-display ${className}`}>
        <div className="balance-display__empty">
          <p>Connect your wallet to view balance</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`balance-display ${className}`}>
      <div className="balance-display__header">
        <h3 className="balance-display__title">Account Balance</h3>
        <button
          className="balance-display__refresh"
          onClick={refresh}
          disabled={isLoading}
          aria-label="Refresh balance"
        >
          <span
            className={`balance-display__refresh-icon ${isLoading ? "spinning" : ""}`}
          >
            ↻
          </span>
        </button>
      </div>

      {error && (
        <div className="balance-display__error">
          <span className="balance-display__error-icon">⚠️</span>
          <span className="balance-display__error-message">{error}</span>
        </div>
      )}

      {isLoading && !xlmBalance ? (
        <div className="balance-display__loading">
          <Spinner size="md" />
          <p>Loading balance...</p>
        </div>
      ) : (
        <>
          <div className="balance-display__main">
            <div className="balance-display__xlm">
              <span className="balance-display__amount">
                {formatBalance(xlmBalance)}
              </span>
              <span className="balance-display__currency">XLM</span>
            </div>
            {lastUpdated && (
              <div className="balance-display__timestamp">
                Updated {formatTimestamp(lastUpdated)}
              </div>
            )}
          </div>

          {showAllBalances && allBalances.length > 1 && (
            <div className="balance-display__all-balances">
              <h4 className="balance-display__subtitle">All Assets</h4>
              <div className="balance-display__assets">
                {allBalances.map((balance, index) => (
                  <div key={index} className="balance-display__asset">
                    <span className="balance-display__asset-code">
                      {balance.asset_type === "native"
                        ? "XLM"
                        : balance.asset_code || "Unknown"}
                    </span>
                    <span className="balance-display__asset-balance">
                      {formatBalance(balance.balance)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
