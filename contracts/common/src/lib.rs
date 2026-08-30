#![no_std]

//! Shared building blocks for the Stellar-Save Soroban contracts.
//!
//! Every contract in this workspace previously carried its own near-duplicate
//! failure enum. This crate holds the single canonical [`Error`] so a caller can
//! decode a failure the same way regardless of which contract produced it.
//!
//! # Code ranges
//!
//! Canonical codes occupy `1..=99`. Contract-specific enums are free to use any
//! code at or above `100`, which is why `stellar-save`'s domain enum (codes
//! `1000+`) can coexist with this one without collision.

pub mod constants;
pub mod error;

pub use error::{CommonResult, Error, ErrorCategory};
