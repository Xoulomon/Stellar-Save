// This file is intentionally empty.
//
// The events module root is `src/events.rs`, which uses `#[path]` attributes
// to include the domain sub-modules from this directory:
//
//   #[path = "events/group.rs"]        pub mod group;
//   #[path = "events/contribution.rs"] pub mod contribution;
//   #[path = "events/payout.rs"]       pub mod payout;
//   #[path = "events/admin.rs"]        pub mod admin;
//
// Rust resolves `pub mod events;` in lib.rs to `src/events.rs` (not this file)
// because both `src/events.rs` and `src/events/mod.rs` cannot coexist — the
// flat file takes precedence via the explicit `#[path]` declarations.
//
// This file exists only to keep the directory visible in version control.
// It must not contain any Rust code.
