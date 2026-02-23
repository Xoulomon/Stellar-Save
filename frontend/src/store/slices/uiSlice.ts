export type NotificationLevel = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
  id: string;
  message: string;
  level: NotificationLevel;
}

export interface UiSlice {
  notifications: Notification[];
  isMobileMenuOpen: boolean;
  toggleMobileMenu: () => void;
  addNotification: (message: string, level?: NotificationLevel) => void;
  dismissNotification: (id: string) => void;
  clearNotifications: () => void;
}

type SliceSetter<T> = (partial: Partial<T> | ((state: T) => Partial<T>)) => void;

export const createUiSlice = <T extends UiSlice>(set: SliceSetter<T>): UiSlice => ({
  notifications: [],
  isMobileMenuOpen: false,
  toggleMobileMenu: () =>
    set((state) => ({
      isMobileMenuOpen: !state.isMobileMenuOpen,
    })),
  addNotification: (message, level = 'info') =>
    set((state) => ({
      notifications: [
        ...state.notifications,
        {
          id: crypto.randomUUID(),
          message,
          level,
        },
      ],
    })),
  dismissNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((notification) => notification.id !== id),
    })),
  clearNotifications: () =>
    set(() => ({
      notifications: [],
    })),
});