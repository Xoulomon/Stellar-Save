import { describe, expect, it, vi } from 'vitest';

import { AppStore } from './appStore';

describe('AppStore', () => {
  it('publishes state updates to subscribers', () => {
    const store = new AppStore({ themeMode: 'light' });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.setState({ themeMode: 'dark' });

    expect(store.getSnapshot()).toEqual({ themeMode: 'dark' });
    expect(listener).toHaveBeenCalledOnce();

    unsubscribe();
    store.setState({ themeMode: 'system' });
    expect(listener).toHaveBeenCalledOnce();
  });

  it('does not notify for unchanged state', () => {
    const store = new AppStore({ themeMode: 'light' });
    const listener = vi.fn();
    store.subscribe(listener);

    store.setState({ themeMode: 'light' });

    expect(listener).not.toHaveBeenCalled();
  });
});
