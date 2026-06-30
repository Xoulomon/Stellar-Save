-- Migration: 001_create_events_table.sql
-- Creates the events table for off-chain indexing of Soroban contract events.
-- This table powers the analytics dashboard and leaderboard queries.

CREATE TABLE IF NOT EXISTS events (
    id               BIGSERIAL PRIMARY KEY,
    group_id         BIGINT        NOT NULL,
    member_address   VARCHAR(56)   NOT NULL,  -- Stellar address (G... format, max 56 chars)
    event_type       VARCHAR(64)   NOT NULL,  -- e.g. 'ContributionMade', 'PayoutExecuted'
    amount           NUMERIC(20,7),           -- XLM amount in stroops / 10^7
    cycle            INTEGER,
    ledger_sequence  BIGINT        NOT NULL,
    transaction_hash VARCHAR(64)   NOT NULL,
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    raw_payload      JSONB                    -- full event payload for flexibility
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

-- Index 1: Cycle analytics queries
-- Supports dashboard queries that filter by group, event type, and time range.
-- e.g. "show all ContributionMade events for group 42 in the last 30 days"
CREATE INDEX IF NOT EXISTS idx_events_cycle_analytics
    ON events (group_id, event_type, created_at DESC);

-- Index 2: Member history queries
-- Supports per-member history lookups filtered by event type.
-- e.g. "show all PayoutExecuted events for member G...XYZ"
CREATE INDEX IF NOT EXISTS idx_events_member_history
    ON events (member_address, event_type);

-- ─── Comments ─────────────────────────────────────────────────────────────────

COMMENT ON TABLE  events                          IS 'Off-chain index of Soroban contract events for analytics.';
COMMENT ON INDEX  idx_events_cycle_analytics      IS 'Speeds up cycle analytics dashboard queries (group_id, event_type, created_at).';
COMMENT ON INDEX  idx_events_member_history       IS 'Speeds up member history queries (member_address, event_type).';
