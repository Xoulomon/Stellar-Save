use soroban_sdk::{contracttype, Address, Env, String};

pub const GROUP_SCHEMA_VERSION: u32 = 1;

/// Event emitted when a new savings group is created.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GroupCreated {
    pub schema_version: u32,
    pub group_id: u64,
    pub creator: Address,
    pub contribution_amount: i128,
    pub cycle_duration: u64,
    pub max_members: u32,
    pub created_at: u64,
}

/// Event emitted when a new member joins a group.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MemberJoined {
    pub schema_version: u32,
    pub group_id: u64,
    pub member: Address,
    pub member_count: u32,
    pub joined_at: u64,
}

/// Event emitted when a member leaves a group before activation.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MemberLeft {
    pub schema_version: u32,
    pub group_id: u64,
    pub member: Address,
    pub member_count: u32,
    pub left_at: u64,
}

/// Event emitted when the group creator removes a member before cycle 1 begins.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MemberRemoved {
    pub schema_version: u32,
    pub group_id: u64,
    pub member: Address,
    pub removed_by: Address,
    pub member_count: u32,
    pub removed_at: u64,
}

/// Event emitted when a group completes all cycles.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GroupCompleted {
    pub schema_version: u32,
    pub group_id: u64,
    pub creator: Address,
    pub total_cycles: u32,
    pub total_distributed: i128,
    pub completed_at: u64,
}

/// Event emitted when a group's status changes.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GroupStatusChanged {
    pub schema_version: u32,
    pub group_id: u64,
    pub old_status: u32,
    pub new_status: u32,
    pub changed_by: Address,
    pub changed_at: u64,
}

/// Event emitted when a group's metadata is updated.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GroupMetadataUpdated {
    pub schema_version: u32,
    pub group_id: u64,
    pub updated_by: Address,
    pub name: String,
    pub description: String,
    pub image_url: String,
    pub updated_at: u64,
}

/// Event emitted when a specific group is paused by its creator.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GroupPaused {
    pub schema_version: u32,
    pub group_id: u64,
    pub paused_by: Address,
    pub paused_at: u64,
}

/// Event emitted when a specific group is unpaused by its creator.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GroupUnpaused {
    pub schema_version: u32,
    pub group_id: u64,
    pub unpaused_by: Address,
    pub unpaused_at: u64,
}

/// Event emitted when a creator invites an address to join a group.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MemberInvited {
    pub schema_version: u32,
    pub group_id: u64,
    pub invited: Address,
    pub invited_by: Address,
    pub invited_at: u64,
}

/// Event emitted when a creator revokes a pending invitation.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct InvitationRevoked {
    pub schema_version: u32,
    pub group_id: u64,
    pub revoked: Address,
    pub revoked_by: Address,
    pub revoked_at: u64,
}

// ── Emitters ──────────────────────────────────────────────────────────────────

pub fn emit_group_created(
    env: &Env,
    group_id: u64,
    creator: Address,
    contribution_amount: i128,
    cycle_duration: u64,
    max_members: u32,
    created_at: u64,
) {
    env.events().publish(
        ("group_created",),
        GroupCreated { schema_version: GROUP_SCHEMA_VERSION, group_id, creator, contribution_amount, cycle_duration, max_members, created_at },
    );
}

pub fn emit_member_joined(env: &Env, group_id: u64, member: Address, member_count: u32, joined_at: u64) {
    env.events().publish(
        ("member_joined",),
        MemberJoined { schema_version: GROUP_SCHEMA_VERSION, group_id, member, member_count, joined_at },
    );
}

pub fn emit_member_left(env: &Env, group_id: u64, member: Address, member_count: u32, left_at: u64) {
    env.events().publish(
        ("member_left",),
        MemberLeft { schema_version: GROUP_SCHEMA_VERSION, group_id, member, member_count, left_at },
    );
}

pub fn emit_member_removed(
    env: &Env,
    group_id: u64,
    member: Address,
    removed_by: Address,
    member_count: u32,
    removed_at: u64,
) {
    env.events().publish(
        ("member_removed",),
        MemberRemoved { schema_version: GROUP_SCHEMA_VERSION, group_id, member, removed_by, member_count, removed_at },
    );
}

pub fn emit_group_completed(
    env: &Env,
    group_id: u64,
    creator: Address,
    total_cycles: u32,
    total_distributed: i128,
    completed_at: u64,
) {
    env.events().publish(
        ("group_completed",),
        GroupCompleted { schema_version: GROUP_SCHEMA_VERSION, group_id, creator, total_cycles, total_distributed, completed_at },
    );
}

pub fn emit_group_status_changed(
    env: &Env,
    group_id: u64,
    old_status: u32,
    new_status: u32,
    changed_by: Address,
    changed_at: u64,
) {
    env.events().publish(
        ("group_status_changed",),
        GroupStatusChanged { schema_version: GROUP_SCHEMA_VERSION, group_id, old_status, new_status, changed_by, changed_at },
    );
}

pub fn emit_group_metadata_updated(
    env: &Env,
    group_id: u64,
    updated_by: Address,
    name: String,
    description: String,
    image_url: String,
    updated_at: u64,
) {
    env.events().publish(
        ("group_metadata_updated",),
        GroupMetadataUpdated { schema_version: GROUP_SCHEMA_VERSION, group_id, updated_by, name, description, image_url, updated_at },
    );
}

pub fn emit_group_paused(env: &Env, group_id: u64, paused_by: Address, paused_at: u64) {
    env.events().publish(
        ("group_paused",),
        GroupPaused { schema_version: GROUP_SCHEMA_VERSION, group_id, paused_by, paused_at },
    );
}

pub fn emit_group_unpaused(env: &Env, group_id: u64, unpaused_by: Address, unpaused_at: u64) {
    env.events().publish(
        ("group_unpaused",),
        GroupUnpaused { schema_version: GROUP_SCHEMA_VERSION, group_id, unpaused_by, unpaused_at },
    );
}

pub fn emit_member_invited(
    env: &Env,
    group_id: u64,
    invited: Address,
    invited_by: Address,
    invited_at: u64,
) {
    env.events().publish(
        ("member_invited",),
        MemberInvited { schema_version: GROUP_SCHEMA_VERSION, group_id, invited, invited_by, invited_at },
    );
}

pub fn emit_invitation_revoked(
    env: &Env,
    group_id: u64,
    revoked: Address,
    revoked_by: Address,
    revoked_at: u64,
) {
    env.events().publish(
        ("invitation_revoked",),
        InvitationRevoked { schema_version: GROUP_SCHEMA_VERSION, group_id, revoked, revoked_by, revoked_at },
    );
}

// ── Extended group events (lifecycle extras) ──────────────────────────────────

/// Event emitted when a group is dissolved.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GroupDissolved {
    pub schema_version: u32,
    pub group_id: u64,
    pub dissolved_at: u64,
    pub total_refunded: i128,
}

/// Event emitted when a group is cloned.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GroupCloned {
    pub schema_version: u32,
    pub original_group_id: u64,
    pub new_group_id: u64,
    pub creator: Address,
    pub cloned_at: u64,
}

/// Event emitted when two groups are merged into a new group.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GroupsMerged {
    pub schema_version: u32,
    pub merged_group_id: u64,
    pub source_group_id_1: u64,
    pub source_group_id_2: u64,
    pub member_count: u32,
    pub combined_balance: i128,
    pub merged_at: u64,
}

/// Event emitted when a completed group is archived by its creator.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GroupArchived {
    pub schema_version: u32,
    pub group_id: u64,
    pub archived_by: Address,
    pub archived_at: u64,
}

/// Event emitted when a member rates a group after completion.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GroupRated {
    pub schema_version: u32,
    pub group_id: u64,
    pub member: Address,
    pub stars: u32,
    pub comment: String,
    pub rated_at: u64,
}

/// Event emitted when a member reaches a contribution streak milestone.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MilestoneReached {
    pub schema_version: u32,
    pub group_id: u64,
    pub member: Address,
    /// The streak threshold crossed (e.g. 5, 10, 20).
    pub threshold: u32,
    /// The cycle number on which the milestone was reached.
    pub reached_at_cycle: u32,
}

/// Event emitted when a member joins a group via a referral.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MemberReferred {
    pub schema_version: u32,
    pub group_id: u64,
    pub invitee: Address,
    pub referrer: Address,
    pub referred_at: u64,
}

/// Event emitted when a member claims their completion reward.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RewardClaimed {
    pub schema_version: u32,
    pub group_id: u64,
    pub member: Address,
    pub amount: i128,
    pub claimed_at: u64,
}

// ── Extended emitters ─────────────────────────────────────────────────────────

pub fn emit_group_dissolved(env: &Env, group_id: u64, dissolved_at: u64, total_refunded: i128) {
    env.events().publish(
        ("group_dissolved",),
        GroupDissolved { schema_version: GROUP_SCHEMA_VERSION, group_id, dissolved_at, total_refunded },
    );
}

pub fn emit_group_cloned(
    env: &Env,
    original_group_id: u64,
    new_group_id: u64,
    creator: Address,
    cloned_at: u64,
) {
    env.events().publish(
        ("group_cloned",),
        GroupCloned { schema_version: GROUP_SCHEMA_VERSION, original_group_id, new_group_id, creator, cloned_at },
    );
}

pub fn emit_groups_merged(
    env: &Env,
    merged_group_id: u64,
    source_group_id_1: u64,
    source_group_id_2: u64,
    member_count: u32,
    combined_balance: i128,
    merged_at: u64,
) {
    env.events().publish(
        ("groups_merged",),
        GroupsMerged { schema_version: GROUP_SCHEMA_VERSION, merged_group_id, source_group_id_1, source_group_id_2, member_count, combined_balance, merged_at },
    );
}

pub fn emit_group_archived(env: &Env, group_id: u64, archived_by: Address, archived_at: u64) {
    env.events().publish(
        ("group_archived",),
        GroupArchived { schema_version: GROUP_SCHEMA_VERSION, group_id, archived_by, archived_at },
    );
}

pub fn emit_group_rated(
    env: &Env,
    group_id: u64,
    member: Address,
    stars: u32,
    comment: String,
    rated_at: u64,
) {
    env.events().publish(
        ("group_rated",),
        GroupRated { schema_version: GROUP_SCHEMA_VERSION, group_id, member, stars, comment, rated_at },
    );
}

pub fn emit_milestone_reached(
    env: &Env,
    group_id: u64,
    member: Address,
    threshold: u32,
    reached_at_cycle: u32,
) {
    env.events().publish(
        ("milestone_reached",),
        MilestoneReached { schema_version: GROUP_SCHEMA_VERSION, group_id, member, threshold, reached_at_cycle },
    );
}

pub fn emit_member_referred(
    env: &Env,
    group_id: u64,
    invitee: Address,
    referrer: Address,
    referred_at: u64,
) {
    env.events().publish(
        ("member_referred",),
        MemberReferred { schema_version: GROUP_SCHEMA_VERSION, group_id, invitee, referrer, referred_at },
    );
}

pub fn emit_reward_claimed(env: &Env, group_id: u64, member: Address, amount: i128, claimed_at: u64) {
    env.events().publish(
        ("reward_claimed",),
        RewardClaimed { schema_version: GROUP_SCHEMA_VERSION, group_id, member, amount, claimed_at },
    );
}
