import './Tabs.css';
import { useTabsController } from '../hooks/useTabsController';

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
  const { activeTab, registerTabRef, handleTabClick, handleKeyDown } = useTabsController({
    tabs,
    defaultTab,
    activeTab: controlledActiveTab,
    onChange,
    orientation,
  });

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
              ref={(el) => registerTabRef(tab.id, el)}
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
