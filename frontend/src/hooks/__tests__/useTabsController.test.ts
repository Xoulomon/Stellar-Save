import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { useTabsController } from '../useTabsController';

import type { Tab } from '../../components/Tabs';

const mockTabs: Tab[] = [
  { id: 'tab1', label: 'Tab 1', content: null },
  { id: 'tab2', label: 'Tab 2', content: null },
  { id: 'tab3', label: 'Tab 3', content: null, disabled: true },
];

describe('useTabsController', () => {
  it('defaults active tab to the first tab', () => {
    const { result } = renderHook(() => useTabsController({ tabs: mockTabs }));
    expect(result.current.activeTab).toBe('tab1');
  });

  it('respects defaultTab', () => {
    const { result } = renderHook(() =>
      useTabsController({ tabs: mockTabs, defaultTab: 'tab2' })
    );
    expect(result.current.activeTab).toBe('tab2');
  });

  it('updates active tab on handleTabClick when uncontrolled', () => {
    const { result } = renderHook(() => useTabsController({ tabs: mockTabs }));

    act(() => {
      result.current.handleTabClick('tab2');
    });

    expect(result.current.activeTab).toBe('tab2');
  });

  it('does not update active tab when disabled', () => {
    const { result } = renderHook(() => useTabsController({ tabs: mockTabs }));

    act(() => {
      result.current.handleTabClick('tab3', true);
    });

    expect(result.current.activeTab).toBe('tab1');
  });

  it('calls onChange with the clicked tab id', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useTabsController({ tabs: mockTabs, onChange }));

    act(() => {
      result.current.handleTabClick('tab2');
    });

    expect(onChange).toHaveBeenCalledWith('tab2');
  });

  it('stays on controlled activeTab regardless of handleTabClick', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useTabsController({ tabs: mockTabs, activeTab: 'tab1', onChange })
    );

    act(() => {
      result.current.handleTabClick('tab2');
    });

    expect(result.current.activeTab).toBe('tab1');
    expect(onChange).toHaveBeenCalledWith('tab2');
  });

  it('advances to the next enabled tab on ArrowRight, skipping disabled tabs', () => {
    const { result } = renderHook(() => useTabsController({ tabs: mockTabs }));
    const preventDefault = vi.fn();

    act(() => {
      result.current.handleKeyDown(
        { key: 'ArrowRight', preventDefault } as unknown as React.KeyboardEvent<HTMLButtonElement>,
        0
      );
    });

    expect(preventDefault).toHaveBeenCalled();
    expect(result.current.activeTab).toBe('tab2');
  });

  it('wraps to the first tab on ArrowRight from the last enabled tab', () => {
    const { result } = renderHook(() => useTabsController({ tabs: mockTabs, defaultTab: 'tab2' }));
    const preventDefault = vi.fn();

    act(() => {
      result.current.handleKeyDown(
        { key: 'ArrowRight', preventDefault } as unknown as React.KeyboardEvent<HTMLButtonElement>,
        1
      );
    });

    expect(result.current.activeTab).toBe('tab1');
  });

  it('jumps to first/last enabled tab on Home/End', () => {
    const { result } = renderHook(() => useTabsController({ tabs: mockTabs, defaultTab: 'tab2' }));
    const preventDefault = vi.fn();

    act(() => {
      result.current.handleKeyDown(
        { key: 'Home', preventDefault } as unknown as React.KeyboardEvent<HTMLButtonElement>,
        1
      );
    });
    expect(result.current.activeTab).toBe('tab1');

    act(() => {
      result.current.handleKeyDown(
        { key: 'End', preventDefault } as unknown as React.KeyboardEvent<HTMLButtonElement>,
        0
      );
    });
    expect(result.current.activeTab).toBe('tab2');
  });

  it('respects vertical orientation for Arrow keys', () => {
    const { result } = renderHook(() =>
      useTabsController({ tabs: mockTabs, orientation: 'vertical' })
    );
    const preventDefault = vi.fn();

    act(() => {
      result.current.handleKeyDown(
        { key: 'ArrowDown', preventDefault } as unknown as React.KeyboardEvent<HTMLButtonElement>,
        0
      );
    });

    expect(result.current.activeTab).toBe('tab2');
  });
});
