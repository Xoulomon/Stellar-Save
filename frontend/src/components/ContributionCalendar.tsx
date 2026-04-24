import { useMemo, useState } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import type { GroupContribution, GroupCycle } from '../utils/groupApi';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './ContributionCalendar.css';

const localizer = momentLocalizer(moment);

export type CalendarView = 'month' | 'week' | 'day';

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  status: 'completed' | 'pending' | 'failed' | 'deadline';
}

function buildEvents(
  contributions: GroupContribution[],
  currentCycle: GroupCycle | null,
): CalendarEvent[] {
  const events: CalendarEvent[] = contributions.map((c) => ({
    id: c.id,
    title: c.status === 'completed' ? `✓ ${c.memberName ?? c.memberId}` : c.memberName ?? c.memberId,
    start: c.timestamp,
    end: c.timestamp,
    status: c.status,
  }));

  if (currentCycle?.status === 'active') {
    events.push({
      id: `deadline-${currentCycle.cycleNumber}`,
      title: `⏰ Deadline — Cycle ${currentCycle.cycleNumber}`,
      start: currentCycle.endDate,
      end: currentCycle.endDate,
      status: 'deadline',
    });
  }

  return events;
}

const EVENT_CLASS: Record<CalendarEvent['status'], string> = {
  completed: 'cal-event--completed',
  pending: 'cal-event--pending',
  failed: 'cal-event--failed',
  deadline: 'cal-event--deadline',
};

interface ContributionCalendarProps {
  contributions: GroupContribution[];
  currentCycle: GroupCycle | null;
  onContribute?: (date: Date) => void;
}

export function ContributionCalendar({
  contributions,
  currentCycle,
  onContribute,
}: ContributionCalendarProps) {
  const [view, setView] = useState<CalendarView>('month');

  const events = useMemo(
    () => buildEvents(contributions, currentCycle),
    [contributions, currentCycle],
  );

  return (
    <div className="contribution-calendar" data-testid="contribution-calendar">
      <Calendar<CalendarEvent>
        localizer={localizer}
        events={events}
        view={view}
        onView={(v) => setView(v as CalendarView)}
        views={['month', 'week', 'day']}
        selectable={!!onContribute}
        onSelectSlot={({ start }: { start: Date }) => onContribute?.(start)}
        onSelectEvent={(event: CalendarEvent) => {
          if (event.status === 'deadline') onContribute?.(event.start);
        }}
        eventPropGetter={(event: CalendarEvent) => ({ className: EVENT_CLASS[event.status] })}
        style={{ height: 600 }}
        aria-label="Contribution calendar"
      />
    </div>
  );
}
