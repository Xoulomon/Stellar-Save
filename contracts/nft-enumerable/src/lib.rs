#![no_std]
#![allow(dead_code)]

mod contract;
pub mod enumeration;
pub mod error;
pub mod token;

pub use error::Error;
pub use token::{DataKey, ExampleContract};

#[cfg(test)]
mod test;
#[cfg(test)]
mod test_utils;
#[cfg(test)]
mod benchmark_tests;
#[cfg(test)]
mod fuzz_tests;
mod burn_edge_case_tests;
