import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Stack } from '@mui/material';
import { buildRoute } from '../routing/constants';

// Inline SVG to avoid @mui/icons-material dependency
const GroupsIcon = () => (
  <svg
    width="64"
    height="64"
    viewBox="0 0 24 24"
    fill="currentColor"
    style={{ color: 'var(--mui-palette-primary-main, #1976d2)' }}
    aria-hidden="true"
  >
    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
  </svg>
);

/**
 * Landing page for invitation links (/groups/join/:groupId).
 * Redirects the user to the group detail page to complete joining.
 */
const JoinGroupPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();

  const handleJoin = () => {
    if (groupId) navigate(buildRoute.groupDetail(groupId));
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: 3,
        p: 3,
        textAlign: 'center',
      }}
    >
      <GroupsIcon />
      <Stack spacing={1}>
        <Typography variant="h5" fontWeight="bold">
          You've been invited!
        </Typography>
        <Typography variant="body1" color="text.secondary">
          You were invited to join a savings group on Stellar Save.
        </Typography>
      </Stack>
      <Stack direction="row" spacing={2}>
        <Button
          variant="contained"
          onClick={handleJoin}
          sx={{ textTransform: 'none', fontWeight: 'bold' }}
        >
          View Group & Join
        </Button>
        <Button variant="outlined" onClick={() => navigate('/')} sx={{ textTransform: 'none' }}>
          Go Home
        </Button>
      </Stack>
    </Box>
  );
};

export default JoinGroupPage;
