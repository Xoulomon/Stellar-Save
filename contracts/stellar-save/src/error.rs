<<<<<<< HEAD
/// Re-export from errors module for backward compatibility.
/// This module is maintained for compatibility with existing code.
/// New code should import directly from the errors module.
pub use crate::errors::{ContractError as StellarSaveError, ContractResult, ErrorCategory, ErrorRecoveryStrategy};
=======
use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, PartialEq)]
#[repr(u32)]
pub enum Error {
    GroupNotFound = 1,
    GroupFull = 2,
    AlreadyMember = 3,
    NotMember = 4,
    AlreadyContributed = 5,
    CyclePending = 6,
    GroupComplete = 7,
    TransferFailed = 8,
    InvalidConfig = 9,
}
>>>>>>> 46b7416 (feat: implement bug bounty program and vulnerability disclosure)
