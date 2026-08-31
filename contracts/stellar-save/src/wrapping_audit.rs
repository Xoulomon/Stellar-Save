//! Issue #1328 — Redundant Option/Result Wrapping Audit
//!
//! ## Audit Result: No removable double-wrapping found.
//!
//! All non-pub helpers use plain Result<T,E> or Option<T>.
//! The two Result<Option<>> patterns on public functions are intentional:
//!   - Err  = bad input (no such group / not a member)
//!   - Ok(None)  = valid state, record simply doesn't exist yet
//!   - Ok(Some)  = record found
//!
//! Collapsing either layer would lose caller-visible information.

#[cfg(test)]
mod tests {
    use soroban_sdk::{testutils::Address as _, Address, Env};

    use crate::{
        group::{Group, GroupStatus},
        storage::StorageKeyBuilder,
        types::MemberProfile,
        StellarSaveContract, StellarSaveError,
    };

    fn store_group_and_member(env: &Env, group_id: u64, creator: &Address, member: &Address) {
        let mut g = Group::new(group_id, creator.clone(), 100, 604_800, 5, 2, 1000, 0);
        g.status = GroupStatus::Active;
        g.member_count = 1;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &g);
        let profile = MemberProfile {
            address: member.clone(),
            group_id,
            payout_position: 0,
            joined_at: 1000,
        };
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::member_profile(group_id, member.clone()), &profile);
    }

    /// Ok(None) is distinct from Err — proves the Result<Option<>> is necessary.
    #[test]
    fn test_get_member_payout_ok_none_for_member_without_payout() {
        let env = Env::default();
        env.mock_all_auths();
        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        store_group_and_member(&env, 1, &creator, &member);

        let result = StellarSaveContract::get_member_payout(env.clone(), 1, member.clone());
        assert!(result.is_ok(), "member exists — must be Ok, not Err");
        assert!(result.unwrap().is_none(), "no payout yet — must be None");
    }

    /// Err(NotMember) is distinct from Ok(None) — proves the Result layer is necessary.
    #[test]
    fn test_get_member_payout_err_for_non_member() {
        let env = Env::default();
        env.mock_all_auths();
        let creator = Address::generate(&env);
        let non_member = Address::generate(&env);
        let g = Group::new(1, creator.clone(), 1_000_000, 604_800, 5, 2, 1000, 0);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(1), &g);

        let result = StellarSaveContract::get_member_payout(env.clone(), 1, non_member);
        assert_eq!(result.unwrap_err(), StellarSaveError::NotMember,
            "non-member must return Err(NotMember), not Ok(None)");
    }

    /// Ok(None) for get_member_rating when no rating yet.
    #[test]
    fn test_get_member_rating_ok_none_for_unrated_member() {
        let env = Env::default();
        env.mock_all_auths();
        let creator = Address::generate(&env);
        let member = Address::generate(&env);

        let mut g = Group::new(1, creator.clone(), 1_000_000, 604_800, 5, 2, 1000, 0);
        g.status = GroupStatus::Completed;
        g.member_count = 1;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(1), &g);
        let profile = MemberProfile {
            address: member.clone(),
            group_id: 1,
            payout_position: 0,
            joined_at: 1000,
        };
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::member_profile(1, member.clone()), &profile);

        let result = crate::rating::get_member_rating(&env, 1, member);
        assert!(result.is_ok(), "group+member exist — must be Ok");
        assert!(result.unwrap().is_none(), "unrated — must be None");
    }
}
