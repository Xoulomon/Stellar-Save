# Stellar-Save Build Guide

## Quick Start

### Build the stellar-save contract
```bash
cargo build --manifest-path Stellar-Save/contracts/stellar-save/Cargo.toml
```

### Run all tests
```bash
cargo test --lib --manifest-path Stellar-Save/contracts/stellar-save/Cargo.toml
```

### Run pool module tests only
```bash
cargo test --lib pool --manifest-path Stellar-Save/contracts/stellar-save/Cargo.toml
```

### Build for WASM (Soroban)
```bash
cargo build --target wasm32-unknown-unknown --manifest-path Stellar-Save/contracts/stellar-save/Cargo.toml
```

**Note:** Use the full path to `contracts/stellar-save/Cargo.toml` to avoid dependency resolution issues with other contracts in the workspace.

---

## Workspace Structure

The workspace has been configured to focus on the stellar-save contract:

```
Stellar-Save/
├── Cargo.toml                    # Workspace config (stellar-save only)
├── contracts/
│   ├── stellar-save/             # Main contract (ACTIVE)
│   ├── guess-the-number/         # Other contracts (excluded)
│   ├── fungible-allowlist/       # Other contracts (excluded)
│   └── nft-enumerable/           # Other contracts (excluded)
└── ...
```

**Note:** The other contracts are excluded from the workspace to avoid dependency conflicts with newer Rust features.

---

## Build Commands

### Development Build
```bash
cargo build --manifest-path Stellar-Save/contracts/stellar-save/Cargo.toml
```
- Unoptimized, includes debug info
- Faster compilation
- Larger binary

### Release Build
```bash
cargo build --release --manifest-path Stellar-Save/contracts/stellar-save/Cargo.toml
```
- Optimized for size and performance
- Slower compilation
- Smaller binary (suitable for Soroban)

### WASM Build (for Soroban deployment)
```bash
cargo build --target wasm32-unknown-unknown --manifest-path Stellar-Save/contracts/stellar-save/Cargo.toml
```
- Compiles to WebAssembly
- Required for Soroban deployment
- Output: `target/wasm32-unknown-unknown/debug/stellar_save.wasm`

---

## Testing

### Run all tests
```bash
cargo test --lib --manifest-path Stellar-Save/contracts/stellar-save/Cargo.toml
```

### Run pool module tests
```bash
cargo test --lib pool --manifest-path Stellar-Save/contracts/stellar-save/Cargo.toml
```

### Run specific test
```bash
cargo test --lib pool::tests::test_calculate_total_pool_valid --manifest-path Stellar-Save/contracts/stellar-save/Cargo.toml
```

### Run tests with output
```bash
cargo test --lib -- --nocapture --manifest-path Stellar-Save/contracts/stellar-save/Cargo.toml
```

---

## Troubleshooting

### Issue: "feature `edition2024` is required"
**Solution:** Use the manifest path to build only stellar-save:
```bash
cargo build --manifest-path Stellar-Save/Cargo.toml
```

### Issue: "cannot find module"
**Solution:** Make sure you're in the workspace root or use the manifest path.

### Issue: Tests not running
**Solution:** Use the `--lib` flag to run library tests:
```bash
cargo test --lib --manifest-path Stellar-Save/Cargo.toml
```

---

## Project Structure

```
Stellar-Save/contracts/stellar-save/src/
├── lib.rs                 # Main contract entry point
├── pool.rs               # Pool calculation module (NEW)
├── storage.rs            # Storage key management
├── group.rs              # Group data structures
├── contribution.rs       # Contribution tracking
├── payout.rs             # Payout records
├── status.rs             # Group status state machine
├── error.rs              # Error types
└── events.rs             # Event emission
```

---

## Documentation

- **POOL_CALCULATION.md** - Complete pool module documentation
- **POOL_QUICK_REFERENCE.md** - Quick reference guide
- **POOL_ARCHITECTURE.md** - Architecture and design
- **IMPLEMENTATION_SUMMARY.md** - Implementation details

---

## Useful Commands

### Check for compilation errors
```bash
cargo check --manifest-path Stellar-Save/contracts/stellar-save/Cargo.toml
```

### Format code
```bash
cargo fmt --manifest-path Stellar-Save/contracts/stellar-save/Cargo.toml
```

### Lint code
```bash
cargo clippy --manifest-path Stellar-Save/contracts/stellar-save/Cargo.toml
```

### Generate documentation
```bash
cargo doc --manifest-path Stellar-Save/contracts/stellar-save/Cargo.toml --open
```

---

## Environment Requirements

- Rust 1.81.0 or later
- Cargo 1.81.0 or later
- For WASM: `wasm32-unknown-unknown` target

### Install WASM target
```bash
rustup target add wasm32-unknown-unknown
```

---

## CI/CD Integration

For continuous integration, use:
```bash
cargo build --manifest-path Stellar-Save/contracts/stellar-save/Cargo.toml
cargo test --lib --manifest-path Stellar-Save/contracts/stellar-save/Cargo.toml
```

---

## Performance Tips

1. **Use release builds for deployment:**
   ```bash
   cargo build --release --manifest-path Stellar-Save/contracts/stellar-save/Cargo.toml
   ```

2. **Use incremental compilation:**
   ```bash
   CARGO_INCREMENTAL=1 cargo build --manifest-path Stellar-Save/contracts/stellar-save/Cargo.toml
   ```

3. **Parallel compilation:**
   ```bash
   cargo build -j 4 --manifest-path Stellar-Save/contracts/stellar-save/Cargo.toml
   ```

---

## Next Steps

1. Build the contract: `cargo build --manifest-path Stellar-Save/Cargo.toml`
2. Run tests: `cargo test --lib --manifest-path Stellar-Save/Cargo.toml`
3. Review documentation: See `POOL_CALCULATION.md`
4. Deploy to Soroban: Use WASM build output

---

**Last Updated:** February 21, 2026  
**Status:** Ready for Development ✅
