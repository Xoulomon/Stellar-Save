import { useState, useRef, useEffect, useCallback } from 'react';
import './Dropdown.css';

type DropdownPosition = 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';

interface DropdownItem {
  id: string;
  label: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
  divider?: boolean;
}

interface DropdownProps {
  trigger: React.ReactElement;
  items: DropdownItem[];
  position?: DropdownPosition;
  className?: string;
  menuClassName?: string;
  disabled?: boolean;
}

export function Dropdown({
  trigger,
  items,
  position = 'bottom-start',
  className = '',
  menuClassName = '',
  disabled = false,
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const enabledItems = items.filter(item => !item.disabled && !item.divider);

  const calculatePosition = useCallback(() => {
    if (!triggerRef.current || !menuRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const menuRect = menuRef.current.getBoundingClientRect();
    const gap = 4;

    let top = 0;
    let left = 0;

    switch (position) {
      case 'bottom-start':
        top = triggerRect.bottom + gap;
        left = triggerRect.left;
        break;
      case 'bottom-end':
        top = triggerRect.bottom + gap;
        left = triggerRect.right - menuRect.width;
        break;
      case 'top-start':
        top = triggerRect.top - menuRect.height - gap;
        left = triggerRect.left;
        break;
      case 'top-end':
        top = triggerRect.top - menuRect.height - gap;
        left = triggerRect.right - menuRect.width;
        break;
    }

    // Keep menu within viewport
    const padding = 8;
    if (left < padding) left = padding;
    if (left + menuRect.width > window.innerWidth - padding) {
      left = window.innerWidth - menuRect.width - padding;
    }
    if (top < padding) top = padding;
    if (top + menuRect.height > window.innerHeight - padding) {
      top = window.innerHeight - menuRect.height - padding;
    }

    setCoords({ top, left });
  }, [position]);

  const openDropdown = useCallback(() => {
    if (disabled) return;
    setIsOpen(true);
    setFocusedIndex(-1);
  }, [disabled]);

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setFocusedIndex(-1);
  }, []);

  const handleItemClick = useCallback((item: DropdownItem) => {
    if (item.disabled) return;
    item.onClick?.();
    closeDropdown();
  }, [closeDropdown]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        closeDropdown();
        triggerRef.current?.querySelector('button')?.focus();
        break;
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev => {
          const nextIndex = prev + 1;
          return nextIndex >= enabledItems.length ? 0 : nextIndex;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => {
          const nextIndex = prev - 1;
          return nextIndex < 0 ? enabledItems.length - 1 : nextIndex;
        });
        break;
      case 'Home':
        e.preventDefault();
        setFocusedIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setFocusedIndex(enabledItems.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < enabledItems.length) {
          handleItemClick(enabledItems[focusedIndex]);
        }
        break;
    }
  }, [isOpen, focusedIndex, enabledItems, closeDropdown, handleItemClick]);

  // Handle click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node) &&
        menuRef.current &&
        !menuRef.current.contains(e.target as Node)
      ) {
        closeDropdown();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, closeDropdown]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  // Calculate position when opened
  useEffect(() => {
    if (isOpen) {
      calculatePosition();
      window.addEventListener('scroll', calculatePosition, true);
      window.addEventListener('resize', calculatePosition);

      return () => {
        window.removeEventListener('scroll', calculatePosition, true);
        window.removeEventListener('resize', calculatePosition);
      };
    }
  }, [isOpen, calculatePosition]);

  // Focus management
  useEffect(() => {
    if (focusedIndex >= 0 && focusedIndex < itemRefs.current.length) {
      itemRefs.current[focusedIndex]?.focus();
    }
  }, [focusedIndex]);

  const menuId = useRef(`dropdown-menu-${Math.random().toString(36).substr(2, 9)}`);

  const triggerWithProps = {
    ...trigger,
    props: {
      ...trigger.props,
      onClick: (e: React.MouseEvent) => {
        if (isOpen) {
          closeDropdown();
        } else {
          openDropdown();
        }
        trigger.props.onClick?.(e);
      },
      'aria-expanded': isOpen,
      'aria-haspopup': 'menu' as const,
      'aria-controls': isOpen ? menuId.current : undefined,
    },
  };

  let enabledItemIndex = -1;

  return (
    <div className={`dropdown ${className}`}>
      <div ref={triggerRef} className="dropdown-trigger">
        {triggerWithProps}
      </div>

      {isOpen && (
        <div
          ref={menuRef}
          id={menuId.current}
          role="menu"
          className={`dropdown-menu ${menuClassName}`}
          style={{
            top: `${coords.top}px`,
            left: `${coords.left}px`,
          }}
        >
          {items.map((item, index) => {
            if (item.divider) {
              return <div key={item.id} className="dropdown-divider" role="separator" />;
            }

            enabledItemIndex++;
            const currentEnabledIndex = enabledItemIndex;

            return (
              <button
                key={item.id}
                ref={el => {
                  if (!item.disabled) {
                    itemRefs.current[currentEnabledIndex] = el;
                  }
                }}
                role="menuitem"
                className={`dropdown-item ${item.disabled ? 'dropdown-item-disabled' : ''}`}
                onClick={() => handleItemClick(item)}
                disabled={item.disabled}
                tabIndex={-1}
              >
                {item.icon && <span className="dropdown-item-icon">{item.icon}</span>}
                <span className="dropdown-item-label">{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
