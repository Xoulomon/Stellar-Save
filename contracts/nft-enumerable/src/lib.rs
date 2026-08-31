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
