import React, { useCallback, useState } from 'react';
import ToastContainer from './ToastContainer';
import { ToastContext } from './useToast';
import type { Toast, ToastContextType } from './types';

interface ToastProviderProps {
  children: React.ReactNode;
}

interface ToastState {
  toasts: Toast[];
  queue: Toast[];
}

const MAX_VISIBLE_TOASTS = 3;

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [state, setState] = useState<ToastState>({
    toasts: [],
    queue: [],
  });

  const addToast = useCallback((toast: Omit<Toast, 'id'>): string => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const newToast: Toast = {
      ...toast,
      id,
      duration: toast.duration ?? 3000, // Default 3 second duration
    };

    setState((prev) => {
      if (prev.toasts.length < MAX_VISIBLE_TOASTS) {
        return {
          ...prev,
          toasts: [...prev.toasts, newToast],
        };
      }

      return {
        ...prev,
        queue: [...prev.queue, newToast],
      };
    });

    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setState((prev) => {
      const visibleIndex = prev.toasts.findIndex((toast) => toast.id === id);

      if (visibleIndex === -1) {
        const nextQueue = prev.queue.filter((toast) => toast.id !== id);

        if (nextQueue.length === prev.queue.length) {
          return prev;
        }

        return {
          ...prev,
          queue: nextQueue,
        };
      }

      const nextToasts = prev.toasts.filter((toast) => toast.id !== id);

      if (prev.queue.length === 0) {
        return {
          ...prev,
          toasts: nextToasts,
        };
      }

      const [nextToast, ...remainingQueue] = prev.queue;

      return {
        toasts: [...nextToasts, nextToast],
        queue: remainingQueue,
      };
    });
  }, []);

  const value: ToastContextType = {
    addToast,
    removeToast,
    toasts: state.toasts,
    queue: state.queue,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={state.toasts} onRemoveToast={removeToast} />
    </ToastContext.Provider>
  );
};

export default ToastProvider;
