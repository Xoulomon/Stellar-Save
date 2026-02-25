import React, { useCallback, useEffect, useRef } from 'react';
import { createContext, useContext, useState } from 'react';

// Types
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number; // milliseconds, undefined = no auto-dismiss
  action?: ToastAction;
  onClose?: () => void;
}

interface ToastContextType {
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
}

// Context
const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Hook to use toast notifications
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

// Toast Component - Individual toast display
const ToastItem: React.FC<{
  toast: Toast;
  onClose: (id: string) => void;
}> = ({ toast, onClose }: { toast: Toast; onClose: (id: string) => void }) => {
  const toastRef = useRef<HTMLDivElement>(null);

  // Auto-dismiss timer
  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => {
        onClose(toast.id);
      }, toast.duration);

      return () => clearTimeout(timer);
    }
  }, [toast.id, toast.duration, onClose]);

  // Type-specific styling
  const getTypeStyles = () => {
    const baseStyles = 'flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg';
    switch (toast.type) {
      case 'success':
        return `${baseStyles} bg-green-50 border border-green-200 text-green-800`;
      case 'error':
        return `${baseStyles} bg-red-50 border border-red-200 text-red-800`;
      case 'warning':
        return `${baseStyles} bg-yellow-50 border border-yellow-200 text-yellow-800`;
      case 'info':
        return `${baseStyles} bg-blue-50 border border-blue-200 text-blue-800`;
      default:
        return baseStyles;
    }
  };

  // Icon for each type
  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return (
          <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-5 h-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        );
      case 'info':
        return (
          <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
        );
    }
  };

  const handleActionClick = () => {
    if (toast.action) {
      toast.action.onClick();
    }
  };

  const handleClose = () => {
    onClose(toast.id);
    if (toast.onClose) {
      toast.onClose();
    }
  };

  return (
    <div
      ref={toastRef}
      className={`${getTypeStyles()} animate-in fade-in slide-in-from-right-full duration-300 transform transition-all`}
      role="alert"
      aria-live="polite"
    >
      {/* Icon */}
      <div className="flex-shrink-0">{getIcon()}</div>

      {/* Message */}
      <div className="flex-grow">
        <p className="font-medium text-sm">{toast.message}</p>
      </div>

      {/* Action Button (if provided) */}
      {toast.action && (
        <button
          onClick={handleActionClick}
          className="ml-2 px-3 py-1 text-sm font-medium rounded hover:bg-opacity-75 transition-colors whitespace-nowrap"
          style={{
            backgroundColor:
              toast.type === 'success'
                ? 'rgb(134, 239, 172, 0.3)'
                : toast.type === 'error'
                  ? 'rgb(252, 165, 165, 0.3)'
                  : toast.type === 'warning'
                    ? 'rgb(253, 224, 71, 0.3)'
                    : 'rgb(147, 197, 253, 0.3)',
          }}
        >
          {toast.action.label}
        </button>
      )}

      {/* Close Button */}
      <button
        onClick={handleClose}
        className="ml-2 text-gray-500 hover:text-gray-700 transition-colors"
        aria-label="Dismiss notification"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </div>
  );
};

// Toast Container - Manages the queue and display
const ToastContainer: React.FC<{
  toasts: Toast[];
  onRemoveToast: (id: string) => void;
}> = ({ toasts, onRemoveToast }: { toasts: Toast[]; onRemoveToast: (id: string) => void }) => {
  return (
    <div
      className="fixed top-4 right-4 z-50 flex flex-col gap-3 max-w-sm pointer-events-auto"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((toast: Toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onClose={onRemoveToast} />
        </div>
      ))}
    </div>
  );
};

// Toast Provider - Context provider and state management
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>): string => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const newToast: Toast = {
      ...toast,
      id,
      duration: toast.duration ?? 3000, // Default 3 second duration
    };

    setToasts((prev: Toast[]) => [...prev, newToast]);

    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev: Toast[]) => prev.filter((toast: Toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
    </ToastContext.Provider>
  );
};

export default ToastProvider;
