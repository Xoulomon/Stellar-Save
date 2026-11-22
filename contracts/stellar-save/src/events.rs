//! # Contract Events
//!
//! Events are grouped by domain into sub-modules:
//!
//! | Module           | Covers                                           |
//! |------------------|--------------------------------------------------|
//! | [`group`]        | Group lifecycle, membership, invitations, ratings |
//! | [`contribution`] | Contributions, penalties, cycles, auto-pay       |
//! | [`payout`]       | Payout execution                                 |
//! | [`admin`]        | Contract-level pause/unpause, upgrades, disputes |
//!
//! All domain emitter functions are re-exported through [`EventEmitter`], the
//! single public surface used by the rest of the contract.
//!
//! ## Adding a new event
//! 1. Add the `#[contracttype]` struct and `emit_*` function to the appropriate
//!    domain module (or create a new one if none fits).
//! 2. Set `schema_version` to `1` on the new struct.
//! 3. Add the corresponding entry to `packages/events-schema/schema.json`.
//! 4. Run `node packages/events-schema/codegen.js` to regenerate TypeScript types.
//! 5. The drift-detection tests below will catch any mismatch automatically.
//!
//! ## Breaking-change rules
//! See `docs/adr/ADR-007-event-schema-versioning.md`.

#[path = "events/group.rs"]
pub mod group;
#[path = "events/contribution.rs"]
pub mod contribution;
#[path = "events/payout.rs"]
pub mod payout;
#[path = "events/admin.rs"]
pub mod admin;

// Re-export all event types so callers can use `events::GroupCreated`, etc.
pub use admin::{ContractPaused, ContractUnpaused, ContractUpgraded};
pub use contribution::{
    AutoContributionExecuted, AutoContributionFailed, ContributionAmountChanged,
    ContributionAmountProposed, ContributionEvent, ContributionMade, ContributionMissed,
    ContributionVerified, CycleAdvanced, CycleDeadlineExtended, FeePaid, GracePeriodContribution,
    PenaltyApplied, PenaltyRecovered, RefundIssued,
};
pub use group::{
    GroupArchived, GroupCloned, GroupCompleted, GroupCreated, GroupDissolved, GroupMetadataUpdated,
    GroupPaused, GroupRated, GroupStatusChanged, GroupUnpaused, GroupsMerged, InvitationRevoked,
    MemberInvited, MemberJoined, MemberLeft, MemberReferred, MemberRemoved, MilestoneReached,
    RewardClaimed,
};
pub use payout::PayoutExecuted;

/// Unified event-emitter facade.
///
/// Every caller in the contract (and tests) should go through this type so the
/// public API stays stable even when domain modules are reorganised internally.
pub struct EventEmitter;

impl EventEmitter {
    // ── Group domain ─────────────────────────────────────────────────────────

    pub fn emit_group_created(
        env: &soroban_sdk::Env,
        group_id: u64,
        creator: soroban_sdk::Address,
        contribution_amount: i128,
        cycle_duration: u64,
        max_members: u32,
        created_at: u64,
    ) {
        group::emit_group_created(env, group_id, creator, contribution_amount, cycle_duration, max_members, created_at);
    }

    pub fn emit_member_joined(
        env: &soroban_sdk::Env,
        group_id: u64,
        member: soroban_sdk::Address,
        member_count: u32,
        joined_at: u64,
    ) {
        group::emit_member_joined(env, group_id, member, member_count, joined_at);
    }

    pub fn emit_member_left(
        env: &soroban_sdk::Env,
        group_id: u64,
        member: soroban_sdk::Address,
        member_count: u32,
        left_at: u64,
    ) {
        group::emit_member_left(env, group_id, member, member_count, left_at);
    }

    pub fn emit_member_removed(
        env: &soroban_sdk::Env,
        group_id: u64,
        member: soroban_sdk::Address,
        removed_by: soroban_sdk::Address,
        member_count: u32,
        removed_at: u64,
    ) {
        group::emit_member_removed(env, group_id, member, removed_by, member_count, removed_at);
    }

    pub fn emit_group_completed(
        env: &soroban_sdk::Env,
        group_id: u64,
        creator: soroban_sdk::Address,
        total_cycles: u32,
        total_distributed: i128,
        completed_at: u64,
    ) {
        group::emit_group_completed(env, group_id, creator, total_cycles, total_distributed, completed_at);
    }

    pub fn emit_group_status_changed(
        env: &soroban_sdk::Env,
        group_id: u64,
        old_status: u32,
        new_status: u32,
        changed_by: soroban_sdk::Address,
        changed_at: u64,
    ) {
        group::emit_group_status_changed(env, group_id, old_status, new_status, changed_by, changed_at);
    }

    pub fn emit_group_metadata_updated(
        env: &soroban_sdk::Env,
        group_id: u64,
        updated_by: soroban_sdk::Address,
        name: soroban_sdk::String,
        description: soroban_sdk::String,
        image_url: soroban_sdk::String,
        updated_at: u64,
    ) {
        group::emit_group_metadata_updated(env, group_id, updated_by, name, description, image_url, updated_at);
    }

    pub fn emit_group_paused(
        env: &soroban_sdk::Env,
        group_id: u64,
        paused_by: soroban_sdk::Address,
        paused_at: u64,
    ) {
        group::emit_group_paused(env, group_id, paused_by, paused_at);
    }

    pub fn emit_group_unpaused(
        env: &soroban_sdk::Env,
        group_id: u64,
        unpaused_by: soroban_sdk::Address,
        unpaused_at: u64,
    ) {
        group::emit_group_unpaused(env, group_id, unpaused_by, unpaused_at);
    }

    pub fn emit_group_dissolved(
        env: &soroban_sdk::Env,
        group_id: u64,
        dissolved_at: u64,
        total_refunded: i128,
    ) {
        group::emit_group_dissolved(env, group_id, dissolved_at, total_refunded);
    }

    pub fn emit_group_cloned(
        env: &soroban_sdk::Env,
        original_group_id: u64,
        new_group_id: u64,
        creator: soroban_sdk::Address,
        cloned_at: u64,
    ) {
        group::emit_group_cloned(env, original_group_id, new_group_id, creator, cloned_at);
    }

    pub fn emit_groups_merged(
        env: &soroban_sdk::Env,
        merged_group_id: u64,
        source_group_id_1: u64,
        source_group_id_2: u64,
        member_count: u32,
        combined_balance: i128,
        merged_at: u64,
    ) {
        group::emit_groups_merged(env, merged_group_id, source_group_id_1, source_group_id_2, member_count, combined_balance, merged_at);
    }

    pub fn emit_member_invited(
        env: &soroban_sdk::Env,
        group_id: u64,
        invited: soroban_sdk::Address,
        invited_by: soroban_sdk::Address,
        invited_at: u64,
    ) {
        group::emit_member_invited(env, group_id, invited, invited_by, invited_at);
    }

    pub fn emit_invitation_revoked(
        env: &soroban_sdk::Env,
        group_id: u64,
        revoked: soroban_sdk::Address,
        revoked_by: soroban_sdk::Address,
        revoked_at: u64,
    ) {
        group::emit_invitation_revoked(env, group_id, revoked, revoked_by, revoked_at);
    }

    pub fn emit_group_archived(
        env: &soroban_sdk::Env,
        group_id: u64,
        archived_by: soroban_sdk::Address,
        archived_at: u64,
    ) {
        group::emit_group_archived(env, group_id, archived_by, archived_at);
    }

    pub fn emit_group_rated(
        env: &soroban_sdk::Env,
        group_id: u64,
        member: soroban_sdk::Address,
        stars: u32,
        comment: soroban_sdk::String,
        rated_at: u64,
    ) {
        group::emit_group_rated(env, group_id, member, stars, comment, rated_at);
    }

    pub fn emit_milestone_reached(
        env: &soroban_sdk::Env,
        group_id: u64,
        member: soroban_sdk::Address,
        threshold: u32,
        reached_at_cycle: u32,
    ) {
        group::emit_milestone_reached(env, group_id, member, threshold, reached_at_cycle);
    }

    pub fn emit_member_referred(
        env: &soroban_sdk::Env,
        group_id: u64,
        invitee: soroban_sdk::Address,
        referrer: soroban_sdk::Address,
        referred_at: u64,
    ) {
        group::emit_member_referred(env, group_id, invitee, referrer, referred_at);
    }

    pub fn emit_reward_claimed(
        env: &soroban_sdk::Env,
        group_id: u64,
        member: soroban_sdk::Address,
        amount: i128,
        claimed_at: u64,
    ) {
        group::emit_reward_claimed(env, group_id, member, amount, claimed_at);
    }

    // ── Contribution domain ───────────────────────────────────────────────────

    pub fn emit_contribution_made(
        env: &soroban_sdk::Env,
        group_id: u64,
        contributor: soroban_sdk::Address,
        amount: i128,
        cycle: u32,
        cycle_total: i128,
        contributed_at: u64,
    ) {
        contribution::emit_contribution_made(env, group_id, contributor, amount, cycle, cycle_total, contributed_at);
    }

    pub fn emit_contribution_missed(
        env: &soroban_sdk::Env,
        group_id: u64,
        member: soroban_sdk::Address,
        cycle: u32,
        penalty_applied: i128,
        missed_at: u64,
    ) {
        contribution::emit_contribution_missed(env, group_id, member, cycle, penalty_applied, missed_at);
    }

    pub fn emit_grace_period_contribution(
        env: &soroban_sdk::Env,
        group_id: u64,
        contributor: soroban_sdk::Address,
        amount: i128,
        cycle: u32,
        seconds_late: u64,
        contributed_at: u64,
    ) {
        contribution::emit_grace_period_contribution(env, group_id, contributor, amount, cycle, seconds_late, contributed_at);
    }

    pub fn emit_contribution_verified(
        env: &soroban_sdk::Env,
        group_id: u64,
        contributor: soroban_sdk::Address,
        cycle: u32,
        verified_at: u64,
    ) {
        contribution::emit_contribution_verified(env, group_id, contributor, cycle, verified_at);
    }

    pub fn emit_contribution_amount_proposed(
        env: &soroban_sdk::Env,
        group_id: u64,
        proposed_by: soroban_sdk::Address,
        old_amount: i128,
        new_amount: i128,
        proposed_at: u64,
    ) {
        contribution::emit_contribution_amount_proposed(env, group_id, proposed_by, old_amount, new_amount, proposed_at);
    }

    pub fn emit_contribution_amount_changed(
        env: &soroban_sdk::Env,
        group_id: u64,
        old_amount: i128,
        new_amount: i128,
        effective_cycle: u32,
        changed_at: u64,
    ) {
        contribution::emit_contribution_amount_changed(env, group_id, old_amount, new_amount, effective_cycle, changed_at);
    }

    pub fn emit_auto_contribution_executed(
        env: &soroban_sdk::Env,
        group_id: u64,
        member: soroban_sdk::Address,
        amount: i128,
        cycle: u32,
        executed_at: u64,
    ) {
        contribution::emit_auto_contribution_executed(env, group_id, member, amount, cycle, executed_at);
    }

    pub fn emit_auto_contribution_failed(
        env: &soroban_sdk::Env,
        group_id: u64,
        member: soroban_sdk::Address,
        cycle: u32,
        failed_at: u64,
    ) {
        contribution::emit_auto_contribution_failed(env, group_id, member, cycle, failed_at);
    }

    pub fn emit_fee_paid(
        env: &soroban_sdk::Env,
        creator: soroban_sdk::Address,
        treasury: soroban_sdk::Address,
        amount: i128,
        paid_at: u64,
    ) {
        contribution::emit_fee_paid(env, creator, treasury, amount, paid_at);
    }

    pub fn emit_penalty_applied(
        env: &soroban_sdk::Env,
        group_id: u64,
        member: soroban_sdk::Address,
        amount: i128,
        cycle_id: u32,
    ) {
        contribution::emit_penalty_applied(env, group_id, member, amount, cycle_id);
    }

    pub fn emit_penalty_recovered(
        env: &soroban_sdk::Env,
        group_id: u64,
        member: soroban_sdk::Address,
        cycle_id: u32,
    ) {
        contribution::emit_penalty_recovered(env, group_id, member, cycle_id);
    }

    pub fn emit_refund_issued(
        env: &soroban_sdk::Env,
        group_id: u64,
        member: soroban_sdk::Address,
        amount: i128,
        cycle: u32,
        refunded_at: u64,
    ) {
        contribution::emit_refund_issued(env, group_id, member, amount, cycle, refunded_at);
    }

    pub fn emit_cycle_advanced(
        env: &soroban_sdk::Env,
        group_id: u64,
        old_cycle: u32,
        new_cycle: u32,
        payout_executed: bool,
        defaulted: bool,
        advanced_at: u64,
    ) {
        contribution::emit_cycle_advanced(env, group_id, old_cycle, new_cycle, payout_executed, defaulted, advanced_at);
    }

    pub fn emit_cycle_deadline_extended(
        env: &soroban_sdk::Env,
        group_id: u64,
        cycle: u32,
        extension_seconds: u64,
        new_deadline: u64,
        extended_by: soroban_sdk::Address,
        extended_at: u64,
    ) {
        contribution::emit_cycle_deadline_extended(env, group_id, cycle, extension_seconds, new_deadline, extended_by, extended_at);
    }

    pub fn emit_contribution_due(
        env: &soroban_sdk::Env,
        group_id: u64,
        member: soroban_sdk::Address,
        cycle: u32,
        deadline: u64,
        emitted_at: u64,
    ) {
        contribution::emit_contribution_due(env, group_id, member, cycle, deadline, emitted_at);
    }

    // ── Payout domain ────────────────────────────────────────────────────────

    pub fn emit_payout_executed(
        env: &soroban_sdk::Env,
        group_id: u64,
        recipient: soroban_sdk::Address,
        amount: i128,
        cycle: u32,
        executed_at: u64,
    ) {
        payout::emit_payout_executed(env, group_id, recipient, amount, cycle, executed_at);
    }

    // ── Admin domain ─────────────────────────────────────────────────────────

    pub fn emit_contract_paused(env: &soroban_sdk::Env, admin: soroban_sdk::Address, timestamp: u64) {
        admin::emit_contract_paused(env, admin, timestamp);
    }

    pub fn emit_contract_unpaused(env: &soroban_sdk::Env, admin: soroban_sdk::Address, timestamp: u64) {
        admin::emit_contract_unpaused(env, admin, timestamp);
    }

    pub fn emit_contract_upgraded(
        env: &soroban_sdk::Env,
        upgraded_by: soroban_sdk::Address,
        old_version: u32,
        new_version: u32,
        upgraded_at: u64,
    ) {
        admin::emit_contract_upgraded(env, upgraded_by, old_version, new_version, upgraded_at);
    }

    pub fn emit_dispute_raised(
        env: &soroban_sdk::Env,
        group_id: u64,
        raised_by: soroban_sdk::Address,
        reason: soroban_sdk::String,
        vote_count: u32,
        threshold: u32,
        auto_paused: bool,
        raised_at: u64,
    ) {
        admin::emit_dispute_raised(env, group_id, raised_by, reason, vote_count, threshold, auto_paused, raised_at);
    }

    pub fn emit_dispute_resolved(
        env: &soroban_sdk::Env,
        group_id: u64,
        resolved_by: soroban_sdk::Address,
        resolution: soroban_sdk::String,
        resolved_at: u64,
    ) {
        admin::emit_dispute_resolved(env, group_id, resolved_by, resolution, resolved_at);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Drift-detection tests
// ─────────────────────────────────────────────────────────────────────────────
//
// These tests embed schema.json and all domain source files at compile time and
// compare them in both directions, so:
//   • adding an emitter without a schema entry fails `cargo test`, and
//   • adding a schema entry without an emitter fails `cargo test`.
//
// The schema.json ↔ generated/events.ts half is covered by
// `.github/workflows/event-schema-drift.yml`.
//
// HOW TO ADD AN EVENT:
// 1. Add the emit_* free function + struct to the appropriate domain module.
// 2. Add a delegation method to EventEmitter in this file.
// 3. Add the event entry to packages/events-schema/schema.json.
// 4. Run `node packages/events-schema/codegen.js` to regenerate TypeScript types.

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Address, Env};

    // ── Schema version constants ──────────────────────────────────────────────

    #[test]
    fn test_group_schema_version_is_one() {
        assert_eq!(group::GROUP_SCHEMA_VERSION, 1);
    }

    #[test]
    fn test_contribution_schema_version_is_one() {
        assert_eq!(contribution::CONTRIBUTION_SCHEMA_VERSION, 1);
    }

    #[test]
    fn test_payout_schema_version_is_one() {
        assert_eq!(payout::PAYOUT_SCHEMA_VERSION, 1);
    }

    #[test]
    fn test_admin_schema_version_is_one() {
        assert_eq!(admin::ADMIN_SCHEMA_VERSION, 1);
    }

    // ── schema_version present in every struct ────────────────────────────────

    #[test]
    fn test_group_created_has_schema_version() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let ev = GroupCreated {
            schema_version: group::GROUP_SCHEMA_VERSION,
            group_id: 1,
            creator,
            contribution_amount: 1_000,
            cycle_duration: 604800,
            max_members: 5,
            created_at: 0,
        };
        assert_eq!(ev.schema_version, 1);
    }

    #[test]
    fn test_contribution_made_has_schema_version() {
        let env = Env::default();
        let contributor = Address::generate(&env);
        let ev = ContributionMade {
            schema_version: contribution::CONTRIBUTION_SCHEMA_VERSION,
            group_id: 1,
            contributor,
            amount: 1_000,
            cycle: 1,
            cycle_total: 5_000,
            contributed_at: 0,
        };
        assert_eq!(ev.schema_version, 1);
    }

    #[test]
    fn test_payout_executed_has_schema_version() {
        let env = Env::default();
        let recipient = Address::generate(&env);
        let ev = PayoutExecuted {
            schema_version: payout::PAYOUT_SCHEMA_VERSION,
            group_id: 1,
            recipient,
            amount: 5_000,
            cycle: 1,
            executed_at: 0,
        };
        assert_eq!(ev.schema_version, 1);
    }

    #[test]
    fn test_contract_paused_has_schema_version() {
        let env = Env::default();
        let admin_addr = Address::generate(&env);
        let ev = ContractPaused {
            schema_version: admin::ADMIN_SCHEMA_VERSION,
            admin: admin_addr,
            timestamp: 0,
        };
        assert_eq!(ev.schema_version, 1);
    }

    // ── Drift detection: domain source files ↔ schema.json ───────────────────

    const SCHEMA_JSON: &str = include_str!("../../../packages/events-schema/schema.json");
    const GROUP_RS: &str    = include_str!("events/group.rs");
    const CONTRIB_RS: &str  = include_str!("events/contribution.rs");
    const PAYOUT_RS: &str   = include_str!("events/payout.rs");
    const ADMIN_RS: &str    = include_str!("events/admin.rs");

    fn all_domain_sources() -> [&'static str; 4] {
        [GROUP_RS, CONTRIB_RS, PAYOUT_RS, ADMIN_RS]
    }

    fn for_each_schema_topic(mut f: impl FnMut(&str)) {
        let needle = "\"topic\": \"";
        let mut rest = SCHEMA_JSON;
        while let Some(i) = rest.find(needle) {
            rest = &rest[i + needle.len()..];
            let end = rest.find('"').unwrap();
            f(&rest[..end]);
        }
    }

    fn for_each_emitted_topic(mut f: impl FnMut(&str)) {
        for src in all_domain_sources() {
            let mut rest = src;
            while let Some(i) = rest.find("publish(") {
                rest = rest[i + "publish(".len()..].trim_start();
                if let Some(tail) = rest.strip_prefix("(\"") {
                    let end = tail.find('"').unwrap();
                    f(&tail[..end]);
                }
            }
        }
    }

    fn schema_has_topic(topic: &str) -> bool {
        let mut found = false;
        for_each_schema_topic(|t| found |= t == topic);
        found
    }

    fn emitter_has_topic(topic: &str) -> bool {
        let mut found = false;
        for_each_emitted_topic(|t| found |= t == topic);
        found
    }

    #[test]
    fn test_every_emitted_topic_is_in_schema() {
        let mut count = 0;
        for_each_emitted_topic(|t| {
            count += 1;
            assert!(
                schema_has_topic(t),
                "topic '{}' is emitted by a domain module but missing from schema.json",
                t
            );
        });
        assert!(count > 0, "drift check found no emitted topics");
    }

    #[test]
    fn test_every_schema_topic_is_emitted() {
        let mut count = 0;
        for_each_schema_topic(|t| {
            count += 1;
            assert!(
                emitter_has_topic(t),
                "topic '{}' is in schema.json but has no emitter in any domain module",
                t
            );
        });
        assert!(count > 0, "drift check found no schema topics");
    }

    #[test]
    fn test_schema_topics_are_unique() {
        for_each_schema_topic(|t| {
            let mut n = 0;
            for_each_schema_topic(|u| n += (u == t) as u32);
            assert_eq!(n, 1, "duplicate topic '{}' in schema.json", t);
        });
    }

    // ── schema_version field present in every schema entry ────────────────────
    //
    // Ensures that every event definition in schema.json declares a
    // schema_version field, preventing silent regressions when new events are
    // added without following the versioning guide.

    #[test]
    fn test_every_schema_entry_has_schema_version_field() {
        let needle = "\"fields\": {";
        let mut rest = SCHEMA_JSON;
        let mut count = 0;

        while let Some(i) = rest.find(needle) {
            rest = &rest[i + needle.len()..];
            let block_end = rest.find('}').unwrap_or(rest.len());
            let fields_block = &rest[..block_end];

            assert!(
                fields_block.contains("\"schema_version\""),
                "A schema entry is missing the 'schema_version' field. Fields block: ...{}...",
                &fields_block[..fields_block.len().min(120)]
            );
            count += 1;
        }
        assert!(count > 0, "schema_version field check found no 'fields' blocks in schema.json");
    }

    // ── Emitter smoke tests ───────────────────────────────────────────────────

    #[test]
    fn test_event_emitter_group_created() {
        let env = Env::default();
        let creator = Address::generate(&env);
        EventEmitter::emit_group_created(&env, 1, creator, 10_000_000, 604800, 5, 1234567890);
    }

    #[test]
    fn test_event_emitter_member_joined() {
        let env = Env::default();
        let member = Address::generate(&env);
        EventEmitter::emit_member_joined(&env, 1, member, 3, 1234567890);
    }

    #[test]
    fn test_event_emitter_member_left() {
        let env = Env::default();
        let member = Address::generate(&env);
        EventEmitter::emit_member_left(&env, 1, member, 2, 1234567890);
    }

    #[test]
    fn test_event_emitter_contribution_made() {
        let env = Env::default();
        let contributor = Address::generate(&env);
        EventEmitter::emit_contribution_made(&env, 1, contributor, 10_000_000, 1, 50_000_000, 1234567890);
    }

    #[test]
    fn test_event_emitter_payout_executed() {
        let env = Env::default();
        let recipient = Address::generate(&env);
        EventEmitter::emit_payout_executed(&env, 1, recipient, 50_000_000, 1, 1234567890);
    }

    #[test]
    fn test_event_emitter_group_completed() {
        let env = Env::default();
        let creator = Address::generate(&env);
        EventEmitter::emit_group_completed(&env, 1, creator, 5, 250_000_000, 1234567890);
    }

    #[test]
    fn test_event_emitter_group_status_changed() {
        let env = Env::default();
        let admin = Address::generate(&env);
        EventEmitter::emit_group_status_changed(&env, 1, 0, 1, admin, 1234567890);
    }

    #[test]
    fn test_event_emitter_contract_paused() {
        let env = Env::default();
        let admin = Address::generate(&env);
        EventEmitter::emit_contract_paused(&env, admin, 1234567890);
    }

    #[test]
    fn test_event_emitter_contract_unpaused() {
        let env = Env::default();
        let admin = Address::generate(&env);
        EventEmitter::emit_contract_unpaused(&env, admin, 1234567890);
    }

    #[test]
    fn test_event_emitter_cycle_advanced() {
        let env = Env::default();
        EventEmitter::emit_cycle_advanced(&env, 1, 0, 1, true, false, 1234567890);
    }

    #[test]
    fn test_event_emitter_group_paused() {
        let env = Env::default();
        let creator = Address::generate(&env);
        EventEmitter::emit_group_paused(&env, 1, creator, 1234567890);
    }

    #[test]
    fn test_event_emitter_group_unpaused() {
        let env = Env::default();
        let creator = Address::generate(&env);
        EventEmitter::emit_group_unpaused(&env, 1, creator, 1234567890);
    }

    #[test]
    fn test_event_emitter_contract_upgraded() {
        let env = Env::default();
        let admin = Address::generate(&env);
        EventEmitter::emit_contract_upgraded(&env, admin, 1, 2, 1234567890);
    }

    #[test]
    fn test_emit_contribution_missed() {
        let env = Env::default();
        let member = Address::generate(&env);
        EventEmitter::emit_contribution_missed(&env, 1, member, 2, 500_000, 1234567890);
    }

    #[test]
    fn test_emit_group_dissolved() {
        let env = Env::default();
        EventEmitter::emit_group_dissolved(&env, 1, 1234567890, 50_000_000);
    }

    #[test]
    fn test_emit_group_cloned() {
        let env = Env::default();
        let creator = Address::generate(&env);
        EventEmitter::emit_group_cloned(&env, 1, 2, creator, 1234567890);
    }

    #[test]
    fn test_emit_cycle_deadline_extended() {
        let env = Env::default();
        let caller = Address::generate(&env);
        EventEmitter::emit_cycle_deadline_extended(&env, 1, 3, 86_400, 9999999, caller, 1234567890);
    }
}
