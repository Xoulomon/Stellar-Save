import { useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import './MemberContributionTimeline.css';

export type ContributionEventType = 'contribution' | 'payout' | 'join';

export interface ContributionTimelineEvent {
  id: string;
  groupId: string;
  groupName: string;
  type: ContributionEventType;
  timestamp: Date;
  amount?: number;
  description?: string;
  transactionHash?: string;
  status?: 'completed' | 'pending' | 'failed';
}

export interface MemberContributionTimelineProps {
  events: ContributionTimelineEvent[];
  maxHeight?: string;
  onEventClick?: (event: ContributionTimelineEvent) => void;
  emptyStateMessage?: string;
  className?: string;
}

const GROUP_ALL = 'all';

function formatDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseDateInputValue(value: string) {
  return value ? new Date(`${value}T00:00:00Z`) : null;
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatAmount(amount?: number) {
  if (amount === undefined || amount === null) return '';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function getTypeLabel(type: ContributionEventType) {
  switch (type) {
    case 'contribution':
      return 'Contribution';
    case 'payout':
      return 'Payout';
    case 'join':
      return 'Joined';
    default:
      return 'Activity';
  }
}

function getTypeClass(type: ContributionEventType) {
  switch (type) {
    case 'contribution':
      return 'timeline-card-contribution';
    case 'payout':
      return 'timeline-card-payout';
    case 'join':
      return 'timeline-card-join';
    default:
      return 'timeline-card-default';
  }
}

export function MemberContributionTimeline({
  events,
  maxHeight = '520px',
  onEventClick,
  emptyStateMessage = 'No contributions found for this period.',
  className = '',
}: MemberContributionTimelineProps) {
  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()),
    [events],
  );

  const groups = useMemo(() => {
    const unique = new Map<string, string>();
    sortedEvents.forEach((event) => {
      if (!unique.has(event.groupId)) {
        unique.set(event.groupId, event.groupName);
      }
    });
    return [{ id: GROUP_ALL, name: 'All groups' }, ...Array.from(unique, ([id, name]) => ({ id, name }))];
  }, [sortedEvents]);

  const [selectedGroup, setSelectedGroup] = useState<string>(GROUP_ALL);
  const [zoomLevel, setZoomLevel] = useState<number>(2);
  const [rangeStart, setRangeStart] = useState<string>(() => {
    const first = sortedEvents[0]?.timestamp ?? new Date();
    return formatDateInputValue(first);
  });
  const [rangeEnd, setRangeEnd] = useState<string>(() => {
    const last = sortedEvents[sortedEvents.length - 1]?.timestamp ?? new Date();
    return formatDateInputValue(last);
  });

  const timelineRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef<{ startX: number; scrollLeft: number } | null>(null);

  const filteredEvents = useMemo(() => {
    const startDate = parseDateInputValue(rangeStart);
    const endDate = parseDateInputValue(rangeEnd);

    return sortedEvents.filter((event) => {
      const matchesGroup = selectedGroup === GROUP_ALL || event.groupId === selectedGroup;
      const isAfterStart = !startDate || event.timestamp >= startDate;
      const isBeforeEnd = !endDate || event.timestamp <= new Date(endDate.getTime() + 86400000 - 1);
      return matchesGroup && isAfterStart && isBeforeEnd;
    });
  }, [selectedGroup, rangeStart, rangeEnd, sortedEvents]);

  const handleZoomChange = (delta: number) => {
    setZoomLevel((current) => Math.min(4, Math.max(1, current + delta)));
  };

  const handleMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    dragState.current = {
      startX: event.clientX,
      scrollLeft: target.scrollLeft,
    };
    target.style.cursor = 'grabbing';
    target.style.userSelect = 'none';
  };

  const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    if (!dragState.current || !timelineRef.current) return;
    const deltaX = event.clientX - dragState.current.startX;
    timelineRef.current.scrollLeft = dragState.current.scrollLeft - deltaX;
  };

  const handleMouseUp = () => {
    dragState.current = null;
    if (timelineRef.current) {
      timelineRef.current.style.cursor = 'grab';
      timelineRef.current.style.removeProperty('user-select');
    }
  };

  const zoomMessage = ['Compact', 'Cozy', 'Comfort', 'Expanded'][zoomLevel - 1] ?? 'Cozy';

  const pixelWidth = 210 + zoomLevel * 60;

  return (
    <div className={`member-contribution-timeline ${className}`}>
      <div className="timeline-toolbar">
        <div className="timeline-title-section">
          <div className="timeline-header-icon">⏱️</div>
          <div>
            <h3 className="timeline-title">Contribution Timeline</h3>
            <p className="timeline-subtitle">Track contributions across all groups in one view.</p>
          </div>
        </div>

        <div className="timeline-controls">
          <div className="timeline-control-group">
            <label htmlFor="group-filter">Group</label>
            <select
              id="group-filter"
              value={selectedGroup}
              onChange={(event) => setSelectedGroup(event.target.value)}
            >
              {groups.map((group) => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
          </div>

          <div className="timeline-control-group">
            <label htmlFor="start-date">From</label>
            <input
              id="start-date"
              type="date"
              value={rangeStart}
              onChange={(event) => setRangeStart(event.target.value)}
              max={rangeEnd}
            />
          </div>

          <div className="timeline-control-group">
            <label htmlFor="end-date">To</label>
            <input
              id="end-date"
              type="date"
              value={rangeEnd}
              onChange={(event) => setRangeEnd(event.target.value)}
              min={rangeStart}
            />
          </div>

          <div className="timeline-control-group timeline-zoom-group">
            <span>Zoom</span>
            <button aria-label="Zoom out" type="button" onClick={() => handleZoomChange(-1)} disabled={zoomLevel <= 1}>–</button>
            <span className="timeline-zoom-label">{zoomMessage}</span>
            <button aria-label="Zoom in" type="button" onClick={() => handleZoomChange(1)} disabled={zoomLevel >= 4}>+</button>
          </div>
        </div>
      </div>

      {filteredEvents.length === 0 ? (
        <div className="timeline-empty-state">
          <p>{emptyStateMessage}</p>
        </div>
      ) : (
        <div
          ref={timelineRef}
          className="timeline-scroll-container"
          style={{ maxHeight }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseUp}
          onMouseUp={handleMouseUp}
          role="group"
          aria-label="Contribution timeline"
        >
          <div className="timeline-grid" style={{ minWidth: `${filteredEvents.length * pixelWidth}px` }}>
            {filteredEvents.map((event) => (
              <button
                key={event.id}
                type="button"
                className={`timeline-card ${getTypeClass(event.type)}`}
                onClick={() => onEventClick?.(event)}
                onKeyDown={(e: KeyboardEvent<HTMLButtonElement>) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onEventClick?.(event);
                  }
                }}
              >
                <div className="timeline-card-top">
                  <div className="timeline-card-badge">{getTypeLabel(event.type)}</div>
                  <div className="timeline-card-group">{event.groupName}</div>
                </div>
                <div className="timeline-card-body">
                  <p className="timeline-card-date">{formatDateTime(event.timestamp)}</p>
                  {event.amount !== undefined && (
                    <p className="timeline-card-amount">{formatAmount(event.amount)}</p>
                  )}
                  {event.description && (
                    <p className="timeline-card-description">{event.description}</p>
                  )}
                </div>
                <div className="timeline-card-footer">
                  <span>{event.transactionHash ? `Tx ${event.transactionHash.slice(0, 8)}...` : 'No tx available'}</span>
                  {event.status && <span className={`timeline-card-status status-${event.status}`}>{event.status}</span>}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default MemberContributionTimeline;
