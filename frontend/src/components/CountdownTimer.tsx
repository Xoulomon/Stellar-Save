/**
 * CountdownTimer
 *
 * Displays time remaining until a group's next contribution deadline.
 * Turns amber when < 24 h remain and red when < 1 h remain.
 * Reads the deadline from the on-chain `get_contribution_deadline` call.
 */

import { useCallback, useEffect, useState } from 'react';
import { useInterval } from '../hooks/useInterval';
import { getContributionDeadline } from '../lib/contractClient';
import './CountdownTimer.css';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CountdownTimerProps {
  /** Numeric group ID (bigint) */
  groupId: bigint;
  /** Current cycle number (1-based) */
  cycleNumber: number;
  /** Optional label shown above the timer */
  label?: string;
  className?: string;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
}

type Urgency = 'normal' | 'warning' | 'critical';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcTimeLeft(deadlineMs: number): TimeLeft {
  const diff = Math.max(0, deadlineMs - Date.now());
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds, totalSeconds };
}

function getUrgency(totalSeconds: number): Urgency {
  if (totalSeconds <= 3600) return 'critical';   // < 1 h
  if (totalSeconds <= 86400) return 'warning';   // < 24 h
  return 'normal';
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

// ─── Segment ──────────────────────────────────────────────────────────────────

function Segment({ value, label }: { value: number; label: string }) {
  return (
    <div className="countdown-segment">
      <span className="countdown-segment__value">{pad(value)}</span>
      <span className="countdown-segment__label">{label}</span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CountdownTimer({
  groupId,
  cycleNumber,
  label = 'Next contribution deadline',
  className = '',
}: CountdownTimerProps) {
  const [deadlineMs, setDeadlineMs] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch deadline from chain once on mount / when groupId or cycle changes
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    getContributionDeadline(groupId, cycleNumber)
      .then((unixSecs) => {
        if (cancelled) return;
        const ms = Number(unixSecs) * 1000;
        setDeadlineMs(ms);
        setTimeLeft(calcTimeLeft(ms));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(
          err instanceof Error ? err.message : 'Failed to load deadline.',
        );
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [groupId, cycleNumber]);

  // Tick every second while deadline is loaded
  const tick = useCallback(() => {
    if (deadlineMs !== null) {
      setTimeLeft(calcTimeLeft(deadlineMs));
    }
  }, [deadlineMs]);

  useInterval(tick, deadlineMs !== null ? 1000 : null);

  // ── Render states ──────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className={`countdown-timer countdown-timer--loading ${className}`} aria-busy="true">
        <span className="countdown-timer__label">{label}</span>
        <div className="countdown-timer__skeleton" aria-label="Loading deadline…" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={`countdown-timer countdown-timer--error ${className}`} role="alert">
        <span className="countdown-timer__label">{label}</span>
        <span className="countdown-timer__error-msg">{loadError}</span>
      </div>
    );
  }

  if (!timeLeft) return null;

  if (timeLeft.totalSeconds === 0) {
    return (
      <div className={`countdown-timer countdown-timer--expired ${className}`} role="status">
        <span className="countdown-timer__label">{label}</span>
        <span className="countdown-timer__expired-msg">Deadline passed</span>
      </div>
    );
  }

  const urgency = getUrgency(timeLeft.totalSeconds);

  return (
    <div
      className={[
        'countdown-timer',
        `countdown-timer--${urgency}`,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      role="timer"
      aria-label={`${label}: ${timeLeft.days}d ${timeLeft.hours}h ${timeLeft.minutes}m ${timeLeft.seconds}s remaining`}
      aria-live={urgency !== 'normal' ? 'polite' : undefined}
    >
      <span className="countdown-timer__label">{label}</span>

      {urgency !== 'normal' && (
        <span className="countdown-timer__urgency-badge" aria-hidden="true">
          {urgency === 'critical' ? '⚠ Less than 1 hour!' : '⏰ Less than 24 hours'}
        </span>
      )}

      <div className="countdown-timer__segments">
        {timeLeft.days > 0 && <Segment value={timeLeft.days} label="days" />}
        <Segment value={timeLeft.hours} label="hrs" />
        <Segment value={timeLeft.minutes} label="min" />
        <Segment value={timeLeft.seconds} label="sec" />
      </div>
    </div>
  );
}

export default CountdownTimer;
