import { useMemo, type KeyboardEvent } from "react";
import {
  AccessTime,
  PersonAdd,
  TrendingUp,
  CreditCard,
} from "@mui/icons-material";
import "./GroupTimeline.css";

export type TimelineEventType = "contribution" | "payout" | "member_join";

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  memberAddress: string;
  memberName?: string;
  timestamp: Date;
  amount?: number;
  description?: string;
  transactionHash?: string;
  status?: "completed" | "pending" | "failed";
}

export interface GroupTimelineProps {
  events: TimelineEvent[];
  maxHeight?: string;
  onEventClick?: (event: TimelineEvent) => void;
  emptyStateMessage?: string;
  className?: string;
}

export function GroupTimeline({
  events,
  maxHeight = "600px",
  onEventClick,
  emptyStateMessage = "No activity yet",
  className = "",
}: GroupTimelineProps) {
  // Sort events by timestamp (newest first)
  const sortedEvents = useMemo(() => {
    return [...events].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
    );
  }, [events]);

  // Format date and time
  const formatDateTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  // Format currency
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Shorten wallet address
  const shortenAddress = (address: string) => {
    if (!address) return "Unknown";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Get icon component based on event type
  const getEventIcon = (type: TimelineEventType) => {
    switch (type) {
      case "contribution":
        return (
          <TrendingUp className="timeline-event-icon timeline-icon-contribution" />
        );
      case "payout":
        return (
          <CreditCard className="timeline-event-icon timeline-icon-payout" />
        );
      case "member_join":
        return (
          <PersonAdd className="timeline-event-icon timeline-icon-member-join" />
        );
      default:
        return <AccessTime className="timeline-event-icon" />;
    }
  };

  // Get event title
  const getEventTitle = (event: TimelineEvent) => {
    const memberDisplay =
      event.memberName || shortenAddress(event.memberAddress);

    switch (event.type) {
      case "contribution":
        return `${memberDisplay} contributed${event.amount ? ` ${formatAmount(event.amount)}` : ""}`;
      case "payout":
        return `${memberDisplay} received payout${event.amount ? ` of ${formatAmount(event.amount)}` : ""}`;
      case "member_join":
        return `${memberDisplay} joined the group`;
      default:
        return "Activity";
    }
  };

  // Get event color class
  const getEventColorClass = (type: TimelineEventType) => {
    switch (type) {
      case "contribution":
        return "timeline-event-contribution";
      case "payout":
        return "timeline-event-payout";
      case "member_join":
        return "timeline-event-member-join";
      default:
        return "timeline-event-default";
    }
  };

  return (
    <div className={`group-timeline ${className}`}>
      <div className="timeline-header">
        <div className="timeline-title-section">
          <AccessTime className="timeline-header-icon" />
          <h3 className="timeline-title">Activity Timeline</h3>
        </div>
        <span className="timeline-event-count">{events.length}</span>
      </div>

      {sortedEvents.length === 0 ? (
        <div className="timeline-empty-state">
          <div className="timeline-empty-icon">
            <AccessTime />
          </div>
          <p className="timeline-empty-text">{emptyStateMessage}</p>
        </div>
      ) : (
        <div className="timeline-container" style={{ maxHeight }}>
          <div className="timeline-list">
            {sortedEvents.map((event, index) => (
              <div
                key={event.id}
                className={`timeline-item ${getEventColorClass(event.type)}`}
                onClick={() => onEventClick?.(event)}
                role={onEventClick ? "button" : undefined}
                tabIndex={onEventClick ? 0 : undefined}
                onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
                  if (onEventClick && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    onEventClick(event);
                  }
                }}
              >
                <div className="timeline-item-dot">
                  {getEventIcon(event.type)}
                </div>

                {index < sortedEvents.length - 1 && (
                  <div className="timeline-item-line" />
                )}

                <div className="timeline-item-content">
                  <div className="timeline-item-header">
                    <p className="timeline-item-title">
                      {getEventTitle(event)}
                    </p>
                    {event.status === "pending" && (
                      <span className="timeline-item-status-badge status-pending">
                        Pending
                      </span>
                    )}
                    {event.status === "failed" && (
                      <span className="timeline-item-status-badge status-failed">
                        Failed
                      </span>
                    )}
                  </div>

                  <div className="timeline-item-meta">
                    <span className="timeline-item-time">
                      {formatDateTime(event.timestamp)}
                    </span>
                    {event.transactionHash && (
                      <span
                        className="timeline-item-hash"
                        title={event.transactionHash}
                      >
                        {shortenAddress(event.transactionHash)}
                      </span>
                    )}
                  </div>

                  {event.description && (
                    <p className="timeline-item-description">
                      {event.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default GroupTimeline;
