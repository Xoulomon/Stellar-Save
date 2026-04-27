import React, { useState } from 'react';
import { Button } from '@mui/material';
import { InviteModal } from './InviteModal';

// Inline SVG to avoid @mui/icons-material dependency
const LinkIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z" />
  </svg>
);

interface InviteButtonProps {
  groupId: string;
  groupName: string;
}

export const InviteButton: React.FC<InviteButtonProps> = ({ groupId, groupName }) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outlined"
        size="small"
        startIcon={<LinkIcon />}
        onClick={() => setOpen(true)}
        sx={{ textTransform: 'none' }}
        aria-label={`Invite members to ${groupName}`}
      >
        Invite
      </Button>
      <InviteModal
        open={open}
        onClose={() => setOpen(false)}
        groupId={groupId}
        groupName={groupName}
      />
    </>
  );
};
