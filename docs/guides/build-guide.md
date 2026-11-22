# Stellar-Save Build Guide

> **First time?** See [docs/guides/getting-started.md](docs/guides/getting-started.md) for full environment setup (Node, pnpm, Rust, Docker, Stellar CLI).

## Quick Start

### Build the stellar-save contract
```bash
cargo build --manifest-path contracts/stellar-save/Cargo.toml
```

### Run all tests
```bash
cargo test --lib --manifest-path contracts/stellar-save/Cargo.toml
```

### Run pool module tests only
```bash
cargo test --lib pool --manifest-path contracts/stellar-save/Cargo.toml
```

### Build for WASM (Soroban)
```bash
cargo build --target wasm32-unknown-unknown --manifest-path contracts/stellar-save/Cargo.toml
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
cargo build --manifest-path contracts/stellar-save/Cargo.toml
```
- Unoptimized, includes debug info
- Faster compilation
- Larger binary

### Release Build
```bash
cargo build --release --manifest-path contracts/stellar-save/Cargo.toml
```
- Optimized for size and performance
- Slower compilation
- Smaller binary (suitable for Soroban)

### WASM Build (for Soroban deployment)
```bash
cargo build --target wasm32-unknown-unknown --manifest-path contracts/stellar-save/Cargo.toml
```
- Compiles to WebAssembly
- Required for Soroban deployment
- Output: `target/wasm32-unknown-unknown/debug/stellar_save.wasm`

---

## Testing

### Run all tests
```bash
cargo test --lib --manifest-path contracts/stellar-save/Cargo.toml
```

### Run pool module tests
```bash
cargo test --lib pool --manifest-path contracts/stellar-save/Cargo.toml
```

### Run specific test
```bash
cargo test --lib pool::tests::test_calculate_total_pool_valid --manifest-path contracts/stellar-save/Cargo.toml
```

### Run tests with output
```bash
cargo test --lib -- --nocapture --manifest-path contracts/stellar-save/Cargo.toml
```

---

## Troubleshooting

See the [Troubleshooting Guide](docs/guides/troubleshooting.md) for solutions to common build and test issues.

---

## Useful Commands

### Check for compilation errors
```bash
cargo check --manifest-path contracts/stellar-save/Cargo.toml
```

### Format code
```bash
cargo fmt --manifest-path contracts/stellar-save/Cargo.toml
```

### Lint code
```bash
cargo clippy --manifest-path contracts/stellar-save/Cargo.toml
```

### Generate documentation
```bash
cargo doc --manifest-path contracts/stellar-save/Cargo.toml --open
```

---

**Last Updated:** October 2026
