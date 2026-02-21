use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    /// Group does not exist
    GroupNotFound = 1,
    /// Group is not active
    GroupNotActive = 2,
    /// Group is already completed
    GroupCompleted = 3,
    /// Invalid group status
    InvalidGroupStatus = 4,
    /// Member count exceeds maximum
    MemberCountExceeded = 5,
    /// Unauthorized access
    Unauthorized = 6,
    /// The contract failed to transfer XLM to the recipient
    FailedToTransferToRecipient = 7,
    /// The member failed to transfer XLM to the contract
    FailedToTransferFromMember = 8,
    /// The contract has no balance to transfer
    NoBalanceToTransfer = 9,
}
