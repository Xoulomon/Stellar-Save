# Contract Size Optimization

Soroban enforces a **100 KB WASM size limit**. The CI gate in `.github/workflows/contract-size.yml` blocks merges that exceed this limit and warns at 80%.

## Checking size locally

```bash
bash scripts/check_contract_size.sh
```

Outputs the size, % of limit used, trend vs previous build, and a markdown report at `deployment-records/size_report.md`.

## Compiler profile (biggest wins first)

Add to `contracts/stellar-save/Cargo.toml`:

```toml
[profile.release]
opt-level = "z"      # optimize for size (not speed)
lto = true           # link-time optimization removes dead code across crates
codegen-units = 1    # single codegen unit enables better LTO
strip = true         # strip debug symbols from WASM
```

Expected combined saving: **20–40%**.

## Post-build optimization with wasm-opt

`wasm-opt` (from the [binaryen](https://github.com/WebAssembly/binaryen) toolchain) can shrink the output further:

```bash
wasm-opt -Oz \
  target/wasm32-unknown-unknown/release/stellar_save.wasm \
  -o target/wasm32-unknown-unknown/release/stellar_save.wasm
```

Expected saving: **10–20%** on top of compiler flags.

## Code-level techniques

| Technique | Why it helps |
|---|---|
| Use `Symbol` instead of `String` for fixed identifiers | `String` pulls in allocator + UTF-8 machinery |
| Use `i128`/`u128` instead of `BigInt` wrappers | Avoids extra abstraction layers |
| Avoid `Vec<T>` in storage keys — use fixed-size types | Reduces monomorphization |
| Remove unused `soroban-sdk` features | Each feature adds WASM sections |
| Keep functions small and avoid generics where possible | Reduces monomorphization bloat |
| Use `#[contracttype]` only for types that cross the contract boundary | Internal types don't need XDR encoding |

## Thresholds

| Level | Threshold | Action |
|---|---|---|
| OK | < 80 KB | ✅ Pass |
| Warning | 80–100 KB | ⚠️ Pass with suggestions |
| Fail | > 100 KB | 🚨 CI blocks merge |

Thresholds are configurable via env vars:

```bash
WASM_SIZE_LIMIT_KB=100 WARN_THRESHOLD_PCT=80 bash scripts/check_contract_size.sh
```

## Trend tracking

Every CI run appends to `deployment-records/size_history.json` (kept as a GitHub Actions artifact, last 50 entries). The PR comment shows a trend table of the last 5 builds so regressions are visible immediately.
