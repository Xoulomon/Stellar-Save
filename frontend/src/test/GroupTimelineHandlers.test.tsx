import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { GroupTimeline, type TimelineEvent } from '../components/GroupTimeline';

const event: TimelineEvent = {
  id: 'e1',
  type: 'member_join',
  memberAddress: 'GABCDEFGHIJKLMNOPWXYZ',
  timestamp: new Date(2025, 0, 5),
};

describe('GroupTimeline keyboard handler', () => {
  it('calls onEventClick on Enter/Space but not other keys', () => {
    const onEventClick = vi.fn();
    render(<GroupTimeline events={[event]} onEventClick={onEventClick} />);
    const item = screen.getByRole('button');

    fireEvent.keyDown(item, { key: 'Tab' });
    expect(onEventClick).not.toHaveBeenCalled();

    fireEvent.keyDown(item, { key: 'Enter' });
    fireEvent.keyDown(item, { key: ' ' });
    expect(onEventClick).toHaveBeenCalledTimes(2);
    expect(onEventClick).toHaveBeenCalledWith(event);
  });
});
