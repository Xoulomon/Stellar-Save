//! Non-Fungible Enumerable Extension Module.
//!
//! Handles enumeration bookkeeping, total supply tracking,
//! and querying token IDs by owner or global index.

use crate::token::ExampleContract;
use soroban_sdk::contractimpl;
use stellar_tokens::non_fungible::enumerable::NonFungibleEnumerable;

#[contractimpl(contracttrait)]
impl NonFungibleEnumerable for ExampleContract {}
