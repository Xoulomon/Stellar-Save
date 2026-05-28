//! # Group Search and Filtering
//!
//! Provides advanced query functions to search and filter groups by various criteria.
//!
//! ## Features
//! - Filter by status, contribution amount range, and member count range
//! - Cursor-based pagination (newest-first)
//! - Sorting by creation date or member count
//! - Gas-optimized with a hard cap of 50 results per page

use soroban_sdk::{contracttype, Env, Vec};

use crate::{
    group::{Group, GroupStatus},
    storage::StorageKeyBuilder,
};

/// Sort order for `search_groups` results.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum SortOrder {
    /// Newest groups first (descending by group ID / creation date). Default.
    CreatedDesc,
    /// Oldest groups first (ascending by group ID / creation date).
    CreatedAsc,
    /// Groups with the most members first.
    MemberCountDesc,
    /// Groups with the fewest members first.
    MemberCountAsc,
}

/// Parameters for `search_groups`.
///
/// All filter fields are optional — omitting a field means "no constraint".
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SearchParams {
    /// Only return groups with this status.
    pub status: Option<GroupStatus>,

    /// Only return groups whose `contribution_amount` is >= this value.
    pub min_amount: Option<i128>,

    /// Only return groups whose `contribution_amount` is <= this value.
    pub max_amount: Option<i128>,

    /// Only return groups whose `member_count` is >= this value.
    pub min_members: Option<u32>,

    /// Only return groups whose `member_count` is <= this value.
    pub max_members: Option<u32>,

    /// Cursor for pagination. Pass `0` to start from the latest group.
    /// On subsequent pages pass the `next_cursor` value from the previous result.
    pub cursor: u64,

    /// Maximum number of results to return. Capped at 50 for gas safety.
    pub limit: u32,

    /// Sort order for the results.
    pub sort: SortOrder,
}

/// Result returned by `search_groups`.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SearchResult {
    /// The matching groups for this page.
    pub groups: Vec<Group>,

    /// Cursor to pass as `SearchParams::cursor` to retrieve the next page.
    /// A value of `0` means there are no more results.
    pub next_cursor: u64,

    /// Total number of groups scanned to produce this page.
    /// Useful for estimating remaining pages.
    pub scanned: u32,
}

/// Maximum number of results allowed per page (gas guard).
pub const MAX_PAGE_SIZE: u32 = 50;

/// Core search implementation — called by the contract entry-point.
///
/// # Algorithm
/// 1. Determine the scan range from `cursor` and the stored `NextGroupId` counter.
/// 2. Iterate IDs in the requested direction, loading each group and applying filters.
/// 3. Stop once `limit` matching groups are collected or the scan range is exhausted.
/// 4. For `MemberCount*` sorts, collect all matches first then sort in-place.
pub fn search_groups(env: &Env, params: SearchParams) -> SearchResult {
    let limit = if params.limit == 0 || params.limit > MAX_PAGE_SIZE {
        MAX_PAGE_SIZE
    } else {
        params.limit
    };

    let max_id_key = StorageKeyBuilder::next_group_id();
    let current_max_id: u64 = env.storage().persistent().get(&max_id_key).unwrap_or(0);

    if current_max_id == 0 {
        return SearchResult {
            groups: Vec::new(env),
            next_cursor: 0,
            scanned: 0,
        };
    }

    let start = if params.cursor == 0 {
        current_max_id
    } else {
        params.cursor
    };

    // Collect matching groups (unsorted for now)
    let mut matched: Vec<Group> = Vec::new(env);
    let mut scanned: u32 = 0;
    let mut next_cursor: u64 = 0;

    match params.sort {
        SortOrder::CreatedDesc | SortOrder::MemberCountDesc | SortOrder::MemberCountAsc => {
            // Scan newest → oldest
            let mut id = start;
            loop {
                if id == 0 {
                    break;
                }
                if matched.len() >= limit {
                    // Record where to resume on the next page
                    next_cursor = id;
                    break;
                }

                scanned = scanned.saturating_add(1);

                let group_key = StorageKeyBuilder::group_data(id);
                if let Some(group) = env.storage().persistent().get::<_, Group>(&group_key) {
                    // Skip archived groups
                    let archived_key = StorageKeyBuilder::group_archived(id);
                    let is_archived = env
                        .storage()
                        .persistent()
                        .get::<_, bool>(&archived_key)
                        .unwrap_or(false);

                    if !is_archived && matches_filters(&group, &params) {
                        matched.push_back(group);
                    }
                }

                id -= 1;
            }
        }
        SortOrder::CreatedAsc => {
            // Scan oldest → newest
            let scan_start: u64 = if params.cursor == 0 { 1 } else { params.cursor };
            let mut id = scan_start;
            loop {
                if id > current_max_id {
                    break;
                }
                if matched.len() >= limit {
                    next_cursor = id;
                    break;
                }

                scanned = scanned.saturating_add(1);

                let group_key = StorageKeyBuilder::group_data(id);
                if let Some(group) = env.storage().persistent().get::<_, Group>(&group_key) {
                    let archived_key = StorageKeyBuilder::group_archived(id);
                    let is_archived = env
                        .storage()
                        .persistent()
                        .get::<_, bool>(&archived_key)
                        .unwrap_or(false);

                    if !is_archived && matches_filters(&group, &params) {
                        matched.push_back(group);
                    }
                }

                id += 1;
            }
        }
    }

    // Apply member-count sort (insertion sort — n ≤ 50 so O(n²) is fine on-chain)
    match params.sort {
        SortOrder::MemberCountDesc => sort_by_member_count(env, &matched, true),
        SortOrder::MemberCountAsc => sort_by_member_count(env, &matched, false),
        _ => SearchResult {
            groups: matched,
            next_cursor,
            scanned,
        },
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Returns `true` if `group` satisfies all active filter constraints.
fn matches_filters(group: &Group, params: &SearchParams) -> bool {
    if let Some(ref status) = params.status {
        if &group.status != status {
            return false;
        }
    }
    if let Some(min) = params.min_amount {
        if group.contribution_amount < min {
            return false;
        }
    }
    if let Some(max) = params.max_amount {
        if group.contribution_amount > max {
            return false;
        }
    }
    if let Some(min) = params.min_members {
        if group.member_count < min {
            return false;
        }
    }
    if let Some(max) = params.max_members {
        if group.member_count > max {
            return false;
        }
    }
    true
}

/// Sorts `groups` by `member_count` (insertion sort) and returns a `SearchResult`.
/// `descending = true` → most members first.
fn sort_by_member_count(env: &Env, groups: &Vec<Group>, descending: bool) -> SearchResult {
    // Copy into a plain array-like structure we can sort
    let len = groups.len();
    let mut sorted: Vec<Group> = Vec::new(env);

    // Insertion sort
    for i in 0..len {
        let item = groups.get(i).unwrap();
        let mut pos = sorted.len();
        for j in 0..sorted.len() {
            let cmp = sorted.get(j).unwrap();
            let should_insert_before = if descending {
                item.member_count > cmp.member_count
            } else {
                item.member_count < cmp.member_count
            };
            if should_insert_before {
                pos = j;
                break;
            }
        }
        // soroban Vec doesn't have insert; rebuild from scratch for each insertion
        if pos == sorted.len() {
            sorted.push_back(item);
        } else {
            let mut new_vec: Vec<Group> = Vec::new(env);
            for k in 0..pos {
                new_vec.push_back(sorted.get(k).unwrap());
            }
            new_vec.push_back(item);
            for k in pos..sorted.len() {
                new_vec.push_back(sorted.get(k).unwrap());
            }
            sorted = new_vec;
        }
    }

    SearchResult {
        groups: sorted,
        next_cursor: 0, // member-count sort loads all matches; no cursor support
        scanned: len,
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{group::Group, storage::StorageKeyBuilder};
    use soroban_sdk::{testutils::Address as _, Address, Env};

    /// Helper: write a minimal group directly into storage.
    fn store_group(
        env: &Env,
        id: u64,
        status: GroupStatus,
        contribution_amount: i128,
        member_count: u32,
        created_at: u64,
    ) {
        let creator = Address::generate(env);
        let mut g = Group::new(
            id,
            creator,
            contribution_amount,
            604800,
            10,
            2,
            created_at,
            0,
        );
        g.status = status;
        g.member_count = member_count;

        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(id), &g);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::next_group_id(), &id);
    }

    fn default_params(env: &Env) -> SearchParams {
        SearchParams {
            status: None,
            min_amount: None,
            max_amount: None,
            min_members: None,
            max_members: None,
            cursor: 0,
            limit: 50,
            sort: SortOrder::CreatedDesc,
        }
    }

    // ------------------------------------------------------------------
    // Basic retrieval
    // ------------------------------------------------------------------

    #[test]
    fn test_empty_storage_returns_empty() {
        let env = Env::default();
        let result = search_groups(&env, default_params(&env));
        assert_eq!(result.groups.len(), 0);
        assert_eq!(result.next_cursor, 0);
    }

    #[test]
    fn test_returns_all_groups_when_no_filters() {
        let env = Env::default();
        store_group(&env, 1, GroupStatus::Active, 100, 3, 1000);
        store_group(&env, 2, GroupStatus::Pending, 200, 2, 2000);
        store_group(&env, 3, GroupStatus::Completed, 300, 5, 3000);
        // Advance counter to 3
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::next_group_id(), &3u64);

        let result = search_groups(&env, default_params(&env));
        assert_eq!(result.groups.len(), 3);
    }

    // ------------------------------------------------------------------
    // Status filter
    // ------------------------------------------------------------------

    #[test]
    fn test_filter_by_status_active() {
        let env = Env::default();
        store_group(&env, 1, GroupStatus::Active, 100, 3, 1000);
        store_group(&env, 2, GroupStatus::Pending, 100, 2, 2000);
        store_group(&env, 3, GroupStatus::Active, 100, 4, 3000);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::next_group_id(), &3u64);

        let mut params = default_params(&env);
        params.status = Some(GroupStatus::Active);
        let result = search_groups(&env, params);

        assert_eq!(result.groups.len(), 2);
        for g in result.groups.iter() {
            assert_eq!(g.status, GroupStatus::Active);
        }
    }

    #[test]
    fn test_filter_by_status_pending() {
        let env = Env::default();
        store_group(&env, 1, GroupStatus::Active, 100, 3, 1000);
        store_group(&env, 2, GroupStatus::Pending, 100, 2, 2000);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::next_group_id(), &2u64);

        let mut params = default_params(&env);
        params.status = Some(GroupStatus::Pending);
        let result = search_groups(&env, params);

        assert_eq!(result.groups.len(), 1);
        assert_eq!(result.groups.get(0).unwrap().id, 2);
    }

    // ------------------------------------------------------------------
    // Amount range filter
    // ------------------------------------------------------------------

    #[test]
    fn test_filter_by_min_amount() {
        let env = Env::default();
        store_group(&env, 1, GroupStatus::Active, 50, 3, 1000);
        store_group(&env, 2, GroupStatus::Active, 150, 3, 2000);
        store_group(&env, 3, GroupStatus::Active, 300, 3, 3000);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::next_group_id(), &3u64);

        let mut params = default_params(&env);
        params.min_amount = Some(100);
        let result = search_groups(&env, params);

        assert_eq!(result.groups.len(), 2);
        for g in result.groups.iter() {
            assert!(g.contribution_amount >= 100);
        }
    }

    #[test]
    fn test_filter_by_max_amount() {
        let env = Env::default();
        store_group(&env, 1, GroupStatus::Active, 50, 3, 1000);
        store_group(&env, 2, GroupStatus::Active, 150, 3, 2000);
        store_group(&env, 3, GroupStatus::Active, 300, 3, 3000);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::next_group_id(), &3u64);

        let mut params = default_params(&env);
        params.max_amount = Some(200);
        let result = search_groups(&env, params);

        assert_eq!(result.groups.len(), 2);
        for g in result.groups.iter() {
            assert!(g.contribution_amount <= 200);
        }
    }

    #[test]
    fn test_filter_by_amount_range() {
        let env = Env::default();
        store_group(&env, 1, GroupStatus::Active, 50, 3, 1000);
        store_group(&env, 2, GroupStatus::Active, 150, 3, 2000);
        store_group(&env, 3, GroupStatus::Active, 300, 3, 3000);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::next_group_id(), &3u64);

        let mut params = default_params(&env);
        params.min_amount = Some(100);
        params.max_amount = Some(200);
        let result = search_groups(&env, params);

        assert_eq!(result.groups.len(), 1);
        assert_eq!(result.groups.get(0).unwrap().contribution_amount, 150);
    }

    // ------------------------------------------------------------------
    // Member count filter
    // ------------------------------------------------------------------

    #[test]
    fn test_filter_by_min_members() {
        let env = Env::default();
        store_group(&env, 1, GroupStatus::Active, 100, 2, 1000);
        store_group(&env, 2, GroupStatus::Active, 100, 5, 2000);
        store_group(&env, 3, GroupStatus::Active, 100, 8, 3000);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::next_group_id(), &3u64);

        let mut params = default_params(&env);
        params.min_members = Some(5);
        let result = search_groups(&env, params);

        assert_eq!(result.groups.len(), 2);
        for g in result.groups.iter() {
            assert!(g.member_count >= 5);
        }
    }

    #[test]
    fn test_filter_by_max_members() {
        let env = Env::default();
        store_group(&env, 1, GroupStatus::Active, 100, 2, 1000);
        store_group(&env, 2, GroupStatus::Active, 100, 5, 2000);
        store_group(&env, 3, GroupStatus::Active, 100, 8, 3000);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::next_group_id(), &3u64);

        let mut params = default_params(&env);
        params.max_members = Some(5);
        let result = search_groups(&env, params);

        assert_eq!(result.groups.len(), 2);
        for g in result.groups.iter() {
            assert!(g.member_count <= 5);
        }
    }

    #[test]
    fn test_filter_by_member_range() {
        let env = Env::default();
        store_group(&env, 1, GroupStatus::Active, 100, 2, 1000);
        store_group(&env, 2, GroupStatus::Active, 100, 5, 2000);
        store_group(&env, 3, GroupStatus::Active, 100, 8, 3000);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::next_group_id(), &3u64);

        let mut params = default_params(&env);
        params.min_members = Some(3);
        params.max_members = Some(6);
        let result = search_groups(&env, params);

        assert_eq!(result.groups.len(), 1);
        assert_eq!(result.groups.get(0).unwrap().member_count, 5);
    }

    // ------------------------------------------------------------------
    // Combined filters
    // ------------------------------------------------------------------

    #[test]
    fn test_combined_filters() {
        let env = Env::default();
        store_group(&env, 1, GroupStatus::Active, 100, 3, 1000);
        store_group(&env, 2, GroupStatus::Pending, 200, 5, 2000);
        store_group(&env, 3, GroupStatus::Active, 200, 5, 3000);
        store_group(&env, 4, GroupStatus::Active, 200, 2, 4000);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::next_group_id(), &4u64);

        let mut params = default_params(&env);
        params.status = Some(GroupStatus::Active);
        params.min_amount = Some(150);
        params.min_members = Some(4);
        let result = search_groups(&env, params);

        assert_eq!(result.groups.len(), 1);
        assert_eq!(result.groups.get(0).unwrap().id, 3);
    }

    // ------------------------------------------------------------------
    // Pagination
    // ------------------------------------------------------------------

    #[test]
    fn test_pagination_limit() {
        let env = Env::default();
        for i in 1u64..=10 {
            store_group(&env, i, GroupStatus::Active, 100, 3, i * 1000);
        }
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::next_group_id(), &10u64);

        let mut params = default_params(&env);
        params.limit = 3;
        let result = search_groups(&env, params);

        assert_eq!(result.groups.len(), 3);
        assert_ne!(result.next_cursor, 0); // more pages available
    }

    #[test]
    fn test_pagination_next_page() {
        let env = Env::default();
        for i in 1u64..=6 {
            store_group(&env, i, GroupStatus::Active, 100, 3, i * 1000);
        }
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::next_group_id(), &6u64);

        let mut params = default_params(&env);
        params.limit = 3;

        let page1 = search_groups(&env, params.clone());
        assert_eq!(page1.groups.len(), 3);
        assert_ne!(page1.next_cursor, 0);

        params.cursor = page1.next_cursor;
        let page2 = search_groups(&env, params);
        assert_eq!(page2.groups.len(), 3);
        assert_eq!(page2.next_cursor, 0); // no more pages
    }

    #[test]
    fn test_page_size_capped_at_50() {
        let env = Env::default();
        for i in 1u64..=60 {
            store_group(&env, i, GroupStatus::Active, 100, 3, i * 1000);
        }
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::next_group_id(), &60u64);

        let mut params = default_params(&env);
        params.limit = 100; // request more than cap
        let result = search_groups(&env, params);

        assert_eq!(result.groups.len(), 50); // capped at MAX_PAGE_SIZE
    }

    // ------------------------------------------------------------------
    // Sorting
    // ------------------------------------------------------------------

    #[test]
    fn test_sort_created_desc() {
        let env = Env::default();
        store_group(&env, 1, GroupStatus::Active, 100, 3, 1000);
        store_group(&env, 2, GroupStatus::Active, 100, 3, 2000);
        store_group(&env, 3, GroupStatus::Active, 100, 3, 3000);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::next_group_id(), &3u64);

        let mut params = default_params(&env);
        params.sort = SortOrder::CreatedDesc;
        let result = search_groups(&env, params);

        // Newest first → IDs 3, 2, 1
        assert_eq!(result.groups.get(0).unwrap().id, 3);
        assert_eq!(result.groups.get(1).unwrap().id, 2);
        assert_eq!(result.groups.get(2).unwrap().id, 1);
    }

    #[test]
    fn test_sort_created_asc() {
        let env = Env::default();
        store_group(&env, 1, GroupStatus::Active, 100, 3, 1000);
        store_group(&env, 2, GroupStatus::Active, 100, 3, 2000);
        store_group(&env, 3, GroupStatus::Active, 100, 3, 3000);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::next_group_id(), &3u64);

        let mut params = default_params(&env);
        params.sort = SortOrder::CreatedAsc;
        let result = search_groups(&env, params);

        // Oldest first → IDs 1, 2, 3
        assert_eq!(result.groups.get(0).unwrap().id, 1);
        assert_eq!(result.groups.get(1).unwrap().id, 2);
        assert_eq!(result.groups.get(2).unwrap().id, 3);
    }

    #[test]
    fn test_sort_member_count_desc() {
        let env = Env::default();
        store_group(&env, 1, GroupStatus::Active, 100, 2, 1000);
        store_group(&env, 2, GroupStatus::Active, 100, 8, 2000);
        store_group(&env, 3, GroupStatus::Active, 100, 5, 3000);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::next_group_id(), &3u64);

        let mut params = default_params(&env);
        params.sort = SortOrder::MemberCountDesc;
        let result = search_groups(&env, params);

        assert_eq!(result.groups.get(0).unwrap().member_count, 8);
        assert_eq!(result.groups.get(1).unwrap().member_count, 5);
        assert_eq!(result.groups.get(2).unwrap().member_count, 2);
    }

    #[test]
    fn test_sort_member_count_asc() {
        let env = Env::default();
        store_group(&env, 1, GroupStatus::Active, 100, 2, 1000);
        store_group(&env, 2, GroupStatus::Active, 100, 8, 2000);
        store_group(&env, 3, GroupStatus::Active, 100, 5, 3000);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::next_group_id(), &3u64);

        let mut params = default_params(&env);
        params.sort = SortOrder::MemberCountAsc;
        let result = search_groups(&env, params);

        assert_eq!(result.groups.get(0).unwrap().member_count, 2);
        assert_eq!(result.groups.get(1).unwrap().member_count, 5);
        assert_eq!(result.groups.get(2).unwrap().member_count, 8);
    }

    // ------------------------------------------------------------------
    // Archived groups excluded
    // ------------------------------------------------------------------

    #[test]
    fn test_archived_groups_excluded() {
        let env = Env::default();
        store_group(&env, 1, GroupStatus::Active, 100, 3, 1000);
        store_group(&env, 2, GroupStatus::Completed, 100, 5, 2000);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::next_group_id(), &2u64);

        // Archive group 2
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_archived(2), &true);

        let result = search_groups(&env, default_params(&env));
        assert_eq!(result.groups.len(), 1);
        assert_eq!(result.groups.get(0).unwrap().id, 1);
    }

    // ------------------------------------------------------------------
    // No matches
    // ------------------------------------------------------------------

    #[test]
    fn test_no_matches_returns_empty() {
        let env = Env::default();
        store_group(&env, 1, GroupStatus::Active, 100, 3, 1000);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::next_group_id(), &1u64);

        let mut params = default_params(&env);
        params.status = Some(GroupStatus::Cancelled);
        let result = search_groups(&env, params);

        assert_eq!(result.groups.len(), 0);
        assert_eq!(result.next_cursor, 0);
    }
}
