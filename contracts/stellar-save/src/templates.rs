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

    // ─── list_templates ───────────────────────────────────────────────────────

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

    /// Every template must have non-empty name and description strings, a
    /// positive cycle_duration, and max_members >= 2.
    #[test]
    fn test_all_templates_have_valid_defaults() {
        let env = Env::default();
        for t in list_templates(&env).iter() {
            assert!(t.cycle_duration > 0, "template {} has zero cycle_duration", t.id);
            assert!(t.max_members >= 2, "template {} has max_members < 2", t.id);
            assert!(!t.name.is_empty(), "template {} has empty name", t.id);
            assert!(!t.description.is_empty(), "template {} has empty description", t.id);
        }
    }

    /// Confirm that the five known constant IDs correspond exactly to the five
    /// returned templates — no extras, no gaps.
    #[test]
    fn test_template_ids_match_known_constants() {
        let env = Env::default();
        let templates = list_templates(&env);
        let ids: std::collections::HashSet<u32> = templates.iter().map(|t| t.id).collect();
        let expected: std::collections::HashSet<u32> = [
            TEMPLATE_WEEKLY_SAVER,
            TEMPLATE_BIWEEKLY_SAVER,
            TEMPLATE_MONTHLY_POOL,
            TEMPLATE_QUARTERLY_CIRCLE,
            TEMPLATE_ANNUAL_POOL,
        ]
        .into();
        assert_eq!(ids, expected);
    }

    // ─── get_template — default value verification ────────────────────────────

    #[test]
    fn test_get_template_found() {
        let env = Env::default();
        let t = get_template(&env, TEMPLATE_MONTHLY_POOL).unwrap();
        assert_eq!(t.id, TEMPLATE_MONTHLY_POOL);
        assert_eq!(t.cycle_duration, 2_592_000);
        assert_eq!(t.max_members, 12);
    }

    /// Weekly Saver defaults: 7-day cycle, 10 members.
    #[test]
    fn test_get_template_weekly_defaults() {
        let env = Env::default();
        let t = get_template(&env, TEMPLATE_WEEKLY_SAVER).unwrap();
        assert_eq!(t.cycle_duration, 604_800,  "Weekly Saver: cycle_duration must be 7 days");
        assert_eq!(t.max_members,   10,         "Weekly Saver: max_members must be 10");
    }

    /// Biweekly Saver defaults: 14-day cycle, 8 members.
    #[test]
    fn test_get_template_biweekly_defaults() {
        let env = Env::default();
        let t = get_template(&env, TEMPLATE_BIWEEKLY_SAVER).unwrap();
        assert_eq!(t.cycle_duration, 1_209_600, "Biweekly Saver: cycle_duration must be 14 days");
        assert_eq!(t.max_members,   8,          "Biweekly Saver: max_members must be 8");
    }

    /// Monthly Pool defaults: 30-day cycle, 12 members.
    #[test]
    fn test_get_template_monthly_defaults() {
        let env = Env::default();
        let t = get_template(&env, TEMPLATE_MONTHLY_POOL).unwrap();
        assert_eq!(t.cycle_duration, 2_592_000, "Monthly Pool: cycle_duration must be 30 days");
        assert_eq!(t.max_members,   12,         "Monthly Pool: max_members must be 12");
    }

    /// Quarterly Circle defaults: 90-day cycle, 4 members.
    #[test]
    fn test_get_template_quarterly_defaults() {
        let env = Env::default();
        let t = get_template(&env, TEMPLATE_QUARTERLY_CIRCLE).unwrap();
        assert_eq!(t.cycle_duration, 7_776_000, "Quarterly Circle: cycle_duration must be 90 days");
        assert_eq!(t.max_members,   4,          "Quarterly Circle: max_members must be 4");
    }

    /// Annual Pool defaults: 365-day cycle, 5 members.
    #[test]
    fn test_get_template_annual_defaults() {
        let env = Env::default();
        let t = get_template(&env, TEMPLATE_ANNUAL_POOL).unwrap();
        assert_eq!(t.cycle_duration, 31_536_000, "Annual Pool: cycle_duration must be 365 days");
        assert_eq!(t.max_members,   5,           "Annual Pool: max_members must be 5");
    }

    // ─── get_template — invalid rejection ────────────────────────────────────

    #[test]
    fn test_get_template_not_found() {
        let env = Env::default();
        let result = get_template(&env, 999);
        assert_eq!(result, Err(StellarSaveError::TemplateNotFound));
    }

    #[test]
    fn test_get_template_id_zero_not_found() {
        let env = Env::default();
        assert_eq!(
            get_template(&env, 0),
            Err(StellarSaveError::TemplateNotFound),
            "Template id 0 does not exist and must return TemplateNotFound"
        );
    }

    #[test]
    fn test_get_template_id_max_u32_not_found() {
        let env = Env::default();
        assert_eq!(get_template(&env, u32::MAX), Err(StellarSaveError::TemplateNotFound));
    }

    // ─── create_group_from_template — default application ────────────────────

    /// cycle_duration and max_members come from the template; contribution_amount
    /// is the caller-supplied override. The template's values must be applied and
    /// the caller's amount must take precedence over any default.
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
        assert_eq!(group.contribution_amount, 10_000_000,  "user-supplied amount must be applied");
        assert_eq!(group.cycle_duration, 604_800,          "template default cycle_duration must be applied");
        assert_eq!(group.max_members, 10,                  "template default max_members must be applied");
        assert!(group.is_active, "new group must start active");
    }

    #[test]
    fn test_create_group_from_template_biweekly() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let group = create_group_from_template(
            &env,
            TEMPLATE_BIWEEKLY_SAVER,
            10,
            creator,
            25_000_000,
            2_000_000,
        )
        .unwrap();

        assert_eq!(group.cycle_duration, 1_209_600, "Biweekly template cycle_duration default applied");
        assert_eq!(group.max_members, 8,            "Biweekly template max_members default applied");
        assert_eq!(group.contribution_amount, 25_000_000, "caller amount is preserved");
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
    fn test_create_group_from_template_annual() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let group = create_group_from_template(
            &env,
            TEMPLATE_ANNUAL_POOL,
            99,
            creator,
            500_000_000,
            0,
        )
        .unwrap();

        assert_eq!(group.cycle_duration, 31_536_000, "Annual Pool cycle_duration default applied");
        assert_eq!(group.max_members, 5,             "Annual Pool max_members default applied");
        assert_eq!(group.contribution_amount, 500_000_000, "caller amount is preserved");
    }

    // ─── override precedence ──────────────────────────────────────────────────

    /// Changing only the contribution_amount across two calls to the *same*
    /// template must produce groups that differ only in amount — cycle_duration
    /// and max_members stay identical (template defaults win for those fields).
    #[test]
    fn test_contribution_amount_overrides_independently_of_template_defaults() {
        let env = Env::default();
        let creator_a = Address::generate(&env);
        let creator_b = Address::generate(&env);

        let group_a = create_group_from_template(
            &env, TEMPLATE_MONTHLY_POOL, 1, creator_a, 10_000_000, 0,
        ).unwrap();

        let group_b = create_group_from_template(
            &env, TEMPLATE_MONTHLY_POOL, 2, creator_b, 99_000_000, 0,
        ).unwrap();

        // Template defaults must be identical
        assert_eq!(group_a.cycle_duration, group_b.cycle_duration,
            "cycle_duration must come from the template and not be affected by amount override");
        assert_eq!(group_a.max_members, group_b.max_members,
            "max_members must come from the template and not be affected by amount override");

        // Only the user-supplied amount should differ
        assert_ne!(group_a.contribution_amount, group_b.contribution_amount,
            "contribution_amounts must reflect the distinct user overrides");
        assert_eq!(group_a.contribution_amount, 10_000_000);
        assert_eq!(group_b.contribution_amount, 99_000_000);
    }

    /// Each template produces a distinct (cycle_duration, max_members) pair;
    /// the same contribution_amount is passed to all of them to isolate the
    /// override of the template's structural defaults.
    #[test]
    fn test_each_template_applies_its_own_structural_defaults() {
        let env = Env::default();
        let amount = 1_000_000_i128;
        let ts = 0_u64;

        let weekly = create_group_from_template(&env, TEMPLATE_WEEKLY_SAVER, 1,
            Address::generate(&env), amount, ts).unwrap();
        let biweekly = create_group_from_template(&env, TEMPLATE_BIWEEKLY_SAVER, 2,
            Address::generate(&env), amount, ts).unwrap();
        let monthly = create_group_from_template(&env, TEMPLATE_MONTHLY_POOL, 3,
            Address::generate(&env), amount, ts).unwrap();
        let quarterly = create_group_from_template(&env, TEMPLATE_QUARTERLY_CIRCLE, 4,
            Address::generate(&env), amount, ts).unwrap();
        let annual = create_group_from_template(&env, TEMPLATE_ANNUAL_POOL, 5,
            Address::generate(&env), amount, ts).unwrap();

        // All amounts are the same (override respected everywhere)
        for g in [&weekly, &biweekly, &monthly, &quarterly, &annual] {
            assert_eq!(g.contribution_amount, amount);
        }

        // Each template applied its own cycle_duration
        assert_eq!(weekly.cycle_duration,    604_800);
        assert_eq!(biweekly.cycle_duration,  1_209_600);
        assert_eq!(monthly.cycle_duration,   2_592_000);
        assert_eq!(quarterly.cycle_duration, 7_776_000);
        assert_eq!(annual.cycle_duration,    31_536_000);

        // Each template applied its own max_members
        assert_eq!(weekly.max_members,    10);
        assert_eq!(biweekly.max_members,  8);
        assert_eq!(monthly.max_members,   12);
        assert_eq!(quarterly.max_members, 4);
        assert_eq!(annual.max_members,    5);
    }

    /// group_id is a caller-supplied override; verify it propagates correctly
    /// and does not interact with template defaults.
    #[test]
    fn test_group_id_is_caller_override_not_a_template_default() {
        let env = Env::default();
        for expected_id in [0u64, 1, 42, u64::MAX / 2] {
            let group = create_group_from_template(
                &env, TEMPLATE_WEEKLY_SAVER, expected_id,
                Address::generate(&env), 1_000_000, 0,
            ).unwrap();
            assert_eq!(group.id, expected_id,
                "group_id {} was not preserved by create_group_from_template", expected_id);
        }
    }

    // ─── invalid / malformed template rejection ───────────────────────────────

    #[test]
    fn test_create_group_invalid_template() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let result = create_group_from_template(&env, 999, 1, creator, 10_000_000, 1_000_000);
        assert_eq!(result, Err(StellarSaveError::TemplateNotFound));
    }

    /// Zero contribution_amount must be rejected before the template lookup.
    #[test]
    fn test_create_group_invalid_amount() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let result =
            create_group_from_template(&env, TEMPLATE_WEEKLY_SAVER, 1, creator, 0, 1_000_000);
        assert_eq!(result, Err(StellarSaveError::InvalidAmount));
    }

    /// Negative contribution_amount must also be rejected (guard fires for any <= 0).
    #[test]
    fn test_create_group_negative_amount_rejected() {
        let env = Env::default();
        let result = create_group_from_template(
            &env, TEMPLATE_MONTHLY_POOL, 1, Address::generate(&env), -1, 0,
        );
        assert_eq!(
            result,
            Err(StellarSaveError::InvalidAmount),
            "Negative contribution_amount must return InvalidAmount"
        );
    }

    /// A non-existent template ID must be rejected even when the amount is valid.
    #[test]
    fn test_invalid_template_id_with_valid_amount_rejected() {
        let env = Env::default();
        let result = create_group_from_template(
            &env, 6, 1, Address::generate(&env), 10_000_000, 0,
        );
        assert_eq!(result, Err(StellarSaveError::TemplateNotFound),
            "Template ID 6 does not exist and must be rejected");
    }

    /// Amount validation runs before template lookup — InvalidAmount should be
    /// returned even when the template ID is also invalid.
    #[test]
    fn test_invalid_amount_checked_before_template_lookup() {
        let env = Env::default();
        // Both amount and template_id are invalid; amount guard fires first.
        let result = create_group_from_template(
            &env, 999, 1, Address::generate(&env), 0, 0,
        );
        assert_eq!(
            result,
            Err(StellarSaveError::InvalidAmount),
            "InvalidAmount guard must fire before TemplateNotFound lookup"
        );
    }

    /// Minimum valid amount (1 stroops) must be accepted.
    #[test]
    fn test_minimum_valid_amount_accepted() {
        let env = Env::default();
        let result = create_group_from_template(
            &env, TEMPLATE_WEEKLY_SAVER, 1, Address::generate(&env), 1, 0,
        );
        assert!(result.is_ok(), "1 stroops is a valid minimum contribution_amount");
    }
}
