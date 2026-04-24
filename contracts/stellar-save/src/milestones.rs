use crate::error::StellarSaveError;
use crate::storage::StorageKeyBuilder;
use soroban_sdk::{contracttype, Address, Env, Vec};

/// Milestone thresholds (consecutive cycles contributed).
pub const MILESTONE_THRESHOLDS: [u32; 3] = [5, 10, 20];

/// A single milestone record for a member.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MemberMilestone {
    /// The streak threshold that was reached (5, 10, or 20).
    pub threshold: u32,
    /// The cycle number on which the milestone was reached.
    pub reached_at_cycle: u32,
}

/// Streak state stored per (group, member).
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContributionStreak {
    /// Current consecutive-contribution streak length.
    pub current_streak: u32,
    /// Highest streak ever achieved.
    pub best_streak: u32,
    /// Last cycle in which the member contributed (used to detect gaps).
    pub last_contributed_cycle: u32,
}

impl ContributionStreak {
    pub fn default() -> Self {
        Self {
            current_streak: 0,
            best_streak: 0,
            last_contributed_cycle: u32::MAX, // sentinel: never contributed
        }
    }
}

/// Updates the streak for a member after a successful contribution and emits
/// `MilestoneReached` events for any newly crossed thresholds.
///
/// Called from `record_contribution` immediately after the contribution is stored.
///
/// # Arguments
/// * `env`        - Soroban environment
/// * `group_id`   - ID of the group
/// * `member`     - Address of the contributing member
/// * `cycle`      - The cycle number just contributed to
pub fn update_streak(env: &Env, group_id: u64, member: Address, cycle: u32) {
    let key = StorageKeyBuilder::member_streak(group_id, member.clone());

    let mut streak: ContributionStreak = env
        .storage()
        .persistent()
        .get(&key)
        .unwrap_or(ContributionStreak::default());

    // Determine whether this contribution continues the streak or resets it.
    let new_streak = if streak.last_contributed_cycle == u32::MAX {
        // First-ever contribution
        1
    } else if cycle == streak.last_contributed_cycle + 1 {
        // Consecutive cycle
        streak.current_streak.saturating_add(1)
    } else {
        // Gap detected — streak resets to 1
        1
    };

    let old_streak = streak.current_streak;
    streak.current_streak = new_streak;
    streak.last_contributed_cycle = cycle;
    if new_streak > streak.best_streak {
        streak.best_streak = new_streak;
    }

    env.storage().persistent().set(&key, &streak);

    // Emit MilestoneReached for every threshold crossed by this contribution.
    for &threshold in MILESTONE_THRESHOLDS.iter() {
        if old_streak < threshold && new_streak >= threshold {
            crate::events::EventEmitter::emit_milestone_reached(
                env,
                group_id,
                member.clone(),
                threshold,
                cycle,
            );
        }
    }
}

/// Returns all milestones reached by a member in a group.
///
/// Scans the member's contribution history to reconstruct which milestone
/// thresholds were crossed and at which cycle.
///
/// # Arguments
/// * `env`      - Soroban environment
/// * `group_id` - ID of the group
/// * `member`   - Address of the member
///
/// # Returns
/// * `Ok(Vec<MemberMilestone>)` - Milestones reached, in threshold order
/// * `Err(StellarSaveError::GroupNotFound)` - Group doesn't exist
/// * `Err(StellarSaveError::NotMember)` - Member not in group
pub fn get_member_milestones(
    env: &Env,
    group_id: u64,
    member: Address,
) -> Result<Vec<MemberMilestone>, StellarSaveError> {
    // Verify group exists
    let group_key = StorageKeyBuilder::group_data(group_id);
    let group: crate::group::Group = env
        .storage()
        .persistent()
        .get(&group_key)
        .ok_or(StellarSaveError::GroupNotFound)?;

    // Verify member belongs to the group
    let member_key = StorageKeyBuilder::member_profile(group_id, member.clone());
    if !env.storage().persistent().has(&member_key) {
        return Err(StellarSaveError::NotMember);
    }

    // Walk contribution history to replay streak and record milestone crossings.
    let mut milestones: Vec<MemberMilestone> = Vec::new(env);
    let mut streak: u32 = 0;
    let mut last_cycle: u32 = u32::MAX; // sentinel

    for cycle in 0..=group.current_cycle {
        let contrib_key =
            StorageKeyBuilder::contribution_individual(group_id, cycle, member.clone());
        if env.storage().persistent().has(&contrib_key) {
            let new_streak = if last_cycle == u32::MAX || cycle == last_cycle + 1 {
                streak.saturating_add(1)
            } else {
                1
            };
            let old_streak = streak;
            streak = new_streak;
            last_cycle = cycle;

            for &threshold in MILESTONE_THRESHOLDS.iter() {
                if old_streak < threshold && new_streak >= threshold {
                    milestones.push_back(MemberMilestone {
                        threshold,
                        reached_at_cycle: cycle,
                    });
                }
            }
        } else {
            // Gap — streak resets
            streak = 0;
            last_cycle = u32::MAX;
        }
    }

    Ok(milestones)
}

/// Returns the current streak state for a member.
pub fn get_streak(env: &Env, group_id: u64, member: Address) -> ContributionStreak {
    let key = StorageKeyBuilder::member_streak(group_id, member);
    env.storage()
        .persistent()
        .get(&key)
        .unwrap_or(ContributionStreak::default())
}
