//! Concrete migration implementations.
//!
//! Each sub-module handles one version transition and exposes two functions:
//! - `apply(env)` — forward migration
//! - `rollback(env)` — reverse migration (where reversible)

pub mod v1_to_v2;
