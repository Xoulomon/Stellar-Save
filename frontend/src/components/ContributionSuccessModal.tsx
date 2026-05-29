import { useEffect, useRef, useCallback } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import './ContributionSuccessModal.css';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ContributionSuccessModalProps {
  open: boolean;
  amount: number;
  cycleId: number;
  txHash?: string;
  /** When total contributions hit a milestone (e.g. 5th, 10th), pass the label */
  milestoneLabel?: string;
  onClose: () => void;
}

// ── Confetti ─────────────────────────────────────────────────────────────────

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#3b82f6', '#a855f7'];

function Confetti() {
  const particles = Array.from({ length: 28 }, (_, i) => {
    const color = COLORS[i % COLORS.length];
    const left = `${(i / 28) * 100}%`;
    const duration = `${0.9 + (i % 5) * 0.18}s`;
    const delay = `${(i % 7) * 0.07}s`;
    return { color, left, duration, delay, rotate: i % 2 === 0 };
  });

  return (
    <div className="confetti-container" aria-hidden="true">
      {particles.map((p, i) => (
        <div
          key={i}
          className="confetti-particle"
          style={{
            left: p.left,
            backgroundColor: p.color,
            borderRadius: p.rotate ? '50%' : '2px',
            animationDuration: p.duration,
            animationDelay: p.delay,
          }}
        />
      ))}
    </div>
  );
}

// ── Animated checkmark ───────────────────────────────────────────────────────

function AnimatedCheckmark() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <circle className="checkmark-circle" cx="32" cy="32" r="30" fill="#22c55e" />
      <polyline
        className="checkmark-path"
        points="18,33 27,43 46,22"
        stroke="white"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

// ── Sound effect (Web Audio API — no external dep) ───────────────────────────

function playSuccessSound() {
  try {
    const ctx = new AudioContext();
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = ctx.currentTime + i * 0.12;
      gain.gain.setValueAtTime(0.18, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
      osc.start(start);
      osc.stop(start + 0.35);
    });
  } catch {
    // AudioContext not available (e.g. in tests) — silently ignore
  }
}

// ── Social share ─────────────────────────────────────────────────────────────

function buildShareText(amount: number, cycleId: number, milestone?: string) {
  const base = `Just contributed ${amount} XLM to my savings circle (Cycle #${cycleId}) on @StellarSave! 🚀`;
  return milestone ? `${base} ${milestone} 🎉` : base;
}

function ShareButton({
  amount,
  cycleId,
  milestone,
}: {
  amount: number;
  cycleId: number;
  milestone?: string;
}) {
  const text = buildShareText(amount, cycleId, milestone);
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;

  return (
    <a
      href={twitterUrl}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 16px',
        borderRadius: '8px',
        background: '#1d9bf0',
        color: '#fff',
        fontSize: '13px',
        fontWeight: 600,
        textDecoration: 'none',
        transition: 'background 0.15s',
      }}
      onMouseOver={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = '#1a8cd8')}
      onMouseOut={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = '#1d9bf0')}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
      Share
    </a>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function ContributionSuccessModal({
  open,
  amount,
  cycleId,
  txHash,
  milestoneLabel,
  onClose,
}: ContributionSuccessModalProps) {
  const [muted, setMuted] = useLocalStorage('contribution-sound-muted', false);
  const playedRef = useRef(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) {
      playedRef.current = false;
      return;
    }
    document.addEventListener('keydown', handleKeyDown);
    if (!muted && !playedRef.current) {
      playedRef.current = true;
      playSuccessSound();
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, muted, handleKeyDown]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="success-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1300,
        padding: '16px',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="success-modal-content"
        style={{
          position: 'relative',
          background: '#fff',
          borderRadius: '20px',
          padding: '32px 28px 28px',
          maxWidth: '360px',
          width: '100%',
          textAlign: 'center',
          overflow: 'hidden',
        }}
      >
        <Confetti />

        {/* Mute toggle */}
        <button
          onClick={() => setMuted((v) => !v)}
          aria-label={muted ? 'Unmute sound' : 'Mute sound'}
          title={muted ? 'Unmute sound' : 'Mute sound'}
          style={{
            position: 'absolute',
            top: '12px',
            right: '44px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            color: '#9ca3af',
            fontSize: '18px',
            lineHeight: 1,
          }}
        >
          {muted ? '🔇' : '🔊'}
        </button>

        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            color: '#9ca3af',
            fontSize: '18px',
            lineHeight: 1,
          }}
        >
          ✕
        </button>

        {/* Checkmark */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
          <AnimatedCheckmark />
        </div>

        <h2
          id="success-modal-title"
          style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 700, color: '#111827' }}
        >
          Contribution Successful!
        </h2>
        <p style={{ margin: '0 0 16px', color: '#6b7280', fontSize: '14px' }}>
          {amount} XLM · Cycle #{cycleId}
        </p>

        {/* Milestone badge */}
        {milestoneLabel && (
          <div
            className="milestone-badge"
            style={{
              display: 'inline-block',
              background: '#eef2ff',
              color: '#4f46e5',
              borderRadius: '999px',
              padding: '4px 14px',
              fontSize: '13px',
              fontWeight: 600,
              marginBottom: '16px',
            }}
          >
            🏆 {milestoneLabel}
          </div>
        )}

        {/* Explorer link */}
        {txHash && (
          <p style={{ margin: '0 0 20px', fontSize: '12px' }}>
            <a
              href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#6366f1', textDecoration: 'none' }}
            >
              View on Stellar Explorer →
            </a>
          </p>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <ShareButton amount={amount} cycleId={cycleId} milestone={milestoneLabel} />
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              background: '#fff',
              color: '#374151',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseOver={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.background = '#f9fafb')
            }
            onMouseOut={(e) => ((e.currentTarget as HTMLButtonElement).style.background = '#fff')}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export default ContributionSuccessModal;
