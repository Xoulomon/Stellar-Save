#![no_std]
#![allow(dead_code)]

mod contract;
pub mod error;
pub mod policy;

pub use contract::ExampleContract;
pub use error::Error;
pub use policy::{require_admin, require_allowlisted};

#[cfg(test)]
mod test;
#[cfg(test)]
mod test_utils;
#[cfg(test)]
mod benchmark_tests;
