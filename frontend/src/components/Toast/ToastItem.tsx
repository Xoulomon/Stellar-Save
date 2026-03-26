import React, { useEffect, useRef } from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Stack,
  keyframes,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';
import type { Toast } from './types';

const slideIn = keyframes`
  from {
    transform: translateX(400px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
`;

const slideOut = keyframes`
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(400px);
    opacity: 0;
  }
`;

interface ToastItemProps {
  toast: Toast;
  onClose: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onClose }) => {
  const toastRef = useRef<HTMLDivElement>(null);
  const [isExiting, setIsExiting] = React.useState(false);

  // Auto-dismiss timer
  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, toast.duration);

      return () => clearTimeout(timer);
    }
  }, [toast.id, toast.duration]);

  const handleActionClick = () => {
    if (toast.action) {
      toast.action.onClick();
    }
  };

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onClose(toast.id);
      if (toast.onClose) {
        toast.onClose();
      }
    }, 300);
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircleIcon sx={{ color: '#10b981' }} />;
      case 'error':
        return <ErrorIcon sx={{ color: '#ef4444' }} />;
      case 'warning':
        return <WarningIcon sx={{ color: '#f59e0b' }} />;
      case 'info':
        return <InfoIcon sx={{ color: '#3b82f6' }} />;
    }
  };

  return (
    <Box
      ref={toastRef}
      sx={{
        animation: isExiting
          ? `${slideOut} 0.3s ease-in-out forwards`
          : `${slideIn} 0.3s ease-out`,
      }}
    >
      <Alert
        icon={getIcon()}
        severity={toast.type === 'success' ? 'success' : toast.type === 'error' ? 'error' : toast.type === 'warning' ? 'warning' : 'info'}
        sx={{
          minWidth: '300px',
          maxWidth: '400px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1,
        }}
        action={
          <Stack direction="row" spacing={1} alignItems="center" ml={1}>
            {toast.action && (
              <Button
                size="small"
                onClick={handleActionClick}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                {toast.action.label}
              </Button>
            )}
            <Box
              component="button"
              onClick={handleClose}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                color: 'inherit',
                opacity: 0.7,
                transition: 'opacity 0.2s',
                '&:hover': {
                  opacity: 1,
                },
              }}
              aria-label="Dismiss notification"
            >
              <CloseIcon fontSize="small" />
            </Box>
          </Stack>
        }
      >
        <AlertTitle sx={{ fontWeight: 600, mb: 0.5 }}>
          {toast.type.charAt(0).toUpperCase() + toast.type.slice(1)}
        </AlertTitle>
        <Box sx={{ fontSize: '0.875rem' }}>{toast.message}</Box>
      </Alert>
    </Box>
  );
};

export default ToastItem;
