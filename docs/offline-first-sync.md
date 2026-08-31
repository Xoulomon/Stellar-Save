# Offline-First Data Sync and Local Caching

**Status**: Implemented  
**Issue**: #1005  
**Tier**: Medium (150 pts)

## Overview

Stellar-Save now includes a comprehensive offline-first architecture that enables the mobile web app to remain fully functional with intermittent or no connectivity. Users can view cached data, queue actions while offline, and have those actions automatically replayed when connection is restored.

## Features

### ✅ Local Caching (IndexedDB)
- **Groups data**: Full group details, members, and contribution history
- **Automatic caching**: All fetched data is automatically cached locally
- **Intelligent staleness detection**: Tracks data age and marks stale content

### ✅ Offline Queue System
- **Action queuing**: Contributions, joins, and group creation queued when offline
- **Ordered replay**: Actions execute in the exact order they were queued
- **Retry logic**: Failed actions retry up to 3 times with exponential backoff
- **Duplicate prevention**: Queue ensures actions aren't submitted twice

### ✅ Background Sync
- **Periodic sync**: Refreshes cached data every 5 minutes when online
- **Foreground sync**: Syncs when app comes to foreground
- **Manual sync**: Users can trigger sync manually
- **Optimistic updates**: UI updates immediately, syncs in background

### ✅ User Indicators
- **Offline badge**: Shows connection status in header
- **Stale data banner**: Alerts users when viewing outdated data
- **Queue counter**: Displays number of pending offline actions
- **Sync status**: Visual feedback during sync operations

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────┐
│                     React Components                    │
│  (Header, GroupsPage, StaleDataBanner, OfflineIndicator)│
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                   React Hooks                           │
│   (useOfflineSync, useGroups, useContributions)         │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                  Sync Service                           │
│  - Connection monitoring                                │
│  - Queue replay                                         │
│  - Cache refresh                                        │
│  - Background sync                                      │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│              IndexedDB (via idb)                        │
│  - groups (detailed group data)                         │
│  - groupsList (list of all groups)                      │
│  - members (group members)                              │
│  - contributions (contribution history)                 │
│  - syncQueue (pending offline actions)                  │
│  - metadata (sync status, last sync time)               │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

#### Online Mode
```
User Action → React Hook → API Call → Cache Update → UI Update
                                   ↓
                            Service Worker Cache
```

#### Offline Mode
```
User Action → React Hook → Queue Action → IndexedDB
                              ↓
                         Show Cached Data
                              ↓
                    (When Connection Restored)
                              ↓
                        Replay Queue → API
```

## Implementation Details

### 1. IndexedDB Layer (`frontend/src/lib/db.ts`)

```typescript
// Store schemas
interface DBSchema {
  groups: CachedGroup;           // Detailed group data
  groupsList: CachedGroupsList;  // List of all groups
  members: GroupMember[];        // Group members
  contributions: GroupContribution[]; // Contributions
  syncQueue: SyncQueueItem[];    // Offline actions queue
  metadata: SyncMetadata;        // Sync status
}

// Key operations
await cacheGroup(group);
await getCachedGroup(groupId);
await addToSyncQueue(action);
await getPendingSyncItems();
```

### 2. Sync Service (`frontend/src/lib/syncService.ts`)

**Connection Monitoring**
```typescript
window.addEventListener('online', handleOnline);
window.addEventListener('offline', handleOffline);
document.addEventListener('visibilitychange', handleVisibilityChange);
```

**Queue Replay**
```typescript
async function replayQueue() {
  const queue = await getPendingSyncItems();
  for (const item of queue) {
    try {
      await executeQueuedAction(item);
      await removeSyncQueueItem(item.id);
    } catch (error) {
      // Retry or mark as failed
    }
  }
}
```

**Background Sync**
```typescript
// Sync every 5 minutes when online
setInterval(() => {
  if (navigator.onLine) syncAll();
}, 5 * 60 * 1000);

// Sync when app comes to foreground
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') syncAll();
});
```

### 3. React Hooks (`frontend/src/hooks/useOfflineSync.ts`)

```typescript
// Initialize sync service
useOfflineSyncInit();

// Monitor sync status
const { connectionStatus, syncStatus, queueCount } = useSyncStatus();

// Check online status
const isOnline = useIsOnline();

// Queue actions
const { queueContribution, queueJoinGroup } = useQueueAction();
```

### 4. Enhanced React Query Integration

```typescript
// Updated useGroups hook with offline support
const { groups, isStale, fromCache } = useGroups();

// Fetch strategy: network-first with cache fallback
queryFn: async () => {
  if (isOnline) {
    try {
      const data = await fetchGroups();
      await cacheGroupsList(data);
      return data;
    } catch (err) {
      // Fall back to cache
    }
  }
  const cached = await getCachedGroupsList();
  return cached.groups;
}
```

### 5. Service Worker Updates (`frontend/public/sw.js`)

**API Caching Strategy**
- Network-first with cache fallback
- Cache expires after 5 minutes
- Returns stale cache with warning header if fresh cache unavailable

**Background Sync Registration**
```javascript
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-actions') {
    // Notify clients to replay queue
  }
});
```

## User Experience

### Online Experience
1. **Normal operation**: All data fetched from network
2. **Automatic caching**: Data cached in background
3. **No indicators**: UI operates normally

### Offline Experience
1. **Offline badge appears**: Header shows "Offline" status
2. **Read-only access**: Users can browse cached groups and history
3. **Action queuing**: Contributions/joins are queued, not blocked
4. **Queue counter**: Shows "X pending" actions
5. **Stale data banner**: Warns when viewing outdated data

### Reconnection Experience
1. **Connection restored**: Badge changes to "Syncing..."
2. **Queue replay**: Offline actions execute in order
3. **Cache refresh**: Latest data fetched from server
4. **Success feedback**: Badge shows "Synced" or queue count if errors

## Testing

### Manual Testing Scenarios

**Scenario 1: Browse Groups Offline**
1. Open app while online
2. Browse groups (data caches automatically)
3. Toggle offline mode (DevTools → Network → Offline)
4. Refresh page
5. ✅ Groups list should load from cache
6. ✅ Stale data banner should appear

**Scenario 2: Queue Contribution Offline**
1. Navigate to a group detail page while online
2. Toggle offline mode
3. Attempt to make a contribution
4. ✅ Action should be queued
5. ✅ Header should show "1 pending"
6. Toggle online mode
7. ✅ Queued action should execute automatically

**Scenario 3: Foreground Sync**
1. Open app, browse data
2. Switch to another tab for 5+ minutes
3. Return to Stellar-Save tab
4. ✅ Data should sync automatically
5. ✅ Fresh data should replace stale cache

### Automated Tests

```bash
# Run offline sync tests
npm test offlineSync.test.ts

# Coverage
npm run test:coverage
```

## Configuration

### Cache Expiration
```typescript
// lib/syncService.ts
const SYNC_INTERVAL = 5 * 60 * 1000;      // 5 minutes
const STALE_THRESHOLD = 2 * 60 * 1000;    // 2 minutes
```

### Retry Configuration
```typescript
// lib/syncService.ts
const maxRetries = 3;
const retryDelay = exponentialBackoff(retryCount);
```

## Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| IndexedDB | ✅ | ✅ | ✅ | ✅ |
| Service Worker | ✅ | ✅ | ✅ | ✅ |
| Background Sync | ✅ | ❌ | ❌ | ✅ |
| Online/Offline Events | ✅ | ✅ | ✅ | ✅ |

**Note**: Background Sync API is not universally supported. The app falls back to periodic foreground sync in unsupported browsers.

## Future Enhancements

### Planned Improvements
- [ ] Conflict resolution for concurrent edits
- [ ] Differential sync (only fetch changed data)
- [ ] Compression for cached data
- [ ] Selective cache clearing
- [ ] Advanced retry strategies (exponential backoff)
- [ ] Offline-first transaction signing

### Known Limitations
1. **Storage quotas**: IndexedDB has browser-specific storage limits
2. **No conflict resolution**: Last-write-wins for concurrent edits
3. **Manual cache management**: No automatic eviction of old data
4. **Mock data**: Integration with actual Soroban contracts pending

## Troubleshooting

### Cache Not Updating
**Problem**: Cached data not refreshing when online  
**Solution**: Check sync service is initialized in App.tsx

### Queue Not Replaying
**Problem**: Offline actions not executing after reconnection  
**Solution**: Check browser console for sync errors, verify network connection

### Storage Full Error
**Problem**: IndexedDB quota exceeded  
**Solution**: Clear cache via browser DevTools → Application → Storage

## Dependencies

```json
{
  "idb": "^8.0.0",           // IndexedDB wrapper
  "workbox-window": "^7.0.0" // Service worker utilities
}
```

## API Reference

### Core Functions

#### `initSyncService()`
Initializes offline sync service, sets up event listeners

#### `syncAll()`
Manually triggers full sync: replay queue + refresh cache

#### `queueAction(type, payload)`
Adds an action to the offline queue

#### `getCachedGroupWithStatus(groupId)`
Retrieves cached group with staleness info

### React Hooks

#### `useOfflineSyncInit()`
Initialize sync service on app mount

#### `useSyncStatus()`
Returns: `{ syncStatus, connectionStatus, queueCount, lastSyncTime }`

#### `useIsOnline()`
Returns: `boolean` - current connection status

#### `useQueueAction()`
Returns: `{ queueContribution, queueJoinGroup, queueCreateGroup }`

## Contributing

When adding new offline-capable features:

1. **Add schema to `db.ts`** if new data type
2. **Update sync service** to handle new action types
3. **Add queue replay logic** for new actions
4. **Update UI indicators** to show queued state
5. **Write tests** for offline scenarios
6. **Update this documentation**

## Related Issues

- #1005 - Offline-first data sync (this issue)
- #771 - Mobile-responsive header (includes OfflineIndicator)
- Future: Conflict resolution strategy
- Future: Optimistic UI updates

## Acceptance Criteria ✅

- [x] App remains usable read-only with no connection
- [x] Local cache (IndexedDB) for groups, members, history
- [x] Sync on foreground and background interval when online
- [x] Queue write actions made while offline
- [x] Replay queue on reconnect in order
- [x] No duplicate submission
- [x] Show "stale data"/"offline" indicators
- [x] Offline badge in header
- [x] Queue counter display

## License

MIT License - See main repository LICENSE file
