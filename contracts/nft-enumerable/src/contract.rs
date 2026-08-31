//! Contract entry point and re-exports for backwards compatibility and test snapshots.

#[cfg(test)]
pub use crate::token::ExampleContractClient;
pub use crate::token::{DataKey, ExampleContract};
