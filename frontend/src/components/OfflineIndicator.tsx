/**
 * OfflineIndicator.tsx — Shows connection status and sync queue
 */

import { Box, Chip, Tooltip, Typography } from '@mui/material';
import {
  CloudOff,
  CloudQueue,
  CloudDone,
  Sync,
  Warning,
} from '@mui/icons-material';
import { useSyncStatus } from '../hooks/useOfflineSync';
import { formatDistanceToNow } from '../utils/formatDate';

export function OfflineIndicator(): JSX.Element | null {
  const { connectionStatus, syncStatus, queueCount, lastSyncTime } = useSyncStatus();

  // Don't show anything if online and synced
  if (connectionStatus === 'online' && syncStatus === 'idle' && queueCount === 0) {
    return null;
  }

  const getStatusIcon = () => {
    if (connectionStatus === 'offline') return <CloudOff fontSize="small" />;
    if (syncStatus === 'syncing') return <Sync fontSize="small" className="rotating" />;
    if (syncStatus === 'error') return <Warning fontSize="small" />;
    if (queueCount > 0) return <CloudQueue fontSize="small" />;
    return <CloudDone fontSize="small" />;
  };

  const getStatusLabel = () => {
    if (connectionStatus === 'offline') return `Offline${queueCount > 0 ? ` (${queueCount} queued)` : ''}`;
    if (syncStatus === 'syncing') return 'Syncing...';
    if (syncStatus === 'error') return 'Sync error';
    if (queueCount > 0) return `${queueCount} pending`;
    return 'Synced';
  };

  const getStatusColor = () => {
    if (connectionStatus === 'offline') return 'warning';
    if (syncStatus === 'error') return 'error';
    if (syncStatus === 'syncing') return 'info';
    if (queueCount > 0) return 'default';
    return 'success';
  };

  const getTooltipText = () => {
    const parts: string[] = [];
    
    if (connectionStatus === 'offline') {
      parts.push('You are currently offline');
      if (queueCount > 0) {
        parts.push(`${queueCount} action${queueCount > 1 ? 's' : ''} will be synced when connection is restored`);
      }
    } else if (syncStatus === 'syncing') {
      parts.push('Syncing data with server...');
    } else if (syncStatus === 'error') {
      parts.push('Failed to sync. Will retry automatically.');
    } else if (queueCount > 0) {
      parts.push(`${queueCount} action${queueCount > 1 ? 's' : ''} waiting to sync`);
    }

    if (lastSyncTime) {
      parts.push(`Last synced: ${formatDistanceToNow(lastSyncTime)} ago`);
    }

    return parts.join('\n');
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Tooltip
        title={
          <Typography
            variant="body2"
            component="div"
            sx={{ whiteSpace: 'pre-line' }}
          >
            {getTooltipText()}
          </Typography>
        }
        arrow
      >
        <Chip
          icon={getStatusIcon()}
          label={getStatusLabel()}
          color={getStatusColor()}
          size="small"
          variant="outlined"
        />
      </Tooltip>
      
      <style>{`
        @keyframes rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .rotating {
          animation: rotate 1s linear infinite;
        }
      `}</style>
    </Box>
  );
}
