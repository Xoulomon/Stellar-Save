import { Profiler } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VirtualizedList } from '../components/VirtualizedList';

describe('VirtualizedList', () => {
  it('keeps a 500-row list bounded and supports keyboard navigation', async () => {
    const items = Array.from({ length: 500 }, (_, index) => ({ id: `member-${index}` }));
    const onRender = vi.fn();
    const { container } = render(
      <Profiler id="500-member-fixture" onRender={onRender}>
        <VirtualizedList
          items={items}
          itemHeight={64}
          getKey={(item) => item.id}
          label="500 member fixture"
          renderItem={(item) => <span>{item.id}</span>}
        />
      </Profiler>,
    );

    const list = screen.getByRole('list', { name: '500 member fixture' });
    expect(container.querySelectorAll('[role="listitem"]')).toHaveLength(16);
    expect(screen.getByText('member-0')).toBeInTheDocument();
    expect(screen.queryByText('member-499')).not.toBeInTheDocument();

    fireEvent.keyDown(list, { key: 'End' });
    expect(screen.getByText('member-499')).toBeInTheDocument();
    await waitFor(() => expect(document.activeElement).toHaveAttribute('data-virtual-index', '499'));
    expect(onRender).toHaveBeenCalled();
  });
});
