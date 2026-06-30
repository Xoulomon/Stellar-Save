/// Webhook retry queue with exponential backoff and dead-letter queue (DLQ).
///
/// This module is intentionally environment-agnostic (no async runtime
/// dependency): callers drive the retry loop via `WebhookQueue::tick()` and
/// persist / restore the queue state themselves.  That keeps it compatible
/// with both a simple off-chain server and a future serverless function.

use std::time::{Duration, SystemTime, UNIX_EPOCH};

// ── Constants ────────────────────────────────────────────────────────────────

/// Maximum delivery attempts before a job is moved to the DLQ.
pub const MAX_ATTEMPTS: u32 = 5;

/// Base delay for the first retry (1 second).
const BASE_DELAY_SECS: u64 = 1;

/// Cap the computed delay at 5 minutes.
const MAX_DELAY_SECS: u64 = 300;

// ── Data structures ──────────────────────────────────────────────────────────

/// A single outbound webhook delivery job.
#[derive(Debug, Clone, PartialEq)]
pub struct WebhookJob {
    /// Opaque caller-assigned identifier (e.g. event ID).
    pub id: String,
    /// Target URL.
    pub url: String,
    /// Request body (JSON-serialised event payload).
    pub payload: String,
    /// Number of delivery attempts already made.
    pub attempts: u32,
    /// Unix timestamp (seconds) after which the next attempt may be made.
    pub next_attempt_at: u64,
}

impl WebhookJob {
    /// Create a new job scheduled for immediate delivery.
    pub fn new(id: impl Into<String>, url: impl Into<String>, payload: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            url: url.into(),
            payload: payload.into(),
            attempts: 0,
            next_attempt_at: now_secs(),
        }
    }

    /// Compute the delay before the *next* retry using truncated exponential backoff
    /// with jitter: `min(base * 2^attempts, cap)`.
    pub fn backoff_delay(&self) -> Duration {
        let exp = BASE_DELAY_SECS.saturating_mul(1u64 << self.attempts.min(30));
        Duration::from_secs(exp.min(MAX_DELAY_SECS))
    }

    /// Mark this attempt as failed and reschedule (or exhaust).
    pub fn record_failure(&mut self) {
        self.attempts += 1;
        self.next_attempt_at = now_secs() + self.backoff_delay().as_secs();
    }

    /// Whether the job has exhausted all retry attempts.
    pub fn is_exhausted(&self) -> bool {
        self.attempts >= MAX_ATTEMPTS
    }

    /// Whether the job is eligible to be dispatched right now.
    pub fn is_due(&self) -> bool {
        now_secs() >= self.next_attempt_at
    }
}

/// Outcome reported by the caller's delivery function.
pub enum DeliveryResult {
    Success,
    Failure,
}

/// In-memory webhook queue with a dead-letter queue.
#[derive(Debug, Default)]
pub struct WebhookQueue {
    /// Jobs awaiting delivery.
    pub pending: Vec<WebhookJob>,
    /// Jobs that exceeded `MAX_ATTEMPTS`.
    pub dead_letter: Vec<WebhookJob>,
}

impl WebhookQueue {
    pub fn new() -> Self {
        Self::default()
    }

    /// Enqueue a new webhook job.
    pub fn enqueue(&mut self, job: WebhookJob) {
        self.pending.push(job);
    }

    /// Process all jobs that are currently due.
    ///
    /// `deliver` is a synchronous function provided by the caller that
    /// attempts the actual HTTP POST and returns a `DeliveryResult`.
    pub fn tick<F>(&mut self, mut deliver: F)
    where
        F: FnMut(&WebhookJob) -> DeliveryResult,
    {
        let mut remaining = Vec::with_capacity(self.pending.len());

        for mut job in self.pending.drain(..) {
            if !job.is_due() {
                remaining.push(job);
                continue;
            }

            match deliver(&job) {
                DeliveryResult::Success => {
                    // Job delivered — drop it (don't re-queue).
                }
                DeliveryResult::Failure => {
                    job.record_failure();
                    if job.is_exhausted() {
                        self.dead_letter.push(job);
                    } else {
                        remaining.push(job);
                    }
                }
            }
        }

        self.pending = remaining;
    }

    /// Drain the DLQ, returning all dead-lettered jobs for inspection / alerting.
    pub fn drain_dlq(&mut self) -> Vec<WebhookJob> {
        std::mem::take(&mut self.dead_letter)
    }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

// ── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn successful_delivery_removes_job() {
        let mut q = WebhookQueue::new();
        q.enqueue(WebhookJob::new("1", "https://example.com/hook", r#"{"event":"test"}"#));
        q.tick(|_| DeliveryResult::Success);
        assert!(q.pending.is_empty());
        assert!(q.dead_letter.is_empty());
    }

    #[test]
    fn failed_delivery_reschedules_with_backoff() {
        let mut q = WebhookQueue::new();
        q.enqueue(WebhookJob::new("2", "https://example.com/hook", "{}"));
        q.tick(|_| DeliveryResult::Failure);
        assert_eq!(q.pending.len(), 1);
        assert_eq!(q.pending[0].attempts, 1);
        // After 1 failure the delay should be BASE_DELAY_SECS * 2^1 = 2s.
        assert_eq!(q.pending[0].backoff_delay(), Duration::from_secs(2));
    }

    #[test]
    fn exhausted_job_moves_to_dlq() {
        let mut q = WebhookQueue::new();
        let mut job = WebhookJob::new("3", "https://example.com/hook", "{}");
        // Simulate MAX_ATTEMPTS - 1 prior failures so next failure exhausts it.
        job.attempts = MAX_ATTEMPTS - 1;
        q.enqueue(job);
        q.tick(|_| DeliveryResult::Failure);
        assert!(q.pending.is_empty());
        assert_eq!(q.dead_letter.len(), 1);
    }

    #[test]
    fn backoff_capped_at_max_delay() {
        let mut job = WebhookJob::new("4", "https://example.com/hook", "{}");
        job.attempts = 30; // huge exponent
        assert_eq!(job.backoff_delay(), Duration::from_secs(MAX_DELAY_SECS));
    }

    #[test]
    fn drain_dlq_clears_dead_letter_queue() {
        let mut q = WebhookQueue::new();
        let mut job = WebhookJob::new("5", "https://example.com/hook", "{}");
        job.attempts = MAX_ATTEMPTS - 1;
        q.enqueue(job);
        q.tick(|_| DeliveryResult::Failure);
        let drained = q.drain_dlq();
        assert_eq!(drained.len(), 1);
        assert!(q.dead_letter.is_empty());
    }
}
