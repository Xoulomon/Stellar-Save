import React from 'react';
import { Box, Stack } from '@mui/material';
import ToastItem from './ToastItem';
import type { Toast } from './types';

interface ToastContainerProps {
  toasts: Toast[];
  onRemoveToast: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onRemoveToast,
}) => {
  return (
    <Box
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      aria-atomic="true"
      sx={{
        position: 'fixed',
        top: 24,
        right: 24,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      <Stack
        spacing={1.5}
        sx={{
          pointerEvents: 'auto',
        }}
      >
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onClose={onRemoveToast}
          />
        ))}
      </Stack>
    </Box>
  );
};

export default ToastContainer;
