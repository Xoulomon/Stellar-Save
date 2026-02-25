import React from 'react';
import {
  Box,
  Button,
  Stack,
  Typography,
} from '@mui/material';
import { useToast } from './useToast';
import { AppCard } from '../../ui';

/**
 * Demo component showing how to use the Toast notification system
 */
export const ToastDemo: React.FC = () => {
  const { addToast } = useToast();

  const showSuccessToast = () => {
    addToast({
      message: 'Operation completed successfully!',
      type: 'success',
      duration: 3000,
      action: {
        label: 'Undo',
        onClick: () => console.log('Undo clicked'),
      },
    });
  };

  const showErrorToast = () => {
    addToast({
      message: 'An error occurred while processing your request.',
      type: 'error',
      duration: 4000,
    });
  };

  const showWarningToast = () => {
    addToast({
      message: 'Please review this important warning before proceeding.',
      type: 'warning',
      duration: 3500,
      action: {
        label: 'Review',
        onClick: () => console.log('Review clicked'),
      },
    });
  };

  const showInfoToast = () => {
    addToast({
      message: 'Here is some useful information about your account.',
      type: 'info',
      duration: 0, // No auto-dismiss
      action: {
        label: 'Learn more',
        onClick: () => console.log('Learn more clicked'),
      },
    });
  };

  const showPersistentToast = () => {
    addToast({
      message: 'This toast will persist until you close it manually.',
      type: 'info',
      duration: 0, // Persistent
    });
  };

  return (
    <AppCard>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h2">Toast Notifications Demo</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.75 }}>
            Click the buttons below to trigger different types of toast notifications.
          </Typography>
        </Box>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          sx={{ flexWrap: 'wrap' }}
        >
          <Button
            variant="contained"
            color="success"
            onClick={showSuccessToast}
          >
            Success Toast
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={showErrorToast}
          >
            Error Toast
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={showWarningToast}
          >
            Warning Toast
          </Button>
          <Button
            variant="contained"
            color="info"
            onClick={showInfoToast}
          >
            Info Toast
          </Button>
          <Button
            variant="outlined"
            onClick={showPersistentToast}
          >
            Persistent Toast
          </Button>
        </Stack>

        <Typography variant="caption" color="text.secondary">
          ✓ Auto-dismiss: Success/Warning/Error toasts auto-dismiss after 3-4 seconds
          <br />
          ✓ Action buttons: Click "Undo", "Review", or "Learn more" to handle custom actions
          <br />
          ✓ Persistent: Info toast will stay until manually dismissed
          <br />
          ✓ Stacking: Multiple toasts will queue and display together
        </Typography>
      </Stack>
    </AppCard>
  );
};

export default ToastDemo;
