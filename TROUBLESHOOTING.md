# Troubleshooting Guide

## Common Issues and Solutions

### Issue 1: "feature `edition2024` is required"

**Error Message:**
```
error: failed to parse manifest at `/home/.../.cargo/registry/src/.../time-core-0.1.8/Cargo.toml`
Caused by:
feature `edition2024` is required
```

**Root Cause:**
Running `cargo build` from the root directory tries to resolve dependencies for all contracts in the workspace, including those that require newer Rust features.

**Solution:**
Always use the full path to the stellar-save contract manifest:

```bash
# ✅ CORRECT - Use full path
cargo build --manifest-path Stellar-Save/contracts/stellar-save/Cargo.toml

# ❌ WRONG - Don't use root
cargo build --manifest-path Stellar-Save/Cargo.toml

# ❌ WRONG - Don't use root
cargo build
```

**Why This Works:**
The stellar-save contract only depends on Soroban SDK 23.0.3, which doesn't require nightly Rust. Other contracts in the workspace have dependencies that need newer features.

---

### Issue 2: "cannot find module"

**Error Message:**
```
error: cannot find module `pool` in this crate
```

**Root Cause:**
The pool module wasn't properly added to lib.rs, or you're building the wrong contract.

**Solution:**
1. Verify `lib.rs` includes the pool module:
   ```rust
   pub mod pool;
   pub use pool::{PoolInfo, PoolCalculator};
   ```

2. Use the correct manifest path:
   ```bash
   cargo build --manifest-path Stellar-Save/contracts/stellar-save/Cargo.toml
   ```

---

### Issue 3: Tests not running

**Error Message:**
```
error: no tests to run
```

**Root Cause:**
Not using the `--lib` flag to run library tests.

**Solution:**
Always use `--lib` for library tests:

```bash
# ✅ CORRECT
cargo test --lib --manifest-path Stellar-Save/contracts/stellar-save/Cargo.toml

# ❌ WRONG - Missing --lib
cargo test --manifest-path Stellar-Save/contracts/stellar-save/Cargo.toml
```

---

### Issue 4: Compilation takes too long

**Symptoms:**
- First build takes several minutes
- Subsequent builds are slow

**Solutions:**

1. **Use incremental compilation:**
   ```bash
   CARGO_INCREMENTAL=1 cargo build --manifest-path Stellar-Save/contracts/stellar-save/Cargo.toml
   ```

2. **Use parallel compilation:**
   ```bash
   cargo build -j 4 --manifest-path Stellar-Save/contracts/stellar-save/Cargo.toml
   ```

3. **Use release mode for faster runtime:**
   ```bash
   cargo build --release --manifest-path Stellar-Save/contracts/stellar-save/Cargo.toml
   ```

4. **Clear cache if stuck:**
   ```bash
   rm -rf Stellar-Save/.cargo Stellar-Save/Cargo.lock
   cargo build --manifest-path Stellar-Save/contracts/stellar-save/Cargo.toml
   ```

---

### Issue 5: "error: failed to download"

**Error Message:**
```
error: failed to download `package-name v0.0.0`
Caused by:
unable to get packages from source
```

**Root Cause:**
Network issue or corrupted cache.

**Solutions:**

1. **Clear the cargo cache:**
   ```bash
   rm -rf ~/.cargo/registry/cache
   rm -rf Stellar-Save/Cargo.lock
   ```

2. **Update cargo index:**
   ```bash
   cargo update
   ```

3. **Try again:**
   ```bash
   cargo build --manifest-path Stellar-Save/contracts/stellar-save/Cargo.toml
   ```

---

### Issue 6: "error: could not compile"

**Error Message:**
```
error: could not compile `stellar-save` (lib)
```

**Root Cause:**
Syntax error or missing dependency.

**Solutions:**

1. **Check for syntax errors:**
   ```bash
   cargo check --manifest-path Stellar-Save/contracts/stellar-save/Cargo.toml
   ```

2. **View detailed error:**
   ```bash
   cargo build --manifest-path Stellar-Save/contracts/stellar-save/Cargo.toml 2>&1 | head -50
   ```

3. **Verify pool.rs is valid:**
   ```bash
   cargo check --lib --manifest-path Stellar-Save/contracts/stellar-save/Cargo.toml
   ```

---

### Issue 7: Pool tests failing

**Error Message:**
```
test result: FAILED. X failed; Y passed
```

**Solutions:**

1. **Run tests with output:**
   ```bash
   cargo test --lib pool -- --nocapture --manifest-path Stellar-Save/contracts/stellar-save/Cargo.toml
   ```

2. **Run specific failing test:**
   ```bash
   cargo test --lib pool::tests::test_name --manifest-path Stellar-Save/contracts/stellar-save/Cargo.toml
   ```

3. **Check for recent changes:**
   - Verify pool.rs wasn't modified
   - Check lib.rs includes pool module
   - Verify storage.rs is unchanged

---

### Issue 8: WASM build fails

**Error Message:**
```
error: failed to run custom build command for `soroban-env-host`
```

**Root Cause:**
Missing WASM target or build tools.

**Solutions:**

1. **Install WASM target:**
   ```bash
   rustup target add wasm32-unknown-unknown
   ```

2. **Verify installation:**
   ```bash
   rustup target list | grep wasm32
   ```

3. **Try build again:**
   ```bash
   cargo build --target wasm32-unknown-unknown --manifest-path Stellar-Save/contracts/stellar-save/Cargo.toml
   ```

---

### Issue 9: "Rust version too old"

**Error Message:**
```
error: package requires rustc 1.XX or newer
```

**Solutions:**

1. **Update Rust:**
   ```bash
   rustup update
   ```

2. **Check version:**
   ```bash
   rustc --version
   ```

3. **Verify minimum version (1.81.0):**
   ```bash
   rustc --version | grep -E "1\.(8[1-9]|9[0-9]|[1-9][0-9]{2})"
   ```

---

### Issue 10: "permission denied"

**Error Message:**
```
error: permission denied (os error 13)
```

**Root Cause:**
File permissions issue.

**Solutions:**

1. **Fix permissions:**
   ```bash
   chmod -R u+w Stellar-Save/
   ```

2. **Clear and rebuild:**
   ```bash
   rm -rf Stellar-Save/target
   cargo build --manifest-path Stellar-Save/contracts/stellar-save/Cargo.toml
   ```

---

## Quick Reference

### Correct Commands
```bash
# Build
cargo build --manifest-path Stellar-Save/contracts/stellar-save/Cargo.toml

# Test all
cargo test --lib --manifest-path Stellar-Save/contracts/stellar-save/Cargo.toml

# Test pool
cargo test --lib pool --manifest-path Stellar-Save/contracts/stellar-save/Cargo.toml

# Check
cargo check --manifest-path Stellar-Save/contracts/stellar-save/Cargo.toml

# WASM
cargo build --target wasm32-unknown-unknown --manifest-path Stellar-Save/contracts/stellar-save/Cargo.toml
```

### Incorrect Commands (Don't Use)
```bash
# ❌ From root without manifest path
cargo build
cargo test

# ❌ Wrong manifest path
cargo build --manifest-path Stellar-Save/Cargo.toml

# ❌ Missing --lib for library tests
cargo test --manifest-path Stellar-Save/contracts/stellar-save/Cargo.toml
```

---

## Debug Tips

### Enable verbose output
```bash
RUST_LOG=debug cargo build --manifest-path Stellar-Save/contracts/stellar-save/Cargo.toml
```

### Show all warnings
```bash
cargo build --manifest-path Stellar-Save/contracts/stellar-save/Cargo.toml 2>&1 | grep warning
```

### Check dependencies
```bash
cargo tree --manifest-path Stellar-Save/contracts/stellar-save/Cargo.toml
```

### Verify module structure
```bash
cargo doc --manifest-path Stellar-Save/contracts/stellar-save/Cargo.toml --no-deps
```

---

## Getting Help

1. **Check documentation:**
   - POOL_CALCULATION.md - API reference
   - BUILD_GUIDE.md - Build instructions
   - POOL_QUICK_REFERENCE.md - Quick start

2. **Review error message:**
   - Read the full error output
   - Check line numbers in error
   - Look for "note:" sections

3. **Search for similar issues:**
   - Check Soroban documentation
   - Search Rust error codes
   - Review GitHub issues

4. **Verify setup:**
   - Check Rust version: `rustc --version`
   - Check Cargo version: `cargo --version`
   - Check WASM target: `rustup target list | grep wasm32`

---

## Prevention Tips

1. **Always use full manifest path:**
   ```bash
   --manifest-path Stellar-Save/contracts/stellar-save/Cargo.toml
   ```

2. **Use --lib for library tests:**
   ```bash
   cargo test --lib
   ```

3. **Keep Rust updated:**
   ```bash
   rustup update
   ```

4. **Clear cache periodically:**
   ```bash
   rm -rf Stellar-Save/Cargo.lock
   ```

5. **Commit working state:**
   - Before making changes
   - After successful build
   - Before major updates

---

## Still Having Issues?

1. **Verify pool.rs exists:**
   ```bash
   ls -la Stellar-Save/contracts/stellar-save/src/pool.rs
   ```

2. **Check lib.rs includes pool:**
   ```bash
   grep "pub mod pool" Stellar-Save/contracts/stellar-save/src/lib.rs
   ```

3. **Verify tests pass:**
   ```bash
   cargo test --lib pool --manifest-path Stellar-Save/contracts/stellar-save/Cargo.toml
   ```

4. **Check documentation:**
   - See DELIVERY_COMPLETE.md for overview
   - See BUILD_GUIDE.md for build help
   - See POOL_CALCULATION.md for API help

---

**Last Updated:** February 21, 2026  
**Status:** Complete ✅
