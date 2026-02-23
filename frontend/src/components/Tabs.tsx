import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import './Tabs.css';

export interface Tab {
  id: string;
  label: string;
  content: React.ReactNode;
  disabled?: boolean;
  icon?: React.ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  activeTab?: string;
  onChange?: (tabId: string) => void;
  variant?: 'default' | 'pills' | 'underline';
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

export function Tabs({
  tabs,
  defaultTab,
  activeTab: controlledActiveTab,
  onChange,
  variant = 'default',
  orientation = 'horizontal',
  className = '',
}: TabsProps) {
  const isControlled = controlledActiveTab !== undefined;
  const [internalActiveTab, setInternalActiveTab] = useState(
    defaultTab || tabs[0]?.id || ''
  );
  const activeTab = isControlled ? controlledActiveTab : internalActiveTab;
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const handleTabClick = (tabId: string, disabled?: boolean) => {
    if (disabled) return;
    
    if (!isControlled) {
      setInternalActiveTab(tabId);
    }
    onChange?.(tabId);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    const enabledTabs = tabs.filter(tab => !tab.disabled);
    const currentEnabledIndex = enabledTabs.findIndex(tab => tab.id === tabs[currentIndex].id);
    
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
    if (activeTab && !tabs.find(tab => tab.id === activeTab)) {
      const firstEnabledTab = tabs.find(tab => !tab.disabled);
      if (firstEnabledTab && !isControlled) {
        setInternalActiveTab(firstEnabledTab.id);
      }
    }
  }, [tabs, activeTab, isControlled]);

  const activeTabContent = tabs.find(tab => tab.id === activeTab)?.content;

  const classes = [
    'tabs',
    `tabs-${variant}`,
    `tabs-${orientation}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      <div className="tabs-list" role="tablist" aria-orientation={orientation}>
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeTab;
          const tabClasses = [
            'tabs-trigger',
            isActive ? 'tabs-trigger-active' : '',
            tab.disabled ? 'tabs-trigger-disabled' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <button
              key={tab.id}
              ref={(el) => {
                if (el) {
                  tabRefs.current.set(tab.id, el);
                } else {
                  tabRefs.current.delete(tab.id);
                }
              }}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              aria-disabled={tab.disabled}
              id={`tab-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              className={tabClasses}
              onClick={() => handleTabClick(tab.id, tab.disabled)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              disabled={tab.disabled}
            >
              {tab.icon && <span className="tabs-trigger-icon">{tab.icon}</span>}
              {tab.label}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
        className="tabs-content"
        tabIndex={0}
      >
        {activeTabContent}
      </div>
    </div>
  );
}
