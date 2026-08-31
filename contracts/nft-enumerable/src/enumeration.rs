//! Non-Fungible Enumerable Extension Module.
//!
//! Handles enumeration bookkeeping, total supply tracking,
//! and querying token IDs by owner or global index.

use soroban_sdk::contractimpl;
use stellar_tokens::non_fungible::enumerable::NonFungibleEnumerable;
use crate::token::ExampleContract;

#[contractimpl(contracttrait)]
impl NonFungibleEnumerable for ExampleContract {}
