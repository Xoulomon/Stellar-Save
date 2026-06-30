#!/usr/bin/env bash
# scripts/check_contract_size.sh
# Measures WASM size, enforces the Soroban 100 KB limit, tracks trends,
# and emits optimization suggestions when the contract is large.
#
# Outputs:
#   deployment-records/size_history.json  — appended on every run
#   deployment-records/size_report.md     — human-readable report (for PR comments)
#
# Exit codes:
#   0 — within limit
#   1 — exceeds limit
#
# Optional env vars:
#   WASM_PATH            (default: target/wasm32-unknown-unknown/release/stellar_save.wasm)
#   WASM_SIZE_LIMIT_KB   (default: 100)
#   WARN_THRESHOLD_PCT   (default: 80)  — warn when size > this % of limit
#   GIT_SHA              (default: git rev-parse HEAD)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WASM="${WASM_PATH:-$ROOT/target/wasm32-unknown-unknown/release/stellar_save.wasm}"
LIMIT_KB="${WASM_SIZE_LIMIT_KB:-100}"
WARN_PCT="${WARN_THRESHOLD_PCT:-80}"
SHA="${GIT_SHA:-$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)}"
HISTORY="$ROOT/deployment-records/size_history.json"
REPORT="$ROOT/deployment-records/size_report.md"

mkdir -p "$ROOT/deployment-records"

# ─── Build if needed ──────────────────────────────────────────────────────────
if [ ! -f "$WASM" ]; then
  echo "Building WASM..."
  cargo build \
    --manifest-path "$ROOT/contracts/stellar-save/Cargo.toml" \
    --target wasm32-unknown-unknown \
    --release --quiet
fi

if [ ! -f "$WASM" ]; then
  echo "❌ WASM not found: $WASM" >&2; exit 1
fi

# ─── Measure ──────────────────────────────────────────────────────────────────
SIZE_BYTES=$(wc -c < "$WASM")
SIZE_KB=$(( (SIZE_BYTES + 1023) / 1024 ))   # ceiling KB
LIMIT_BYTES=$(( LIMIT_KB * 1024 ))
USED_PCT=$(python3 -c "print(round($SIZE_BYTES / $LIMIT_BYTES * 100, 1))")
WARN_BYTES=$(python3 -c "print(int($LIMIT_BYTES * $WARN_PCT / 100))")
HEADROOM_KB=$(( LIMIT_KB - SIZE_KB ))

# ─── Status ───────────────────────────────────────────────────────────────────
if   [ "$SIZE_BYTES" -gt "$LIMIT_BYTES" ]; then STATUS="FAIL";  ICON="🚨"
elif [ "$SIZE_BYTES" -gt "$WARN_BYTES"  ]; then STATUS="WARN";  ICON="⚠️"
else                                            STATUS="OK";    ICON="✅"
fi

echo "${ICON} WASM size: ${SIZE_KB} KB (${SIZE_BYTES} bytes) — ${USED_PCT}% of ${LIMIT_KB} KB limit"
echo "   Headroom: ${HEADROOM_KB} KB"

# ─── Trend: load history ──────────────────────────────────────────────────────
PREV_SIZE_BYTES=0
DELTA_BYTES=0
TREND_ARROW="→"

if [ -f "$HISTORY" ]; then
  PREV_SIZE_BYTES=$(python3 -c "
import json
entries = json.load(open('$HISTORY'))
print(entries[-1]['size_bytes'] if entries else 0)
" 2>/dev/null || echo 0)
fi

if [ "$PREV_SIZE_BYTES" -gt 0 ]; then
  DELTA_BYTES=$(( SIZE_BYTES - PREV_SIZE_BYTES ))
  if   [ "$DELTA_BYTES" -gt 0 ]; then TREND_ARROW="↑ +${DELTA_BYTES} bytes"
  elif [ "$DELTA_BYTES" -lt 0 ]; then TREND_ARROW="↓ ${DELTA_BYTES} bytes"
  else                                 TREND_ARROW="→ no change"
  fi
  echo "   Trend: ${TREND_ARROW} vs previous build"
fi

# ─── Append to history ────────────────────────────────────────────────────────
python3 - <<EOF
import json, datetime, os

history_file = "$HISTORY"
try:
    with open(history_file) as f:
        entries = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    entries = []

entries.append({
    "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
    "sha": "$SHA",
    "size_bytes": $SIZE_BYTES,
    "size_kb": $SIZE_KB,
    "limit_kb": $LIMIT_KB,
    "used_pct": float("$USED_PCT"),
    "status": "$STATUS",
    "delta_bytes": $DELTA_BYTES
})
entries = entries[-50:]   # keep last 50 entries

with open(history_file, "w") as f:
    json.dump(entries, f, indent=2)
EOF

# ─── Optimization suggestions ─────────────────────────────────────────────────
SUGGESTIONS=""
if [ "$STATUS" != "OK" ] || [ "$SIZE_KB" -gt $(( LIMIT_KB * 60 / 100 )) ]; then
  SUGGESTIONS=$(cat <<'SUGG'

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
SUGG
)
fi

# ─── Write markdown report ────────────────────────────────────────────────────
cat > "$REPORT" <<MDEOF
## 📦 Contract Size Report

| | |
|---|---|
| **Size** | ${SIZE_KB} KB (${SIZE_BYTES} bytes) |
| **Limit** | ${LIMIT_KB} KB |
| **Used** | ${USED_PCT}% |
| **Headroom** | ${HEADROOM_KB} KB |
| **Trend** | ${TREND_ARROW} |
| **Status** | ${ICON} ${STATUS} |
| **Commit** | \`${SHA}\` |

MDEOF

# Append last 5 history entries as a trend table
python3 - <<EOF >> "$REPORT"
import json

try:
    entries = json.load(open("$HISTORY"))[-5:]
except Exception:
    entries = []

if len(entries) > 1:
    print("### Size trend (last 5 builds)\n")
    print("| Commit | Size (KB) | Used % | Delta | Status |")
    print("|---|---|---|---|---|")
    for e in entries:
        delta = f"+{e['delta_bytes']}" if e['delta_bytes'] > 0 else str(e['delta_bytes'])
        print(f"| \`{e['sha']}\` | {e['size_kb']} | {e['used_pct']}% | {delta if e['delta_bytes'] != 0 else '—'} | {e['status']} |")
    print()
EOF

echo "$SUGGESTIONS" >> "$REPORT"

echo
echo "Report written to: $REPORT"

# ─── Gate ─────────────────────────────────────────────────────────────────────
if [ "$STATUS" = "FAIL" ]; then
  echo
  echo "🚫 Contract exceeds Soroban ${LIMIT_KB} KB limit (${SIZE_KB} KB). Deployment blocked."
  exit 1
fi
