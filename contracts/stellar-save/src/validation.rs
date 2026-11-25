//! Centralized validation for savings-group parameters.

use crate::constants::{MAX_GROUP_GRACE_PERIOD_SECONDS, MAX_MEMBERS, MIN_GROUP_MEMBERS};
use crate::error::StellarSaveError;
use crate::types::ContractConfig;

pub fn validate_contribution_amount(amount: i128) -> Result<(), StellarSaveError> {
    if amount <= 0 {
        Err(StellarSaveError::InvalidAmount)
    } else {
        Ok(())
    }
}

pub fn validate_cycle_duration(duration: u64) -> Result<(), StellarSaveError> {
    if duration == 0 {
        Err(StellarSaveError::InvalidState)
    } else {
        Ok(())
    }
}

pub fn validate_member_bounds(
    min_members: u32,
    max_members: u32,
) -> Result<(), StellarSaveError> {
    if min_members < MIN_GROUP_MEMBERS
        || max_members < min_members
        || max_members > MAX_MEMBERS
    {
        Err(StellarSaveError::InvalidState)
    } else {
        Ok(())
    }
}

pub fn validate_grace_period(grace_period_seconds: u64) -> Result<(), StellarSaveError> {
    if grace_period_seconds > MAX_GROUP_GRACE_PERIOD_SECONDS {
        Err(StellarSaveError::InvalidState)
    } else {
        Ok(())
    }
}

pub fn validate_group_params(
    contribution_amount: i128,
    cycle_duration: u64,
    min_members: u32,
    max_members: u32,
    grace_period_seconds: u64,
) -> Result<(), StellarSaveError> {
    validate_contribution_amount(contribution_amount)?;
    validate_cycle_duration(cycle_duration)?;
    validate_member_bounds(min_members, max_members)?;
    validate_grace_period(grace_period_seconds)
}

pub fn validate_group_params_with_config(
    contribution_amount: i128,
    cycle_duration: u64,
    max_members: u32,
    grace_period_seconds: u64,
    config: &ContractConfig,
) -> Result<(), StellarSaveError> {
    if contribution_amount < config.min_contribution {
        return Err(StellarSaveError::ContributionTooLow);
    }
    if contribution_amount > config.max_contribution {
        return Err(StellarSaveError::ContributionTooHigh);
    }
    if max_members < config.min_members
        || max_members > config.max_members
        || cycle_duration < config.min_cycle_duration
        || cycle_duration > config.max_cycle_duration
    {
        return Err(StellarSaveError::InvalidState);
    }

    validate_group_params(
        contribution_amount,
        cycle_duration,
        config.min_members,
        max_members,
        grace_period_seconds,
    )
}
