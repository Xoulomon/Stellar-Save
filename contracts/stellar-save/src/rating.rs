//! # Group Rating System
//!
//! Allows members to rate their group experience (1–5 stars) after the group
//! reaches a terminal state (Completed or Cancelled).
//!
//! ## Storage layout
//! - `GroupKey::Rating(group_id, member)` → `RatingEntry`  (per-member rating)
//! - `GroupKey::RatingAggregate(group_id)` → `RatingAggregate` (running totals)

use soroban_sdk::{contracttype, Address, Env, String};

use crate::{
    error::StellarSaveError,
    events::EventEmitter,
    group::{Group, GroupStatus},
    storage::StorageKeyBuilder,
};

/// A single rating submitted by one member.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RatingEntry {
    /// The member who submitted this rating.
    pub member: Address,
    /// Star rating 1–5.
    pub stars: u32,
    /// Optional comment (max 280 chars). Empty string means no comment.
    pub comment: String,
    /// Ledger timestamp when the rating was submitted.
    pub rated_at: u64,
}

/// Running aggregate stored per group — updated on every new rating.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RatingAggregate {
    /// Sum of all star ratings submitted so far.
    pub total_stars: u64,
    /// Number of ratings submitted.
    pub rating_count: u32,
}

impl RatingAggregate {
    /// Average rating scaled by 100 (e.g. 450 = 4.50 stars).
    /// Returns 0 when no ratings exist.
    pub fn average_scaled(&self) -> u32 {
        if self.rating_count == 0 {
            return 0;
        }
        ((self.total_stars * 100) / self.rating_count as u64) as u32
    }
}

/// Full rating summary returned by `get_group_rating`.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GroupRating {
    pub group_id: u64,
    /// Number of ratings submitted.
    pub rating_count: u32,
    /// Average stars × 100 (e.g. 450 = 4.50 stars).
    pub average_scaled: u32,
    /// Raw sum of all stars.
    pub total_stars: u64,
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/// Submits a rating for a completed/cancelled group.
///
/// # Rules
/// - Group must be in a terminal state (Completed or Cancelled).
/// - Caller must be a member of the group.
/// - Each member may only rate once.
/// - `stars` must be 1–5.
/// - `comment` must be ≤ 280 characters.
pub fn rate_group(
    env: &Env,
    caller: Address,
    group_id: u64,
    stars: u32,
    comment: String,
) -> Result<(), StellarSaveError> {
    caller.require_auth();

    // 1. Load group
    let group_key = StorageKeyBuilder::group_data(group_id);
    let group = env
        .storage()
        .persistent()
        .get::<_, Group>(&group_key)
        .ok_or(StellarSaveError::GroupNotFound)?;

    // 2. Group must be terminal
    if !group.status.is_terminal() {
        return Err(StellarSaveError::InvalidState);
    }

    // 3. Caller must be a member
    let profile_key = StorageKeyBuilder::member_profile(group_id, caller.clone());
    if !env.storage().persistent().has(&profile_key) {
        return Err(StellarSaveError::NotMember);
    }

    // 4. Validate stars range
    if stars < 1 || stars > 5 {
        return Err(StellarSaveError::InvalidAmount);
    }

    // 5. Validate comment length
    if comment.len() > 280 {
        return Err(StellarSaveError::InvalidMetadata);
    }

    // 6. Prevent duplicate ratings
    let rating_key = StorageKeyBuilder::group_rating(group_id, caller.clone());
    if env.storage().persistent().has(&rating_key) {
        return Err(StellarSaveError::AlreadyContributed); // reuse "already done" semantic
    }

    // 7. Store the individual rating
    let timestamp = env.ledger().timestamp();
    let entry = RatingEntry {
        member: caller.clone(),
        stars,
        comment: comment.clone(),
        rated_at: timestamp,
    };
    env.storage().persistent().set(&rating_key, &entry);

    // 8. Update aggregate
    let agg_key = StorageKeyBuilder::group_rating_aggregate(group_id);
    let mut agg: RatingAggregate = env
        .storage()
        .persistent()
        .get(&agg_key)
        .unwrap_or(RatingAggregate {
            total_stars: 0,
            rating_count: 0,
        });

    agg.total_stars = agg
        .total_stars
        .checked_add(stars as u64)
        .ok_or(StellarSaveError::Overflow)?;
    agg.rating_count = agg
        .rating_count
        .checked_add(1)
        .ok_or(StellarSaveError::Overflow)?;

    env.storage().persistent().set(&agg_key, &agg);

    // 9. Emit event
    EventEmitter::emit_group_rated(env, group_id, caller, stars, comment, timestamp);

    Ok(())
}

/// Returns the rating summary for a group.
pub fn get_group_rating(env: &Env, group_id: u64) -> Result<GroupRating, StellarSaveError> {
    // Verify group exists
    let group_key = StorageKeyBuilder::group_data(group_id);
    if !env.storage().persistent().has(&group_key) {
        return Err(StellarSaveError::GroupNotFound);
    }

    let agg_key = StorageKeyBuilder::group_rating_aggregate(group_id);
    let agg: RatingAggregate = env
        .storage()
        .persistent()
        .get(&agg_key)
        .unwrap_or(RatingAggregate {
            total_stars: 0,
            rating_count: 0,
        });

    Ok(GroupRating {
        group_id,
        rating_count: agg.rating_count,
        average_scaled: agg.average_scaled(),
        total_stars: agg.total_stars,
    })
}

/// Returns the individual rating submitted by a specific member, if any.
pub fn get_member_rating(
    env: &Env,
    group_id: u64,
    member: Address,
) -> Result<Option<RatingEntry>, StellarSaveError> {
    // Verify group exists
    let group_key = StorageKeyBuilder::group_data(group_id);
    if !env.storage().persistent().has(&group_key) {
        return Err(StellarSaveError::GroupNotFound);
    }

    let rating_key = StorageKeyBuilder::group_rating(group_id, member);
    Ok(env.storage().persistent().get(&rating_key))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{group::Group, storage::StorageKeyBuilder, MemberProfile};
    use soroban_sdk::{testutils::Address as _, Address, Env, String};

    /// Store a minimal completed group + member profile.
    fn setup(env: &Env, group_id: u64, member: &Address) {
        let creator = Address::generate(env);
        let mut g = Group::new(group_id, creator.clone(), 100, 604800, 5, 2, 1000, 0);
        g.status = GroupStatus::Completed;
        g.member_count = 1;

        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &g);

        // Store a member profile so membership check passes
        let profile = MemberProfile {
            address: member.clone(),
            group_id,
            payout_position: 0,
            joined_at: 1000,
            auto_contribute_enabled: false,
        };
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::member_profile(group_id, member.clone()), &profile);
    }

    fn str(env: &Env, s: &str) -> String {
        String::from_str(env, s)
    }

    // ------------------------------------------------------------------
    // Happy path
    // ------------------------------------------------------------------

    #[test]
    fn test_rate_group_success() {
        let env = Env::default();
        env.mock_all_auths();
        let member = Address::generate(&env);
        setup(&env, 1, &member);

        let result = rate_group(&env, member.clone(), 1, 5, str(&env, "Great group!"));
        assert!(result.is_ok());

        let rating = get_group_rating(&env, 1).unwrap();
        assert_eq!(rating.rating_count, 1);
        assert_eq!(rating.total_stars, 5);
        assert_eq!(rating.average_scaled, 500); // 5.00 stars
    }

    #[test]
    fn test_multiple_ratings_aggregate() {
        let env = Env::default();
        env.mock_all_auths();

        let m1 = Address::generate(&env);
        let m2 = Address::generate(&env);
        let m3 = Address::generate(&env);

        setup(&env, 1, &m1);
        // Add m2 and m3 as members too
        for m in [&m2, &m3] {
            let profile = MemberProfile {
                address: m.clone(),
                group_id: 1,
                payout_position: 0,
                joined_at: 1000,
                auto_contribute_enabled: false,
            };
            env.storage()
                .persistent()
                .set(&StorageKeyBuilder::member_profile(1, m.clone()), &profile);
        }

        rate_group(&env, m1.clone(), 1, 4, str(&env, "Good")).unwrap();
        rate_group(&env, m2.clone(), 1, 5, str(&env, "Excellent")).unwrap();
        rate_group(&env, m3.clone(), 1, 3, str(&env, "Okay")).unwrap();

        let rating = get_group_rating(&env, 1).unwrap();
        assert_eq!(rating.rating_count, 3);
        assert_eq!(rating.total_stars, 12);
        assert_eq!(rating.average_scaled, 400); // 4.00 stars
    }

    #[test]
    fn test_get_member_rating() {
        let env = Env::default();
        env.mock_all_auths();
        let member = Address::generate(&env);
        setup(&env, 1, &member);

        rate_group(&env, member.clone(), 1, 4, str(&env, "Nice")).unwrap();

        let entry = get_member_rating(&env, 1, member.clone()).unwrap().unwrap();
        assert_eq!(entry.stars, 4);
    }

    #[test]
    fn test_no_rating_returns_none() {
        let env = Env::default();
        env.mock_all_auths();
        let member = Address::generate(&env);
        setup(&env, 1, &member);

        let entry = get_member_rating(&env, 1, member).unwrap();
        assert!(entry.is_none());
    }

    // ------------------------------------------------------------------
    // Validation errors
    // ------------------------------------------------------------------

    #[test]
    fn test_rate_non_terminal_group_fails() {
        let env = Env::default();
        env.mock_all_auths();
        let member = Address::generate(&env);

        // Active group (not terminal)
        let creator = Address::generate(&env);
        let g = Group::new(1, creator, 100, 604800, 5, 2, 1000, 0);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(1), &g);
        let profile = MemberProfile {
            address: member.clone(),
            group_id: 1,
            payout_position: 0,
            joined_at: 1000,
            auto_contribute_enabled: false,
        };
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::member_profile(1, member.clone()), &profile);

        let result = rate_group(&env, member, 1, 5, str(&env, ""));
        assert_eq!(result, Err(StellarSaveError::InvalidState));
    }

    #[test]
    fn test_rate_non_member_fails() {
        let env = Env::default();
        env.mock_all_auths();
        let member = Address::generate(&env);
        let outsider = Address::generate(&env);
        setup(&env, 1, &member);

        let result = rate_group(&env, outsider, 1, 5, str(&env, ""));
        assert_eq!(result, Err(StellarSaveError::NotMember));
    }

    #[test]
    fn test_invalid_stars_zero_fails() {
        let env = Env::default();
        env.mock_all_auths();
        let member = Address::generate(&env);
        setup(&env, 1, &member);

        let result = rate_group(&env, member, 1, 0, str(&env, ""));
        assert_eq!(result, Err(StellarSaveError::InvalidAmount));
    }

    #[test]
    fn test_invalid_stars_six_fails() {
        let env = Env::default();
        env.mock_all_auths();
        let member = Address::generate(&env);
        setup(&env, 1, &member);

        let result = rate_group(&env, member, 1, 6, str(&env, ""));
        assert_eq!(result, Err(StellarSaveError::InvalidAmount));
    }

    #[test]
    fn test_duplicate_rating_fails() {
        let env = Env::default();
        env.mock_all_auths();
        let member = Address::generate(&env);
        setup(&env, 1, &member);

        rate_group(&env, member.clone(), 1, 5, str(&env, "First")).unwrap();
        let result = rate_group(&env, member, 1, 3, str(&env, "Second"));
        assert_eq!(result, Err(StellarSaveError::AlreadyContributed));
    }

    #[test]
    fn test_comment_too_long_fails() {
        let env = Env::default();
        env.mock_all_auths();
        let member = Address::generate(&env);
        setup(&env, 1, &member);

        // 281 character comment
        let long = str(&env, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
        let result = rate_group(&env, member, 1, 4, long);
        assert_eq!(result, Err(StellarSaveError::InvalidMetadata));
    }

    #[test]
    fn test_group_not_found_fails() {
        let env = Env::default();
        env.mock_all_auths();
        let member = Address::generate(&env);

        let result = rate_group(&env, member, 99, 5, str(&env, ""));
        assert_eq!(result, Err(StellarSaveError::GroupNotFound));
    }

    // ------------------------------------------------------------------
    // Average calculation
    // ------------------------------------------------------------------

    #[test]
    fn test_average_scaled_no_ratings() {
        let agg = RatingAggregate { total_stars: 0, rating_count: 0 };
        assert_eq!(agg.average_scaled(), 0);
    }

    #[test]
    fn test_average_scaled_single() {
        let agg = RatingAggregate { total_stars: 3, rating_count: 1 };
        assert_eq!(agg.average_scaled(), 300);
    }

    #[test]
    fn test_average_scaled_mixed() {
        // (1+2+3+4+5) / 5 = 3.00
        let agg = RatingAggregate { total_stars: 15, rating_count: 5 };
        assert_eq!(agg.average_scaled(), 300);
    }

    #[test]
    fn test_average_scaled_fractional() {
        // (4+5) / 2 = 4.50
        let agg = RatingAggregate { total_stars: 9, rating_count: 2 };
        assert_eq!(agg.average_scaled(), 450);
    }
}
