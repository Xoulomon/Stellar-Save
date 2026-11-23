import { useSyncExternalStore } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface AppStoreState {
  themeMode: ThemeMode;
}

type AppStoreListener = () => void;

export class AppStore {
  private state: AppStoreState;
  private readonly listeners = new Set<AppStoreListener>();

  constructor(initialState: AppStoreState) {
    this.state = initialState;
  }

  getSnapshot = (): AppStoreState => this.state;

  subscribe = (listener: AppStoreListener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  setState = (partial: Partial<AppStoreState>): void => {
    const nextState = { ...this.state, ...partial };
    if (
      Object.keys(partial).every(
        (key) => this.state[key as keyof AppStoreState] === nextState[key as keyof AppStoreState]
      )
    ) {
      return;
    }
    this.state = nextState;
    this.listeners.forEach((listener) => listener());
  };
}

function readStoredThemeMode(): ThemeMode {
  try {
    const stored = localStorage.getItem('stellar-save-theme');
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    // localStorage unavailable (SSR / private browsing)
  }
  return 'system';
}

export const appStore = new AppStore({
  themeMode: readStoredThemeMode(),
});

export function useAppStore<T>(selector: (state: AppStoreState) => T): T {
  return useSyncExternalStore(
    appStore.subscribe,
    () => selector(appStore.getSnapshot()),
    () => selector(appStore.getSnapshot())
  );
}
