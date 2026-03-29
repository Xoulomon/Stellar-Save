# Stellar Horizon API Service Implementation Plan

## Completed Steps
- [x] Analyzed project structure and confirmed new `client/` Rust crate needed
- [x] Created TODO.md with breakdown


   - Integrate as workspace member

2. **Update root `Cargo.toml`**
   - Add `client` to workspace members

3. **Implement `client/src/lib.rs`**
   - HorizonService struct
   - get_account(), get_balances(), get_transactions()
   - Error handling with HorizonError
   - JSON deserialization types

4. **Add example usage and tests**

5. **Verify build**
   - `cargo check`
   - `cargo build --package client`

6. **Documentation**
   - README in `client/`
   - Export doc tests

**Current Step: Create client/Cargo.toml**

