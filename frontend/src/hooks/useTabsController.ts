import { useRef, useState, useEffect } from 'react';

import type { Tab } from '../components/Tabs';
import type { KeyboardEvent } from 'react';

export interface UseTabsControllerOptions {
  tabs: Tab[];
  defaultTab?: string;
  activeTab?: string;
  onChange?: (tabId: string) => void;
  orientation?: 'horizontal' | 'vertical';
}

export function useTabsController({
  tabs,
  defaultTab,
  activeTab: controlledActiveTab,
  onChange,
  orientation = 'horizontal',
}: UseTabsControllerOptions) {
  const isControlled = controlledActiveTab !== undefined;
  const [internalActiveTab, setInternalActiveTab] = useState(
    defaultTab || tabs[0]?.id || ''
  );
  const activeTab = isControlled ? controlledActiveTab : internalActiveTab;
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const registerTabRef = (tabId: string, el: HTMLButtonElement | null) => {
    if (el) {
      tabRefs.current.set(tabId, el);
    } else {
      tabRefs.current.delete(tabId);
    }
  };

  const handleTabClick = (tabId: string, disabled?: boolean) => {
    if (disabled) return;

    if (!isControlled) {
      setInternalActiveTab(tabId);
    }
    onChange?.(tabId);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    const enabledTabs = tabs.filter((tab) => !tab.disabled);
    const currentEnabledIndex = enabledTabs.findIndex((tab) => tab.id === tabs[currentIndex].id);

    let nextIndex = currentEnabledIndex;
    const isHorizontal = orientation === 'horizontal';

    switch (e.key) {
      case isHorizontal ? 'ArrowRight' : 'ArrowDown':
        e.preventDefault();
        nextIndex = (currentEnabledIndex + 1) % enabledTabs.length;
        break;
      case isHorizontal ? 'ArrowLeft' : 'ArrowUp':
        e.preventDefault();
        nextIndex = (currentEnabledIndex - 1 + enabledTabs.length) % enabledTabs.length;
        break;
      case 'Home':
        e.preventDefault();
        nextIndex = 0;
        break;
      case 'End':
        e.preventDefault();
        nextIndex = enabledTabs.length - 1;
        break;
      default:
        return;
    }

    const nextTab = enabledTabs[nextIndex];
    if (nextTab) {
      handleTabClick(nextTab.id, nextTab.disabled);
      tabRefs.current.get(nextTab.id)?.focus();
    }
  };

  useEffect(() => {
    // Ensure active tab is valid
    if (activeTab && !tabs.find((tab) => tab.id === activeTab)) {
      const firstEnabledTab = tabs.find((tab) => !tab.disabled);
      if (firstEnabledTab && !isControlled) {
        setInternalActiveTab(firstEnabledTab.id);
      }
    }
  }, [tabs, activeTab, isControlled]);

  return {
    activeTab,
    registerTabRef,
    handleTabClick,
    handleKeyDown,
  };
}
