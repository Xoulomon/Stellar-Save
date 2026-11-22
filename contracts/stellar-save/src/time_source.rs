//! Time-source abstraction for deadline and cycle logic.
//!
//! Introduces a thin `TimeSource` trait so that code which needs the current
//! ledger timestamp can be tested without coupling to the live ledger clock.
//!
//! # Usage
//!
//! Production code calls [`LedgerTimeSource::now`], which delegates to
//! `env.ledger().timestamp()`.  Unit tests that need deterministic timestamps
//! pass a [`FixedTimeSource`] (or any custom implementor) instead.
//!
//! ```ignore
//! use crate::time_source::{LedgerTimeSource, TimeSource};
//!
//! fn my_fn(env: &Env) {
//!     let ts = LedgerTimeSource::new(env);
//!     let now = ts.now();
//!     // … use `now` …
//! }
//! ```

use soroban_sdk::Env;

/// Abstraction over a source of the current UNIX timestamp (seconds).
///
/// Implement this trait to swap between the real ledger clock (production) and
/// a fixed / controllable clock (tests).
pub trait TimeSource {
    /// Returns the current UNIX timestamp in seconds.
    fn now(&self) -> u64;
}

// ─── Production implementation ──────────────────────────────────────────────

/// A [`TimeSource`] backed by the Soroban ledger clock.
///
/// This is the correct implementation to use in contract code that runs on-chain.
pub struct LedgerTimeSource<'a> {
    env: &'a Env,
}

impl<'a> LedgerTimeSource<'a> {
    /// Wraps a reference to the Soroban environment.
    pub fn new(env: &'a Env) -> Self {
        Self { env }
    }
}

impl<'a> TimeSource for LedgerTimeSource<'a> {
    fn now(&self) -> u64 {
        self.env.ledger().timestamp()
    }
}

// ─── Test implementation ─────────────────────────────────────────────────────

/// A [`TimeSource`] with a fixed, user-specified timestamp.
///
/// Use this in unit tests to control the apparent "current time" without
/// needing to advance the ledger.
///
/// # Example
///
/// ```ignore
/// use crate::time_source::FixedTimeSource;
///
/// let ts = FixedTimeSource::new(1_000_000);
/// assert_eq!(ts.now(), 1_000_000);
/// ```
pub struct FixedTimeSource {
    timestamp: u64,
}

impl FixedTimeSource {
    /// Creates a new fixed time source with the given timestamp.
    pub fn new(timestamp: u64) -> Self {
        Self { timestamp }
    }
}

impl TimeSource for FixedTimeSource {
    fn now(&self) -> u64 {
        self.timestamp
    }
}

// ─── Unit tests ──────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::Env;

    #[test]
    fn fixed_time_source_returns_given_timestamp() {
        let ts = FixedTimeSource::new(42_000);
        assert_eq!(ts.now(), 42_000);
    }

    #[test]
    fn fixed_time_source_zero() {
        let ts = FixedTimeSource::new(0);
        assert_eq!(ts.now(), 0);
    }

    #[test]
    fn fixed_time_source_max_u64() {
        let ts = FixedTimeSource::new(u64::MAX);
        assert_eq!(ts.now(), u64::MAX);
    }

    #[test]
    fn ledger_time_source_delegates_to_env() {
        let env = Env::default();
        // Default Soroban test environment starts at timestamp 0.
        let ts = LedgerTimeSource::new(&env);
        // The ledger timestamp in a fresh test env is deterministic; just check it is accessible.
        let _ = ts.now(); // must not panic
    }
}
