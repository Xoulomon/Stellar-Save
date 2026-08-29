#![no_std]
#![allow(dead_code)]

pub mod enumeration;
pub mod token;
mod contract;
pub mod error;

pub use error::Error;
pub use token::{DataKey, ExampleContract};

#[cfg(test)]
mod test;
#[cfg(test)]
mod test_utils;
