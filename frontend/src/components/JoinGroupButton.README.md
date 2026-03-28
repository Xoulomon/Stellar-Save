# JoinGroupButton Component

A button component for joining Stellar-Save groups with wallet integration and transaction handling.

## Features

- ✅ Wallet connection check
- ✅ Eligibility validation (not member, group not full, group not active)
- ✅ Confirmation dialog before joining
- ✅ Transaction status (loading state)
- ✅ Error handling and display
- ✅ Success callback

## Usage

```tsx
import { JoinGroupButton } from './components/JoinGroupButton';

function GroupDetail() {
  return (
    <JoinGroupButton
      groupId={1}
      maxMembers={10}
      currentMembers={5}
      isActive={false}
      isMember={false}
      onSuccess={() => console.log('Joined successfully!')}
    />
  );
}
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `groupId` | `number` | Yes | The ID of the group to join |
| `maxMembers` | `number` | Yes | Maximum members allowed in group |
| `currentMembers` | `number` | Yes | Current number of members |
| `isActive` | `boolean` | Yes | Whether the group is active (started) |
| `isMember` | `boolean` | No | Whether user is already a member (default: false) |
| `onSuccess` | `() => void` | No | Callback fired after successful join |

## States

The button displays different states based on eligibility:

- **"Join Group"** - User can join (wallet connected, not member, group not full, not active)
- **"Already Joined"** - User is already a member
- **"Group Full"** - Maximum members reached
- **"Group Active"** - Group has started, no longer accepting members
- **"Connect Wallet"** - Wallet not connected
- **Confirmation** - Shows "Confirm" and "Cancel" buttons after initial click

## Contract Integration

The component is ready for Stellar Soroban contract integration. Update the `handleJoin` function to call the actual contract:

```typescript
import { Contract } from '@stellar/stellar-sdk';

const handleJoin = async () => {
  const contract = new Contract(CONTRACT_ADDRESS);
  await contract.join_group({
    group_id: groupId,
    member: activeAddress
  });
};
```

## Error Handling

Errors are displayed inline next to the confirmation buttons. Common errors:

- Wallet not connected
- Transaction rejected by user
- Contract errors (already member, group full, invalid state)
- Network errors

## Testing

Run tests with:

```bash
npm test JoinGroupButton.test.tsx
```

Tests cover:
- All button states
- Confirmation flow
- Success callback
- Error handling
