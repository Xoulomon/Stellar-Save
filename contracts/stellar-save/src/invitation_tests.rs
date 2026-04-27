#[cfg(test)]
mod tests {
    use crate::{
        group::{Group, GroupStatus},
        storage::StorageKeyBuilder,
        MemberProfile, StellarSaveContract, StellarSaveError,
    };
    use soroban_sdk::{testutils::Address as _, Address, Env, Vec};

    // ── helpers ───────────────────────────────────────────────────────────────

    fn setup_pending_group(env: &Env, group_id: u64, creator: &Address) {
        let group = Group::new(
            group_id,
            creator.clone(),
            100,
            3600,
            5,
            2,
            env.ledger().timestamp(),
            0,
        );
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);
        env.storage().persistent().set(
            &StorageKeyBuilder::group_status(group_id),
            &GroupStatus::Pending,
        );
    }

    fn setup_invitation_only_group(env: &Env, group_id: u64, creator: &Address) {
        let mut group = Group::new(
            group_id,
            creator.clone(),
            100,
            3600,
            5,
            2,
            env.ledger().timestamp(),
            0,
        );
        group.invitation_only = true;
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_data(group_id), &group);
        env.storage().persistent().set(
            &StorageKeyBuilder::group_status(group_id),
            &GroupStatus::Pending,
        );
    }

    // ── set_invitation_only ───────────────────────────────────────────────────

    #[test]
    fn test_set_invitation_only_enables_flag() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = crate::StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        setup_pending_group(&env, 1, &creator);

        client.set_invitation_only(&1u64, &true);

        let group = client.get_group(&1u64);
        assert!(group.invitation_only);
    }

    #[test]
    fn test_set_invitation_only_disables_flag() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = crate::StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        setup_invitation_only_group(&env, 1, &creator);

        client.set_invitation_only(&1u64, &false);

        let group = client.get_group(&1u64);
        assert!(!group.invitation_only);
    }

    #[test]
    fn test_set_invitation_only_fails_when_active() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = crate::StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        setup_pending_group(&env, 1, &creator);
        // Force Active
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_status(1), &GroupStatus::Active);

        let result = client.try_set_invitation_only(&1u64, &true);
        assert_eq!(result, Err(Ok(StellarSaveError::InvalidState)));
    }

    // ── invite_member ─────────────────────────────────────────────────────────

    #[test]
    fn test_invite_member_success() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = crate::StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let invitee = Address::generate(&env);
        setup_invitation_only_group(&env, 1, &creator);

        client.invite_member(&1u64, &invitee);

        let invitations: Vec<Address> = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_invitations(1))
            .unwrap();
        assert!(invitations.contains(&invitee));
    }

    #[test]
    fn test_invite_member_idempotent() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = crate::StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let invitee = Address::generate(&env);
        setup_invitation_only_group(&env, 1, &creator);

        client.invite_member(&1u64, &invitee);
        client.invite_member(&1u64, &invitee); // second call — no duplicate

        let invitations: Vec<Address> = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_invitations(1))
            .unwrap();
        assert_eq!(invitations.len(), 1);
    }

    #[test]
    fn test_invite_member_group_not_found() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = crate::StellarSaveContractClient::new(&env, &contract_id);

        let invitee = Address::generate(&env);
        let result = client.try_invite_member(&999u64, &invitee);
        assert_eq!(result, Err(Ok(StellarSaveError::GroupNotFound)));
    }

    #[test]
    fn test_invite_member_fails_when_active() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = crate::StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let invitee = Address::generate(&env);
        setup_invitation_only_group(&env, 1, &creator);
        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_status(1), &GroupStatus::Active);

        let result = client.try_invite_member(&1u64, &invitee);
        assert_eq!(result, Err(Ok(StellarSaveError::InvalidState)));
    }

    #[test]
    fn test_invite_member_fails_if_already_member() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = crate::StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let invitee = Address::generate(&env);
        setup_invitation_only_group(&env, 1, &creator);

        // Manually add invitee as a member
        let profile = MemberProfile {
            address: invitee.clone(),
            group_id: 1,
            payout_position: 0,
            joined_at: 0,
            auto_contribute_enabled: false,
        };
        env.storage().persistent().set(
            &StorageKeyBuilder::member_profile(1, invitee.clone()),
            &profile,
        );

        let result = client.try_invite_member(&1u64, &invitee);
        assert_eq!(result, Err(Ok(StellarSaveError::AlreadyMember)));
    }

    // ── revoke_invitation ─────────────────────────────────────────────────────

    #[test]
    fn test_revoke_invitation_success() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = crate::StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let invitee = Address::generate(&env);
        setup_invitation_only_group(&env, 1, &creator);

        client.invite_member(&1u64, &invitee);
        client.revoke_invitation(&1u64, &invitee);

        let invitations: Vec<Address> = env
            .storage()
            .persistent()
            .get(&StorageKeyBuilder::group_invitations(1))
            .unwrap_or(Vec::new(&env));
        assert!(!invitations.contains(&invitee));
    }

    #[test]
    fn test_revoke_invitation_not_invited() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = crate::StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let invitee = Address::generate(&env);
        setup_invitation_only_group(&env, 1, &creator);

        let result = client.try_revoke_invitation(&1u64, &invitee);
        assert_eq!(result, Err(Ok(StellarSaveError::NotInvited)));
    }

    #[test]
    fn test_revoke_invitation_group_not_found() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = crate::StellarSaveContractClient::new(&env, &contract_id);

        let invitee = Address::generate(&env);
        let result = client.try_revoke_invitation(&999u64, &invitee);
        assert_eq!(result, Err(Ok(StellarSaveError::GroupNotFound)));
    }

    #[test]
    fn test_revoke_invitation_fails_when_active() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = crate::StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let invitee = Address::generate(&env);
        setup_invitation_only_group(&env, 1, &creator);
        client.invite_member(&1u64, &invitee);

        env.storage()
            .persistent()
            .set(&StorageKeyBuilder::group_status(1), &GroupStatus::Active);

        let result = client.try_revoke_invitation(&1u64, &invitee);
        assert_eq!(result, Err(Ok(StellarSaveError::InvalidState)));
    }

    // ── join_group invitation checks ──────────────────────────────────────────

    #[test]
    fn test_join_group_invited_member_succeeds() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = crate::StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let invitee = Address::generate(&env);
        setup_invitation_only_group(&env, 1, &creator);
        client.invite_member(&1u64, &invitee);

        client.join_group(&1u64, &invitee);

        assert!(client.is_member(&1u64, &invitee).unwrap());
    }

    #[test]
    fn test_join_group_uninvited_member_fails() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = crate::StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let outsider = Address::generate(&env);
        setup_invitation_only_group(&env, 1, &creator);

        let result = client.try_join_group(&1u64, &outsider);
        assert_eq!(result, Err(Ok(StellarSaveError::NotInvited)));
    }

    #[test]
    fn test_join_group_open_group_no_invitation_needed() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = crate::StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let member = Address::generate(&env);
        setup_pending_group(&env, 1, &creator); // invitation_only = false

        client.join_group(&1u64, &member);

        assert!(client.is_member(&1u64, &member).unwrap());
    }

    #[test]
    fn test_join_group_after_revocation_fails() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = crate::StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let invitee = Address::generate(&env);
        setup_invitation_only_group(&env, 1, &creator);

        client.invite_member(&1u64, &invitee);
        client.revoke_invitation(&1u64, &invitee);

        let result = client.try_join_group(&1u64, &invitee);
        assert_eq!(result, Err(Ok(StellarSaveError::NotInvited)));
    }

    // ── event emission ────────────────────────────────────────────────────────

    #[test]
    fn test_invite_member_emits_event() {
        use soroban_sdk::testutils::Events;

        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = crate::StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let invitee = Address::generate(&env);
        setup_invitation_only_group(&env, 1, &creator);

        client.invite_member(&1u64, &invitee);

        let all_events = env.events().all();
        let mut found = false;
        for i in 0..all_events.len() {
            let (_, topics, _) = all_events.get(i).unwrap();
            if topics.len() == 1 {
                found = true;
                break;
            }
        }
        assert!(found, "expected MemberInvited event");
    }

    #[test]
    fn test_revoke_invitation_emits_event() {
        use soroban_sdk::testutils::Events;

        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(StellarSaveContract, ());
        let client = crate::StellarSaveContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let invitee = Address::generate(&env);
        setup_invitation_only_group(&env, 1, &creator);

        client.invite_member(&1u64, &invitee);
        let events_before = env.events().all().len();

        client.revoke_invitation(&1u64, &invitee);

        let all_events = env.events().all();
        assert!(
            all_events.len() > events_before,
            "expected InvitationRevoked event"
        );
    }
}
