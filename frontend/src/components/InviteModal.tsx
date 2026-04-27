import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  Stack,
  Tooltip,
  IconButton,
  Divider,
} from '@mui/material';
import { QRCode } from './QRCode';
import {
  generateInviteLink,
  buildShareUrls,
  trackInviteShare,
  getInviteShareCount,
} from '../utils/invitation';
import { useClipboard } from '../hooks/useClipboard';

// Inline SVG icons to avoid @mui/icons-material dependency
const ContentCopyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
  </svg>
);

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
  </svg>
);

const ShareIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z" />
  </svg>
);

interface InviteModalProps {
  open: boolean;
  onClose: () => void;
  groupId: string;
  groupName: string;
}

export const InviteModal: React.FC<InviteModalProps> = ({ open, onClose, groupId, groupName }) => {
  const inviteLink = generateInviteLink(groupId);
  const { copy, copied } = useClipboard();
  const shareUrls = buildShareUrls(inviteLink, groupName);
  const [shareCount, setShareCount] = useState(() => getInviteShareCount(groupId));

  const handleCopy = async () => {
    await copy(inviteLink);
    trackInviteShare(groupId);
    setShareCount(getInviteShareCount(groupId));
  };

  const handleSocialShare = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
    trackInviteShare(groupId);
    setShareCount(getInviteShareCount(groupId));
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: `Join ${groupName}`, url: inviteLink });
      trackInviteShare(groupId);
      setShareCount(getInviteShareCount(groupId));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle fontWeight="bold">Invite Members</DialogTitle>
      <DialogContent>
        <Stack spacing={2} alignItems="center">
          <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1 }}>
            <QRCode value={inviteLink} size={180} aria-label={`QR code for joining ${groupName}`} />
          </Box>

          <Typography variant="caption" color="text.secondary">
            Scan to join <strong>{groupName}</strong>
          </Typography>

          <Box sx={{ width: '100%' }}>
            <TextField
              fullWidth
              size="small"
              value={inviteLink}
              inputProps={{ readOnly: true, 'aria-label': 'Invitation link' }}
              InputProps={{
                endAdornment: (
                  <Tooltip title={copied ? 'Copied!' : 'Copy link'}>
                    <IconButton size="small" onClick={handleCopy} aria-label="Copy invitation link">
                      {copied ? (
                        <CheckIcon fontSize="small" color="success" />
                      ) : (
                        <ContentCopyIcon fontSize="small" />
                      )}
                    </IconButton>
                  </Tooltip>
                ),
              }}
            />
          </Box>

          <Divider flexItem />

          <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="center">
            <Button
              size="small"
              variant="outlined"
              onClick={() => handleSocialShare(shareUrls.whatsapp)}
              sx={{ textTransform: 'none' }}
            >
              WhatsApp
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={() => handleSocialShare(shareUrls.twitter)}
              sx={{ textTransform: 'none' }}
            >
              Twitter / X
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={() => handleSocialShare(shareUrls.telegram)}
              sx={{ textTransform: 'none' }}
            >
              Telegram
            </Button>
            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<ShareIcon />}
                onClick={handleNativeShare}
                sx={{ textTransform: 'none' }}
              >
                Share
              </Button>
            )}
          </Stack>

          {shareCount > 0 && (
            <Typography variant="caption" color="text.secondary">
              Shared {shareCount} time{shareCount !== 1 ? 's' : ''}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};
