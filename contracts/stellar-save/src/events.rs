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

/// Utility functions for emitting events.
pub struct EventEmitter;

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
        
        EventEmitter::emit_group_created(
            &env,
            1,
            creator,
            10_000_000,
            604800,
            5,
            1234567890,
        );
    }
}