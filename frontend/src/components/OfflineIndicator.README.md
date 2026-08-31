# OfflineIndicator

Shows connection status and pending sync queue count as a small `Chip`.

## Usage

```tsx
import { OfflineIndicator } from './components/OfflineIndicator';

function Header() {
  return (
    <div>
      <OfflineIndicator />
    </div>
  );
}
```

## Props

None. `OfflineIndicator` takes no props — all state comes from
[`useSyncStatus`](../hooks/useOfflineSync.ts).

## Behavior

- Renders `null` when online, idle, and the sync queue is empty.
- Otherwise renders a `Chip` whose icon, label, and color reflect the
  current `connectionStatus` (`online` | `offline` | `unknown`) and
  `syncStatus` (`idle` | `syncing` | `error`), plus the pending
  `queueCount`.
- A tooltip on the chip explains the current state and, when available,
  how long ago the last sync completed.
