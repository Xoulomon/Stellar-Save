//! Contract entry point and re-exports for backwards compatibility and test snapshots.

pub use crate::token::{DataKey, ExampleContract};
#[cfg(test)]
pub use crate::token::ExampleContractClient;

