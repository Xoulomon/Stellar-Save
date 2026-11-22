## 📦 Contract Size Report

| | |
|---|---|
| **Size** | 96 KB (97926 bytes) |
| **Limit** | 100 KB |
| **Used** | 95.6% |
| **Headroom** | 4 KB |
| **Trend** | → |
| **Status** | ⚠️ WARN |
| **Commit** | `b472c4f5` |


### 💡 Optimization suggestions

| Technique | Expected saving |
|---|---|
| Add `opt-level = "z"` to `[profile.release]` in Cargo.toml | 10–30% |
| Add `lto = true` to `[profile.release]` | 5–15% |
| Add `codegen-units = 1` to `[profile.release]` | 2–5% |
| Run `wasm-opt -Oz` on the output WASM | 10–20% |
| Remove unused dependencies from Cargo.toml | varies |
| Use `#[contracttype]` only where needed; prefer primitives | varies |
| Avoid `String` — use `Symbol` or `Bytes` for fixed identifiers | 1–5% |
| Split large contracts into smaller composable contracts | varies |

Add to `contracts/stellar-save/Cargo.toml`:
```toml
[profile.release]
opt-level = "z"
lto = true
codegen-units = 1
strip = true
```
