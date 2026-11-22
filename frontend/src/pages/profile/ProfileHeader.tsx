import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditIcon from '@mui/icons-material/Edit';
import { Box, Typography, Avatar as MuiAvatar, Chip, Tooltip, IconButton } from '@mui/material';

import { useClipboard } from '../../hooks/useClipboard';

export interface ProfileHeaderProps {
  address: string | null;
  displayName: string;
  joinDate?: Date;
  onEditName: () => void;
}

export function ProfileHeader({ address, displayName, joinDate, onEditName }: ProfileHeaderProps) {
  const { copy, copied } = useClipboard();
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        gap: 3,
        alignItems: { xs: 'flex-start', sm: 'center' },
      }}
    >
      <MuiAvatar
        sx={{ width: 72, height: 72, bgcolor: 'primary.main', fontSize: '1.5rem', fontWeight: 700 }}
      >
        {initials}
      </MuiAvatar>

      <Box sx={{ flex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="h2" sx={{ fontWeight: 700 }}>
            {displayName}
          </Typography>
          <Tooltip title="Edit display name">
            <IconButton size="small" onClick={onEditName} aria-label="Edit display name">
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        {address ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}
            >
              {address.slice(0, 12)}…{address.slice(-8)}
            </Typography>
            <Tooltip title={copied ? 'Copied!' : 'Copy full address'}>
              <IconButton size="small" onClick={() => copy(address)} aria-label="Copy wallet address">
                {copied ? (
                  <CheckCircleIcon fontSize="small" color="success" />
                ) : (
                  <ContentCopyIcon sx={{ fontSize: 14 }} />
                )}
              </IconButton>
            </Tooltip>
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Wallet not connected
          </Typography>
        )}

        {joinDate && (
          <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
            Member since{' '}
            {joinDate.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </Typography>
        )}
      </Box>

      {address && <Chip label="Verified" color="success" size="small" icon={<CheckCircleIcon />} />}
    </Box>
  );
}
