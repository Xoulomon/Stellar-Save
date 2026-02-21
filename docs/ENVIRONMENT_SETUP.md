# Environment Setup

## Rust & Soroban Development Environment

### Prerequisites
- Install Rust: https://rustup.rs/
- Install Soroban CLI:
```bash
cargo install --locked soroban-cli
```

### Setup
1. Clone the repository
2. Rust toolchain will auto-install via `rust-toolchain.toml`
3. Add wasm target:
```bash
rustup target add wasm32-unknown-unknown
```

### Build Contracts
```bash
soroban contract build
```

### Run Tests
```bash
cargo test
```
