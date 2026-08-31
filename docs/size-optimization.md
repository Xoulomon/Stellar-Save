# Contract Size Optimization

Soroban enforces a **100 KB WASM size limit**. The CI gate in `.github/workflows/contract-size.yml` blocks merges that exceed this limit and warns at 80%.

## Current status

The workspace `[profile.release]` in `Cargo.toml` already uses all recommended size-optimisation
flags:

```toml
[profile.release]
opt-level = "z"        # ✅ already set — optimize for size
lto = true             # ✅ already set — link-time optimization
codegen-units = 1      # ✅ already set — single codegen unit for better LTO
strip = "symbols"      # ✅ already set — strip debug symbols
panic = "abort"        # ✅ already set — removes unwinding machinery
overflow-checks = true # kept for safety
debug = 0              # ✅ already set — no debug info
```

No further compiler profile changes are needed. If size regressions occur, focus on
[post-build optimisation with wasm-opt](#post-build-optimization-with-wasm-opt) or
[code-level techniques](#code-level-techniques).

## Checking size locally

```bash
# Full report with history trend and markdown output:
bash scripts/check_contract_size.sh

# Lightweight CI gate (fast pass/fail, no history tracking):
bash scripts/size_check_ci.sh
```

`check_contract_size.sh` outputs the size, % of limit used, trend vs previous build, and a
markdown report at `deployment-records/size_report.md`.

`size_check_ci.sh` is designed for fast CI feedback — it emits GitHub Actions annotations and
exits with a non-zero status code if the contract exceeds the limit.

## Compiler profile (biggest wins first)

The workspace `Cargo.toml` already contains all of these. This section is preserved for reference
when evaluating new flags.

```toml
[profile.release]
opt-level = "z"      # optimize for size (not speed)
lto = true           # link-time optimization removes dead code across crates
codegen-units = 1    # single codegen unit enables better LTO
strip = true         # strip debug symbols from WASM
```

Expected combined saving over defaults: **20–40%**.

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
