# feat: Add useBalance hook for fetching XLM balance

## Description

This PR adds a comprehensive `useBalance` hook for fetching and managing Stellar account XLM balance with auto-refresh and error handling.

## Features

✅ **XLM Balance Fetching**: Fetches XLM balance from Stellar Horizon API  
✅ **Auto-refresh**: Configurable auto-refresh interval (default: 30 seconds)  
✅ **Error Handling**: Comprehensive error handling with user-friendly messages  
✅ **Loading States**: Proper loading and error states  
✅ **Manual Refresh**: Manual refresh capability  
✅ **Network Support**: Supports both testnet and mainnet  
✅ **All Balances**: Fetches all account balances including assets  
✅ **Cleanup**: Automatic cleanup on unmount with request cancellation  

## Files Added

- `frontend/src/hooks/useBalance.ts` - Main hook implementation (270 lines)
- `frontend/src/hooks/useBalance.README.md` - Comprehensive documentation
- `frontend/src/hooks/index.ts` - Hooks barrel export
- `frontend/src/components/BalanceDisplay.tsx` - Demo component (147 lines)
- `frontend/src/components/BalanceDisplay.css` - Component styles (170 lines)

## Files Modified

- `frontend/src/components/index.ts` - Added BalanceDisplay export
- `frontend/src/components/ContributeButton.tsx` - Fixed syntax errors (missing `<` in Record type, missing `<a` tag, updated imports)
- `frontend/src/components/PayoutQueue.tsx` - Fixed syntax errors (missing `<a` tag, updated imports)
- `frontend/src/test/utils.test.ts` - Fixed missing closing brace

## Usage Example

```tsx
import { useBalance } from '../hooks/useBalance';

function MyComponent() {
  const { xlmBalance, isLoading, error, refresh } = useBalance({
    refreshInterval: 30000,
    fetchOnMount: true
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <p>Balance: {xlmBalance} XLM</p>
      <button onClick={refresh}>Refresh</button>
    </div>
  );
}
```

## API Reference

### Hook Options

```typescript
interface UseBalanceOptions {
  refreshInterval?: number;  // Auto-refresh interval in ms (default: 30000)
  fetchOnMount?: boolean;    // Fetch immediately on mount (default: true)
  horizonUrl?: string;       // Custom Horizon server URL
}
```

### Return Value

```typescript
{
  xlmBalance: string | null;        // XLM balance as string
  allBalances: Balance[];           // All account balances
  isLoading: boolean;               // Loading state
  error: string | null;             // Error message
  lastUpdated: Date | null;         // Last update timestamp
  refresh: () => Promise<void>;     // Manual refresh function
  hasAddress: boolean;              // Whether wallet is connected
}
```

## Testing

- ✅ All new files compile without TypeScript errors
- ✅ Fixed pre-existing syntax errors in ContributeButton and PayoutQueue
- ✅ Updated imports to use type-only imports for verbatimModuleSyntax compliance
- ✅ Build passes successfully (verified with `npm run build`)
- ✅ No errors in useBalance.ts or BalanceDisplay.tsx

## Documentation

Comprehensive documentation is included in `useBalance.README.md` with:
- Complete API reference
- Multiple usage examples
- Error handling guide
- Network support details
- Performance considerations
- Troubleshooting tips

## Implementation Details

### Error Handling

The hook provides user-friendly error messages for common scenarios:
- Account not found (unfunded account)
- Network timeouts
- Connection errors
- Generic API errors

### Performance Optimizations

- Uses `useCallback` to memoize functions
- Uses `useRef` to avoid unnecessary re-renders
- Cancels pending requests on unmount
- Pauses auto-refresh when no wallet is connected

### Network Support

Automatically selects the correct Horizon server based on wallet network:
- Testnet: `https://horizon-testnet.stellar.org`
- Mainnet: `https://horizon.stellar.org`
- Custom: Configurable via `horizonUrl` option

## Breaking Changes

None. This is a new feature addition.

## Migration Guide

Not applicable (new feature).

## Checklist

- [x] Code follows project style guidelines
- [x] Self-review completed
- [x] Comments added for complex code
- [x] Documentation updated
- [x] No new warnings generated
- [x] Tests pass locally
- [x] TypeScript compilation successful
- [x] Fixed pre-existing errors in other files

## Screenshots

The `BalanceDisplay` component provides a ready-to-use UI for displaying balance:
- Shows XLM balance with proper formatting
- Displays loading state with spinner
- Shows error messages with icons
- Includes manual refresh button
- Optional display of all account assets
- Shows last update timestamp

## Additional Notes

This PR also fixes several pre-existing TypeScript errors:
1. Missing `<` in `Record` type definition in ContributeButton.tsx
2. Missing `<a` opening tags in ContributeButton.tsx and PayoutQueue.tsx
3. Incorrect React import (removed default import)
4. Missing type-only imports for verbatimModuleSyntax compliance
5. Missing closing brace in utils.test.ts

All fixes are minimal and focused on syntax errors that prevented compilation.

## Next Steps

After this PR is merged, the hook can be integrated into:
- Dashboard page to show user balance
- Group detail pages to show available funds
- Contribution flows to validate sufficient balance
- Wallet connection UI to display current balance

---

**Branch**: `feature/useBalance-hook`  
**Base**: `main`  
**Commits**: 2  
**Files Changed**: 9  
**Lines Added**: 867  
**Lines Removed**: 8
