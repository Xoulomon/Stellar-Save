## Description

Implements offline-first data synchronization and local caching for the mobile web app (PWA) to enable full functionality with intermittent or no connectivity.

## Changes Made

### Core Infrastructure
- **IndexedDB Layer**: Persistent local storage using idb library
- **Sync Service**: Manages online/offline state and background sync
- **Action Queue System**: Queues offline writes with replay on reconnection

### React Integration
- New hooks: useOfflineSyncInit, useSyncStatus, useIsOnline, useQueueAction
- Enhanced useGroups with offline cache fallback

### UI Components
- OfflineIndicator: Shows connection/sync status in header
- StaleDataBanner: Warns about cached/stale data

### Service Worker Enhancements
- Network-first API caching with 5-minute TTL
- Background Sync API support

### Documentation
- Comprehensive guide in docs/offline-first-sync.md

## Acceptance Criteria
- [x] App remains usable read-only with no connection
- [x] Local cache for groups, members, history
- [x] Sync on foreground and background interval
- [x] Queue write actions while offline
- [x] Replay queue on reconnect in order
- [x] No duplicate submission
- [x] Show stale data and offline indicators

## Dependencies Added
- idb@^8.0.0: IndexedDB wrapper library
- workbox-window@^7.0.0: Service worker utilities

Closes #1005
