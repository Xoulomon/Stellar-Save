use soroban_sdk::{contracttype, vec, Env, String, Vec};

use crate::error::{ContractResult, StellarSaveError};
use crate::group::Group;

/// Template IDs for predefined group configurations.
pub const TEMPLATE_WEEKLY_SAVER: u32 = 1;
pub const TEMPLATE_MONTHLY_POOL: u32 = 2;
pub const TEMPLATE_QUARTERLY_CIRCLE: u32 = 3;
pub const TEMPLATE_BIWEEKLY_SAVER: u32 = 4;
pub const TEMPLATE_ANNUAL_POOL: u32 = 5;

/// A predefined group configuration template.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GroupTemplate {
    pub id: u32,
    pub name: String,
    pub cycle_duration: u64,
    pub max_members: u32,
    pub description: String,
}

/// Returns all available predefined templates.
pub fn list_templates(env: &Env) -> Vec<GroupTemplate> {
    vec![
        env,
        GroupTemplate {
            id: TEMPLATE_WEEKLY_SAVER,
            name: String::from_str(env, "Weekly Saver"),
            cycle_duration: 604_800,   // 7 days
            max_members: 10,
            description: String::from_str(env, "Weekly contributions, 10 members, 10-week cycle"),
        },
        GroupTemplate {
            id: TEMPLATE_BIWEEKLY_SAVER,
            name: String::from_str(env, "Biweekly Saver"),
            cycle_duration: 1_209_600, // 14 days
            max_members: 8,
            description: String::from_str(env, "Biweekly contributions, 8 members, 16-week cycle"),
        },
        GroupTemplate {
            id: TEMPLATE_MONTHLY_POOL,
            name: String::from_str(env, "Monthly Pool"),
            cycle_duration: 2_592_000, // 30 days
            max_members: 12,
            description: String::from_str(env, "Monthly contributions, 12 members, 1-year cycle"),
        },
        GroupTemplate {
            id: TEMPLATE_QUARTERLY_CIRCLE,
            name: String::from_str(env, "Quarterly Circle"),
            cycle_duration: 7_776_000, // 90 days
            max_members: 4,
            description: String::from_str(env, "Quarterly contributions, 4 members, 1-year cycle"),
        },
        GroupTemplate {
            id: TEMPLATE_ANNUAL_POOL,
            name: String::from_str(env, "Annual Pool"),
            cycle_duration: 31_536_000, // 365 days
            max_members: 5,
            description: String::from_str(env, "Annual contributions, 5 members, 5-year cycle"),
        },
    ]
}

/// Returns a single template by ID, or an error if not found.
pub fn get_template(env: &Env, template_id: u32) -> ContractResult<GroupTemplate> {
    list_templates(env)
        .iter()
        .find(|t| t.id == template_id)
        .ok_or(StellarSaveError::TemplateNotFound)
}

/// Creates a Group from a predefined template.
///
/// # Arguments
/// * `env` - The contract environment
/// * `template_id` - ID of the predefined template to use
/// * `group_id` - Unique ID for the new group
/// * `creator` - Address of the group creator
/// * `contribution_amount` - Amount each member contributes per cycle (in stroops)
/// * `created_at` - Creation timestamp
pub fn create_group_from_template(
    env: &Env,
    template_id: u32,
    group_id: u64,
    creator: soroban_sdk::Address,
    contribution_amount: i128,
    created_at: u64,
) -> ContractResult<Group> {
    if contribution_amount <= 0 {
        return Err(StellarSaveError::InvalidAmount);
    }
    let template = get_template(env, template_id)?;
    Ok(Group::new(
        group_id,
        creator,
        contribution_amount,
        template.cycle_duration,
        template.max_members,
        2, // min_members: sensible default for all templates
        created_at,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Address, Env};

    #[test]
    fn test_list_templates_returns_five() {
        let env = Env::default();
        assert_eq!(list_templates(&env).len(), 5);
    }

    #[test]
    fn test_all_template_ids_unique() {
        let env = Env::default();
        let templates = list_templates(&env);
        let mut ids: soroban_sdk::Vec<u32> = soroban_sdk::vec![&env];
        for t in templates.iter() {
            assert!(!ids.contains(&t.id), "Duplicate template id {}", t.id);
            ids.push_back(t.id);
        }
    }

    #[test]
    fn test_get_template_found() {
        let env = Env::default();
        let t = get_template(&env, TEMPLATE_MONTHLY_POOL).unwrap();
        assert_eq!(t.id, TEMPLATE_MONTHLY_POOL);
        assert_eq!(t.cycle_duration, 2_592_000);
        assert_eq!(t.max_members, 12);
    }

    #[test]
    fn test_get_template_not_found() {
        let env = Env::default();
        let result = get_template(&env, 999);
        assert_eq!(result, Err(StellarSaveError::TemplateNotFound));
    }

    #[test]
    fn test_create_group_from_template_weekly() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let group = create_group_from_template(
            &env,
            TEMPLATE_WEEKLY_SAVER,
            1,
            creator.clone(),
            10_000_000,
            1_000_000,
        )
        .unwrap();

        assert_eq!(group.id, 1);
        assert_eq!(group.creator, creator);
        assert_eq!(group.contribution_amount, 10_000_000);
        assert_eq!(group.cycle_duration, 604_800);
        assert_eq!(group.max_members, 10);
        assert!(group.is_active);
    }

    #[test]
    fn test_create_group_from_template_monthly() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let group = create_group_from_template(
            &env,
            TEMPLATE_MONTHLY_POOL,
            2,
            creator,
            50_000_000,
            1_000_000,
        )
        .unwrap();

        assert_eq!(group.cycle_duration, 2_592_000);
        assert_eq!(group.max_members, 12);
    }

    #[test]
    fn test_create_group_from_template_quarterly() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let group = create_group_from_template(
            &env,
            TEMPLATE_QUARTERLY_CIRCLE,
            3,
            creator,
            100_000_000,
            1_000_000,
        )
        .unwrap();

        assert_eq!(group.cycle_duration, 7_776_000);
        assert_eq!(group.max_members, 4);
    }

    #[test]
    fn test_create_group_invalid_template() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let result = create_group_from_template(&env, 999, 1, creator, 10_000_000, 1_000_000);
        assert_eq!(result, Err(StellarSaveError::TemplateNotFound));
    }

    #[test]
    fn test_create_group_invalid_amount() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let result =
            create_group_from_template(&env, TEMPLATE_WEEKLY_SAVER, 1, creator, 0, 1_000_000);
        assert_eq!(result, Err(StellarSaveError::InvalidAmount));
    }
}
