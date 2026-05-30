# useBalance Hook

A React hook for fetching and managing Stellar account XLM balance with auto-refresh and error handling.

## Features

- ✅ Fetches XLM balance from Stellar Horizon API
- ✅ Auto-refresh with configurable interval
- ✅ Comprehensive error handling with user-friendly messages
- ✅ Loading states
- ✅ Manual refresh capability
- ✅ Supports both testnet and mainnet
- ✅ Fetches all account balances (including assets)
- ✅ Automatic cleanup on unmount
- ✅ Request cancellation support

## Installation

The hook is already included in the project. Import it from the hooks directory:

```tsx
import { useBalance } from '../hooks/useBalance';
// or
import { useBalance } from '../hooks';
```

## Basic Usage

```tsx
import { useBalance } from '../hooks/useBalance';

function MyComponent() {
  const { xlmBalance, isLoading, error } = useBalance();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return <div>Balance: {xlmBalance} XLM</div>;
}
```

## Advanced Usage

### With Custom Options

```tsx
const {
  xlmBalance,
  allBalances,
  isLoading,
  error,
  lastUpdated,
  refresh,
  hasAddress,
} = useBalance({
  refreshInterval: 60000, // Refresh every 60 seconds
  fetchOnMount: true,     // Fetch immediately on mount
  horizonUrl: 'https://horizon-testnet.stellar.org', // Custom Horizon server
});
```

### Manual Refresh

```tsx
function BalanceWithRefresh() {
  const { xlmBalance, refresh, isLoading } = useBalance();

  return (
    <div>
      <p>Balance: {xlmBalance} XLM</p>
      <button onClick={refresh} disabled={isLoading}>
        Refresh
      </button>
    </div>
  );
}
```

### Display All Balances

```tsx
function AllBalances() {
  const { allBalances } = useBalance();

  return (
    <div>
      {allBalances.map((balance, index) => (
        <div key={index}>
          {balance.asset_type === 'native' ? 'XLM' : balance.asset_code}:
          {balance.balance}
        </div>
      ))}
    </div>
  );
}
```

### Disable Auto-Refresh

```tsx
const { xlmBalance } = useBalance({
  refreshInterval: 0, // Disable auto-refresh
});
```

## API Reference

### Options

```typescript
interface UseBalanceOptions {
  /**
   * Auto-refresh interval in milliseconds
   * Set to 0 to disable auto-refresh
   * @default 30000 (30 seconds)
   */
  refreshInterval?: number;
  
  /**
   * Whether to fetch balance immediately on mount
   * @default true
   */
  fetchOnMount?: boolean;
  
  /**
   * Custom Horizon server URL
   * @default 'https://horizon-testnet.stellar.org' for testnet
   */
  horizonUrl?: string;
}
```

### Return Value

```typescript
{
  /**
   * XLM balance as a string (e.g., "100.5000000")
   */
  xlmBalance: string | null;
  
  /**
   * All account balances including assets
   */
  allBalances: Balance[];
  
  /**
   * Whether balance is currently being fetched
   */
  isLoading: boolean;
  
  /**
   * Error message if fetch failed
   */
  error: string | null;
  
  /**
   * Timestamp of last successful fetch
   */
  lastUpdated: Date | null;
  
  /**
   * Manually trigger a balance refresh
   */
  refresh: () => Promise<void>;
  
  /**
   * Whether the hook has an active address to fetch balance for
   */
  hasAddress: boolean;
}
```

### Balance Type

```typescript
interface Balance {
  asset_type: string;
  balance: string;
  asset_code?: string;
  asset_issuer?: string;
}
```

## Error Handling

The hook provides user-friendly error messages for common scenarios:

- **Account not found**: "Account not found. The account may not be funded yet."
- **Timeout**: "Request timed out. Please check your connection."
- **Network error**: "Network error. Please check your internet connection."
- **Generic error**: The actual error message from the API

## Network Support

The hook automatically determines the correct Horizon server based on the connected wallet's network:

- **Testnet**: `https://horizon-testnet.stellar.org`
- **Mainnet/Public**: `https://horizon.stellar.org`
- **Custom**: Use the `horizonUrl` option to specify a custom server

## Performance Considerations

- The hook automatically cancels pending requests when unmounting or when a new request is initiated
- Auto-refresh is paused when there's no active wallet address
- The hook uses `useCallback` and `useRef` to optimize performance and prevent unnecessary re-renders

## Example Component

See [`BalanceDisplay.tsx`](../components/BalanceDisplay.tsx) for a complete example of using the hook in a component with:
- Loading states
- Error display
- Manual refresh button
- Auto-refresh indicator
- All balances display

## Dependencies

- `react`: For hooks (useState, useEffect, useCallback, useRef)
- `@stellar/stellar-sdk`: For Horizon API integration
- `useWallet`: For wallet connection state

## Testing

The hook can be tested by:

1. Connecting a wallet with the `useWallet` hook
2. Observing the balance fetch and auto-refresh behavior
3. Testing error scenarios (disconnected wallet, network errors, etc.)

## Troubleshooting

### Balance not loading

- Ensure the wallet is connected via `useWallet`
- Check that the account is funded (minimum 1 XLM for testnet)
- Verify network connectivity

### Auto-refresh not working

- Check that `refreshInterval` is greater than 0
- Ensure the component is still mounted
- Verify that there's an active wallet address

### Wrong network

- The hook uses the network from `useWallet`
- Ensure the wallet is connected to the correct network
- Use the `horizonUrl` option to override the default server

## License

Part of the Stellar-Save project.
