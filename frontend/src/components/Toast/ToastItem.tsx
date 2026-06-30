import React, { useCallback, useEffect, useRef } from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Stack,
  keyframes,
} from '@mui/material';
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

const iconStylesByType = {
  success: { color: '#10b981', symbol: '✓' },
  error: { color: '#ef4444', symbol: '!' },
  warning: { color: '#f59e0b', symbol: '!' },
  info: { color: '#3b82f6', symbol: 'i' },
} as const;

const ToastItem: React.FC<ToastItemProps> = ({ toast, onClose }) => {
  const [isExiting, setIsExiting] = React.useState(false);
  const isClosedRef = useRef(false);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }

    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
  }, []);

  const handleClose = useCallback(() => {
    if (isClosedRef.current) {
      return;
    }

    isClosedRef.current = true;
    clearTimers();
    setIsExiting(true);

    exitTimerRef.current = setTimeout(() => {
      onClose(toast.id);
      toast.onClose?.();
      exitTimerRef.current = null;
    }, 300);
  }, [clearTimers, onClose, toast]);

  // Auto-dismiss timer
  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      dismissTimerRef.current = setTimeout(() => {
        handleClose();
      }, toast.duration);
    }

    return () => {
      clearTimers();
    };
  }, [clearTimers, handleClose, toast.duration]);

  const handleActionClick = () => {
    if (toast.action) {
      toast.action.onClick();
    }
  };

  const getIcon = () => {
    const icon = iconStylesByType[toast.type];

    return (
      <Box
        aria-hidden="true"
        sx={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.875rem',
          fontWeight: 700,
          color: icon.color,
          border: `1px solid ${icon.color}`,
          lineHeight: 1,
        }}
      >
        {icon.symbol}
      </Box>
    );
  };

  return (
    <Box
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
              <Box component="span" aria-hidden="true" sx={{ fontSize: '1rem', lineHeight: 1 }}>
                ×
              </Box>
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
