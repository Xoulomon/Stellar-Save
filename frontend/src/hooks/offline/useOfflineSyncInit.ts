import { useEffect } from 'react';

import { initSyncService, stopSyncService } from '../../lib/syncService';

/**
 * Initialize offline sync service on app mount
 */
export function useOfflineSyncInit(): void {
  useEffect(() => {
    void initSyncService();

    return () => {
      stopSyncService();
    };
  }, []);
}
