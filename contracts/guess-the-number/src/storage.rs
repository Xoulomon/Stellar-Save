use soroban_sdk::{symbol_short, Address, Env, Symbol};

use crate::types::Group;

/// Storage keys for the contract
pub struct StorageKey;

#[allow(dead_code)]
impl StorageKey {
    pub const GROUP_PREFIX: Symbol = symbol_short!("GROUP");
    pub const MEMBER_PREFIX: Symbol = symbol_short!("MEMBER");
    pub const GROUP_COUNT: Symbol = symbol_short!("GRP_CNT");
}

/// Load a group from storage
pub fn load_group(env: &Env, group_id: u64) -> Option<Group> {
    let key = (StorageKey::GROUP_PREFIX, group_id);
    env.storage().persistent().get(&key)
}

/// Save a group to storage
pub fn save_group(env: &Env, group: &Group) {
    let key = (StorageKey::GROUP_PREFIX, group.id);
    env.storage().persistent().set(&key, group);
    // Extend TTL for 30 days (in ledgers, ~5 seconds per ledger)
    env.storage().persistent().extend_ttl(&key, 518400, 518400);
}

/// Check if a member exists in a group
#[allow(dead_code)]
pub fn is_member(env: &Env, group_id: u64, member: &Address) -> bool {
    let key = (StorageKey::MEMBER_PREFIX, group_id, member);
    env.storage().persistent().has(&key)
}

/// Add a member to storage
#[allow(dead_code)]
pub fn add_member(env: &Env, group_id: u64, member: &Address) {
    let key = (StorageKey::MEMBER_PREFIX, group_id, member);
    env.storage().persistent().set(&key, &true);
    env.storage().persistent().extend_ttl(&key, 518400, 518400);
}
