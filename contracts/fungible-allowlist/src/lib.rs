#![no_std]
#![allow(dead_code)]

mod contract;
pub mod error;

pub use contract::{require_admin, require_allowlisted, ExampleContract};
pub use error::Error;

#[cfg(test)]
mod test;
#[cfg(test)]
mod test_utils;
