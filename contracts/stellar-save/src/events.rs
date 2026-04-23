use soroban_sdk::{contracttype, Address, Env};

/// Event emitted when a new savings group is created.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GroupCreated {
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
    pub group_id: u64,
    pub member: Address,
    pub member_count: u32,
    pub joined_at: u64,
}

/// Event emitted when a member leaves a group before activation.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MemberLeft {
    pub group_id: u64,
    pub member: Address,
    pub member_count: u32,
    pub left_at: u64,
}

/// Event emitted when a member makes a contribution.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContributionMade {
    pub group_id: u64,
    pub contributor: Address,
    pub amount: i128,
    pub cycle: u32,
    pub cycle_total: i128,
    pub contributed_at: u64,
}

/// Event emitted when a payout is executed.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PayoutExecuted {
    pub group_id: u64,
    pub recipient: Address,
    pub amount: i128,
    pub cycle: u32,
    pub executed_at: u64,
}

/// Event emitted when a group completes all cycles.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GroupCompleted {
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
    pub group_id: u64,
    pub old_status: u32,
    pub new_status: u32,
    pub changed_by: Address,
    pub changed_at: u64,
}

/// Event emitted when contract is paused.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContractPaused {
    pub admin: Address,
    pub timestamp: u64,
}

/// Event emitted when contract is unpaused.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContractUnpaused {
    pub admin: Address,
    pub timestamp: u64,
}



/// Event emitted when a contribution proof is verified (#479).
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContributionVerified {
    pub group_id: u64,
    pub contributor: Address,
    pub cycle: u32,
    pub verified_at: u64,
}

/// Event emitted when a contribution amount change is proposed (#480).
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContributionAmountProposed {
    pub group_id: u64,
    pub proposed_by: Address,
    pub old_amount: i128,
    pub new_amount: i128,
    pub proposed_at: u64,
}

/// Event emitted when a contribution amount change is approved and applied (#480).
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContributionAmountChanged {
    pub group_id: u64,
    pub old_amount: i128,
    pub new_amount: i128,
    pub effective_cycle: u32,
    pub changed_at: u64,

/// Event emitted when a specific group is paused by its creator.

/// Event emitted when a cycle starts.

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CycleStarted {
    pub group_id: u64,
    pub cycle_id: u32,
    pub started_at: u64,
}

/// Event emitted when a cycle ends (transitions to next).
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CycleEnded {
    pub group_id: u64,

    pub unpaused_by: Address,
    pub unpaused_at: u64,


    pub cycle_id: u32,
    pub ended_at: u64,

}

/// Utility functions for emitting events.
pub struct EventEmitter;

/// Event emitted when a penalty is applied to a member for a missed contribution.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PenaltyApplied {
    pub group_id: u64,
    pub member: Address,
    pub amount: i128,
    pub cycle_id: u32,
    pub applied_at: u64,
}

/// Event emitted when a member successfully recovers from a penalty.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PenaltyRecovered {
    pub group_id: u64,
    pub member: Address,
    pub cycle_id: u32,
    pub recovered_at: u64,
}

impl EventEmitter {
    pub fn emit_group_created(
        env: &Env,
        group_id: u64,
        creator: Address,
        contribution_amount: i128,
        cycle_duration: u64,
        max_members: u32,
        created_at: u64,
    ) {
        let event = GroupCreated {
            group_id,
            creator,
            contribution_amount,
            cycle_duration,
            max_members,
            created_at,
        };
        env.events().publish(("group_created",), event);
    }

    pub fn emit_member_joined(
        env: &Env,
        group_id: u64,
        member: Address,
        member_count: u32,
        joined_at: u64,
    ) {
        let event = MemberJoined {
            group_id,
            member,
            member_count,
            joined_at,
        };
        env.events().publish(("member_joined",), event);
    }

    pub fn emit_member_left(
        env: &Env,
        group_id: u64,
        member: Address,
        member_count: u32,
        left_at: u64,
    ) {
        let event = MemberLeft {
            group_id,
            member,
            member_count,
            left_at,
        };
        env.events().publish(("member_left",), event);
    }

    pub fn emit_contribution_made(
        env: &Env,
        group_id: u64,
        contributor: Address,
        amount: i128,
        cycle: u32,
        cycle_total: i128,
        contributed_at: u64,
    ) {
        let event = ContributionMade {
            group_id,
            contributor,
            amount,
            cycle,
            cycle_total,
            contributed_at,
        };
        env.events().publish(("contribution_made",), event);
    }

    pub fn emit_payout_executed(
        env: &Env,
        group_id: u64,
        recipient: Address,
        amount: i128,
        cycle: u32,
        executed_at: u64,
    ) {
        let event = PayoutExecuted {
            group_id,
            recipient,
            amount,
            cycle,
            executed_at,
        };
        env.events().publish(("payout_executed",), event);
    }

    pub fn emit_group_completed(
        env: &Env,
        group_id: u64,
        creator: Address,
        total_cycles: u32,
        total_distributed: i128,
        completed_at: u64,
    ) {
        let event = GroupCompleted {
            group_id,
            creator,
            total_cycles,
            total_distributed,
            completed_at,
        };
        env.events().publish(("group_completed",), event);
    }

    pub fn emit_group_status_changed(
        env: &Env,
        group_id: u64,
        old_status: u32,
        new_status: u32,
        changed_by: Address,
        changed_at: u64,
    ) {
        let event = GroupStatusChanged {
            group_id,
            old_status,
            new_status,
            changed_by,
            changed_at,
        };
        env.events().publish(("group_status_changed",), event);
    }

    pub fn emit_contract_paused(env: &Env, admin: Address, timestamp: u64) {
        let event = ContractPaused { admin, timestamp };
        env.events().publish(("contract_paused",), event);
    }

    pub fn emit_contract_unpaused(env: &Env, admin: Address, timestamp: u64) {
        let event = ContractUnpaused { admin, timestamp };
        env.events().publish(("contract_unpaused",), event);
    }



    pub fn emit_contribution_verified(
        env: &Env,
        group_id: u64,
        contributor: Address,
        cycle: u32,
        verified_at: u64,
    ) {
        let event = ContributionVerified {
            group_id,
            contributor,
            cycle,
            verified_at,
        };
        env.events().publish(("contribution_verified",), event);
    }

    pub fn emit_contribution_amount_proposed(
        env: &Env,
        group_id: u64,
        proposed_by: Address,
        old_amount: i128,
        new_amount: i128,
        proposed_at: u64,
    ) {
        let event = ContributionAmountProposed {
            group_id,
            proposed_by,
            old_amount,
            new_amount,
            proposed_at,
        };
        env.events().publish(("contribution_amount_proposed",), event);
    }

    pub fn emit_contribution_amount_changed(
        env: &Env,
        group_id: u64,
        old_amount: i128,
        new_amount: i128,
        effective_cycle: u32,
        changed_at: u64,
    ) {
        let event = ContributionAmountChanged {
            group_id,
            old_amount,
            new_amount,
            effective_cycle,
            changed_at,
        };
        env.events().publish(("contribution_amount_changed",), event);

    pub fn emit_group_paused(env: &Env, group_id: u64, paused_by: Address, paused_at: u64) {
        let event = GroupPaused {

    pub fn emit_penalty_applied(
        env: &Env,
        group_id: u64,
        member: Address,
        amount: i128,
        cycle_id: u32,
    ) {
        let event = PenaltyApplied {

            group_id,
            member,
            amount,
            cycle_id,
            applied_at: env.ledger().timestamp(),
        };
        env.events().publish(("penalty_applied",), event);
    }

    pub fn emit_penalty_recovered(
        env: &Env,
        group_id: u64,
        member: Address,
        cycle_id: u32,
    ) {
        let event = PenaltyRecovered {
            group_id,
            member,
            cycle_id,
            recovered_at: env.ledger().timestamp(),
        };

        env.events().publish(("group_unpaused",), event);


        env.events().publish(("penalty_recovered",), event);

    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Address, Env};

    #[test]
    fn test_group_created_event() {
        let env = Env::default();
        let creator = Address::generate(&env);

        let event = GroupCreated {
            group_id: 1,
            creator: creator.clone(),
            contribution_amount: 10_000_000,
            cycle_duration: 604800,
            max_members: 5,
            created_at: 1234567890,
        };

        assert_eq!(event.group_id, 1);
        assert_eq!(event.creator, creator);
    }

    #[test]
    fn test_member_joined_event() {
        let env = Env::default();
        let member = Address::generate(&env);

        let event = MemberJoined {
            group_id: 1,
            member: member.clone(),
            member_count: 3,
            joined_at: 1234567890,
        };

        assert_eq!(event.group_id, 1);
        assert_eq!(event.member, member);
    }

    #[test]
    fn test_event_emitter_group_created() {
        let env = Env::default();
        let creator = Address::generate(&env);

        EventEmitter::emit_group_created(&env, 1, creator, 10_000_000, 604800, 5, 1234567890);
    }

    #[test]
    fn test_contribution_made_event() {
        let env = Env::default();
        let contributor = Address::generate(&env);

        let event = ContributionMade {
            group_id: 1,
            contributor: contributor.clone(),
            amount: 10_000_000,
            cycle: 1,
            cycle_total: 50_000_000,
            contributed_at: 1234567890,
        };

        assert_eq!(event.group_id, 1);
        assert_eq!(event.amount, 10_000_000);
        assert_eq!(event.cycle, 1);
    }

    #[test]
    fn test_payout_executed_event() {
        let env = Env::default();
        let recipient = Address::generate(&env);

        let event = PayoutExecuted {
            group_id: 1,
            recipient: recipient.clone(),
            amount: 50_000_000,
            cycle: 1,
            executed_at: 1234567890,
        };

        assert_eq!(event.group_id, 1);
        assert_eq!(event.amount, 50_000_000);
        assert_eq!(event.cycle, 1);
    }

    #[test]
    fn test_group_completed_event() {
        let env = Env::default();
        let creator = Address::generate(&env);

        let event = GroupCompleted {
            group_id: 1,
            creator: creator.clone(),
            total_cycles: 5,
            total_distributed: 250_000_000,
            completed_at: 1234567890,
        };

        assert_eq!(event.group_id, 1);
        assert_eq!(event.total_cycles, 5);
        assert_eq!(event.total_distributed, 250_000_000);
    }

    #[test]
    fn test_group_status_changed_event() {
        let env = Env::default();
        let admin = Address::generate(&env);

        let event = GroupStatusChanged {
            group_id: 1,
            old_status: 0,
            new_status: 1,
            changed_by: admin.clone(),
            changed_at: 1234567890,
        };

        assert_eq!(event.group_id, 1);
        assert_eq!(event.old_status, 0);
        assert_eq!(event.new_status, 1);
    }

    #[test]
    fn test_member_left_event() {
        let env = Env::default();
        let member = Address::generate(&env);

        let event = MemberLeft {
            group_id: 1,
            member: member.clone(),
            member_count: 2,
            left_at: 1234567890,
        };

        assert_eq!(event.group_id, 1);
        assert_eq!(event.member_count, 2);
    }

    #[test]
    fn test_contract_paused_event() {
        let env = Env::default();
        let admin = Address::generate(&env);

        let event = ContractPaused {
            admin: admin.clone(),
            timestamp: 1234567890,
        };

        assert_eq!(event.timestamp, 1234567890);
    }

    #[test]
    fn test_contract_unpaused_event() {
        let env = Env::default();
        let admin = Address::generate(&env);

        let event = ContractUnpaused {
            admin: admin.clone(),
            timestamp: 1234567890,
        };

        assert_eq!(event.timestamp, 1234567890);
    }

    #[test]
    fn test_event_emitter_member_joined() {
        let env = Env::default();
        let member = Address::generate(&env);

        EventEmitter::emit_member_joined(&env, 1, member, 3, 1234567890);
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
    fn test_event_emitter_member_left() {
        let env = Env::default();
        let member = Address::generate(&env);

        EventEmitter::emit_member_left(&env, 1, member, 2, 1234567890);
    }

    #[test]
    fn test_group_paused_event() {
        let env = Env::default();
        let creator = Address::generate(&env);

        let event = GroupPaused {
            group_id: 1,
            paused_by: creator.clone(),
            paused_at: 1234567890,
        };

        assert_eq!(event.group_id, 1);
        assert_eq!(event.paused_by, creator);
        assert_eq!(event.paused_at, 1234567890);
    }

    #[test]
    fn test_group_unpaused_event() {
        let env = Env::default();
        let creator = Address::generate(&env);

        let event = GroupUnpaused {
            group_id: 1,
            unpaused_by: creator.clone(),
            unpaused_at: 1234567890,
        };

        assert_eq!(event.group_id, 1);
        assert_eq!(event.unpaused_by, creator);
        assert_eq!(event.unpaused_at, 1234567890);
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
}
