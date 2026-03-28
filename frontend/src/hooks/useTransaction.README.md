# useTransaction

A React hook for handling Stellar transaction submission and tracking.

## Features

- Submit transactions with automatic signing via Freighter
- Track transaction status (idle, signing, submitting, pending, success, failed)
- Handle errors with user-friendly messages
- Show notifications for transaction events
- Support for custom transaction builders

## Usage

```typescript
import { useTransaction } from '../hooks';

function MyComponent() {
  const { status, txHash, error, isLoading, submitTransaction, reset } = useTransaction();

  const handleSubmit = async () => {
    const result = await submitTransaction(async () => {
      // Build your transaction operation here
      return operation; // xdr.Operation
    });

    if (result.status === 'success') {
      console.log('Transaction successful:', result.txHash);
    } else {
      console.error('Transaction failed:', result.error);
    }
  };

  return (
    <div>
      <button onClick={handleSubmit} disabled={isLoading}>
        {isLoading ? 'Submitting...' : 'Submit Transaction'}
      </button>
      {status === 'success' && <p>Transaction confirmed: {txHash}</p>}
      {status === 'failed' && <p>Error: {error}</p>}
    </div>
  );
}
```

## API

### Return Value

- `status`: Current transaction status (`'idle' | 'signing' | 'submitting' | 'pending' | 'success' | 'failed'`)
- `txHash`: Transaction hash when successful (string | null)
- `error`: Error message when failed (string | null)
- `isLoading`: Whether a transaction is in progress (boolean)
- `submitTransaction`: Function to submit a transaction
- `reset`: Function to reset the hook state

### submitTransaction

```typescript
submitTransaction(buildTx: () => Promise<xdr.Operation>): Promise<TransactionResult>
```

- `buildTx`: Async function that returns an XDR operation
- Returns: Promise resolving to transaction result

## Status Flow

1. `idle` - Initial state
2. `signing` - Preparing transaction and requesting signature
3. `submitting` - Simulating and submitting transaction
4. `pending` - Transaction submitted, waiting for confirmation
5. `success` - Transaction confirmed on-chain
6. `failed` - Transaction failed at any step

## Error Handling

The hook handles various error scenarios:
- Wallet not connected
- Transaction simulation failures
- Signing failures
- Submission failures
- On-chain failures
- Timeout during confirmation

All errors are displayed via notifications and stored in the `error` state.