import { useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { Box, Stack } from '@mui/material';

const VIEWPORT_HEIGHT = 640;
const OVERSCAN_ROWS = 3;

interface VirtualizedListProps<T> {
  items: T[];
  itemHeight: number;
  getKey: (item: T) => string;
  renderItem: (item: T, index: number) => ReactNode;
  label: string;
}

/** Render only the visible rows for large lists, with keyboard row navigation. */
export function VirtualizedList<T>({
  items,
  itemHeight,
  getKey,
  renderItem,
  label,
}: VirtualizedListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<number, HTMLDivElement>());

  if (items.length <= 100) {
    return (
      <Stack spacing={0} role="list" aria-label={label}>
        {items.map((item, index) => (
          <Box key={getKey(item)} role="listitem">
            {renderItem(item, index)}
          </Box>
        ))}
      </Stack>
    );
  }

  const visibleRows = Math.ceil(VIEWPORT_HEIGHT / itemHeight);
  const start = Math.max(0, Math.floor(scrollTop / itemHeight) - OVERSCAN_ROWS);
  const end = Math.min(items.length, start + visibleRows + OVERSCAN_ROWS * 2);

  const moveTo = (index: number) => {
    const next = Math.max(0, Math.min(items.length - 1, index));
    const nextTop = Math.max(0, next * itemHeight - VIEWPORT_HEIGHT / 2);
    setActiveIndex(next);
    setScrollTop(nextTop);
    if (viewportRef.current) viewportRef.current.scrollTop = nextTop;
    requestAnimationFrame(() => rowRefs.current.get(next)?.focus());
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>, index = activeIndex) => {
    let next: number | undefined;
    if (event.key === 'ArrowDown') next = index + 1;
    if (event.key === 'ArrowUp') next = index - 1;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = items.length - 1;
    if (next !== undefined) {
      event.preventDefault();
      moveTo(next);
    }
  };

  return (
    <Box
      ref={viewportRef}
      role="list"
      aria-label={label}
      tabIndex={0}
      onKeyDown={(event) => handleKeyDown(event)}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      sx={{ height: VIEWPORT_HEIGHT, overflowY: 'auto', overflowAnchor: 'none' }}
    >
      <Box sx={{ height: items.length * itemHeight, position: 'relative' }}>
        <Box sx={{ position: 'absolute', top: start * itemHeight, left: 0, right: 0 }}>
          {items.slice(start, end).map((item, offset) => {
            const index = start + offset;
            return (
              <Box
                key={getKey(item)}
                ref={(node: HTMLDivElement | null) => {
                  if (node) rowRefs.current.set(index, node);
                  else rowRefs.current.delete(index);
                }}
                role="listitem"
                tabIndex={activeIndex === index ? 0 : -1}
                aria-posinset={index + 1}
                aria-setsize={items.length}
                data-virtual-index={index}
                onFocus={() => setActiveIndex(index)}
                onKeyDown={(event) => handleKeyDown(event, index)}
                sx={{ height: itemHeight, boxSizing: 'border-box', outlineOffset: -2 }}
              >
                {renderItem(item, index)}
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}
