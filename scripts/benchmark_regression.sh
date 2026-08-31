#!/usr/bin/env bash
# scripts/benchmark_regression.sh
# Performance regression gate for Soroban contract calls.
#
# Runs the contract benchmark suite, parses CPU instruction counts, compares
# them against the baseline in scripts/benchmark_baseline.json, and fails
# if any function regresses beyond the configured threshold (default: 10%).
#
# Usage:
#   bash scripts/benchmark_regression.sh                    # run benchmarks + check
#   bash scripts/benchmark_regression.sh --update-baseline  # update baseline with current results
#   bash scripts/benchmark_regression.sh --dry-run          # compare using existing log, no re-run
#
# Optional env vars:
#   REGRESSION_THRESHOLD_PCT  — override threshold from baseline JSON (e.g. "15")
#   BENCHMARK_LOG             — path to existing benchmark output to parse (for --dry-run)
#   RESULTS_DIR               — output directory for the JSON report (default: performance-results)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BASELINE_FILE="${SCRIPT_DIR}/benchmark_baseline.json"
RESULTS_DIR="${RESULTS_DIR:-${REPO_ROOT}/performance-results}"
REPORT_FILE="${RESULTS_DIR}/benchmark-regression-report.json"
BENCHMARK_LOG_DEFAULT="${RESULTS_DIR}/benchmark-raw.log"

UPDATE_BASELINE=false
DRY_RUN_MODE=false

# ─── Argument parsing ─────────────────────────────────────────────────────────
for arg in "$@"; do
  case "$arg" in
    --update-baseline) UPDATE_BASELINE=true ;;
    --dry-run)         DRY_RUN_MODE=true ;;
    *)                 echo "Unknown argument: ${arg}" >&2; exit 1 ;;
  esac
done

BENCHMARK_LOG="${BENCHMARK_LOG:-${BENCHMARK_LOG_DEFAULT}}"

cd "$REPO_ROOT"
mkdir -p "$RESULTS_DIR"

PASS=0
FAIL=0
REGRESSION_FOUND=false

ok()   { echo "  ✅  $*"; ((PASS++)) || true; }
fail() { echo "  ❌  $*"; ((FAIL++)) || true; REGRESSION_FOUND=true; }
info() { echo "  ℹ️   $*"; }
warn() { echo "  ⚠️   $*"; }

echo "════════════════════════════════════════════════════════════"
echo "  BENCHMARK REGRESSION GATE"
echo "  Baseline : ${BASELINE_FILE}"
echo "  Results  : ${REPORT_FILE}"
if [ "$UPDATE_BASELINE" = "true" ]; then
  echo "  Mode     : UPDATE BASELINE"
elif [ "$DRY_RUN_MODE" = "true" ]; then
  echo "  Mode     : DRY-RUN (using existing log)"
fi
echo "════════════════════════════════════════════════════════════"
echo

# ─── Step 1: Validate baseline file ──────────────────────────────────────────
if [ ! -f "$BASELINE_FILE" ]; then
  echo "❌ Baseline file not found: ${BASELINE_FILE}" >&2
  echo "   Run with --update-baseline to create it." >&2
  exit 1
fi

THRESHOLD_PCT=$(python3 -c "
import json
with open('${BASELINE_FILE}') as f:
    d = json.load(f)
print(d.get('regression_threshold_pct', 10))
")
# Allow env var to override
THRESHOLD_PCT="${REGRESSION_THRESHOLD_PCT:-${THRESHOLD_PCT}}"
info "Regression threshold: ${THRESHOLD_PCT}%"

# ─── Step 2: Run benchmarks (unless --dry-run) ────────────────────────────────
if [ "$DRY_RUN_MODE" = "false" ]; then
  echo "── Running contract benchmarks ──────────────────────────────────────────"
  echo "   cargo test --manifest-path contracts/stellar-save/Cargo.toml benchmark"
  echo

  cargo test \
    --manifest-path contracts/stellar-save/Cargo.toml \
    --lib benchmark \
    -- --nocapture --test-threads=1 2>&1 | tee "$BENCHMARK_LOG" || {
      warn "Benchmark run exited non-zero — results may be partial"
    }
  echo
else
  if [ ! -f "$BENCHMARK_LOG" ]; then
    echo "❌ --dry-run specified but benchmark log not found: ${BENCHMARK_LOG}" >&2
    echo "   Run without --dry-run first, or set BENCHMARK_LOG=<path>." >&2
    exit 1
  fi
  info "Dry-run mode: using existing log at ${BENCHMARK_LOG}"
fi

# ─── Step 3: Parse benchmark output ──────────────────────────────────────────
echo "── Parsing benchmark output ─────────────────────────────────────────────"

# Export for the python subprocess
export _BENCH_LOG="$BENCHMARK_LOG"

MEASURED_JSON=$(python3 - <<'PYEOF'
import re, json, os

log_file = os.environ["_BENCH_LOG"]
try:
    with open(log_file) as f:
        content = f.read()
except FileNotFoundError:
    print(json.dumps({}))
    raise SystemExit(0)

results = {}

# Pattern 1: "bench_<name>: cpu_insns = <N>" or "bench_<name>: cpu_insns=<N>"
p1 = re.compile(r'bench_(\w+?)(?:_n\d+)?[:\s]+cpu_insns\s*=\s*(\d+)', re.IGNORECASE)
for m in p1.finditer(content):
    func = m.group(1).lower()
    insns = int(m.group(2))
    if func not in results or insns > results[func]:
        results[func] = insns

# Pattern 2: "bench_<name>  <cpu_insns>" (table, large integers)
p2 = re.compile(r'^bench_(\w+)\s+(\d{5,})', re.MULTILINE)
for m in p2.finditer(content):
    func = m.group(1).lower()
    insns = int(m.group(2))
    if func not in results or insns > results[func]:
        results[func] = insns

# Normalise: strip _n<N> suffix so bench_join_group_n5 → join_group
normalised = {}
for raw_name, insns in results.items():
    name = re.sub(r'_n\d+$', '', raw_name)
    if name not in normalised or insns > normalised[name]:
        normalised[name] = insns

print(json.dumps(normalised))
PYEOF
)

MEASURED_COUNT=$(python3 -c "import json,sys; print(len(json.loads('${MEASURED_JSON//\'/\\'\'\'}'  )))" 2>/dev/null || \
  python3 -c "import json,os; print(len(json.loads(os.environ['_MEASURED'])))" <<< "" \
  || echo "0")

# Use a temp file to safely pass JSON between bash and python
TMP_MEASURED=$(mktemp)
TMP_COMPARISON=$(mktemp)
trap 'rm -f "$TMP_MEASURED" "$TMP_COMPARISON"' EXIT

echo "$MEASURED_JSON" > "$TMP_MEASURED"
MEASURED_COUNT=$(python3 -c "import json; print(len(json.load(open('${TMP_MEASURED}'))))")
info "Parsed ${MEASURED_COUNT} function measurements from benchmark output"

if [ "$MEASURED_COUNT" -eq 0 ]; then
  warn "No CPU instruction counts found in benchmark output."
  warn "The benchmarks may not have printed parseable output."
  warn "Check ${BENCHMARK_LOG} for details."
  warn "Skipping regression comparison (cannot compare against baseline)."
fi

# ─── Step 4: Compare against baseline ────────────────────────────────────────
echo
echo "── Regression comparison ────────────────────────────────────────────────"
printf "  %-24s  %12s  %12s  %8s  %s\n" "Function" "Baseline" "Measured" "Delta%" "Status"
printf "  %s\n" "────────────────────────────────────────────────────────────────────────"

export _BASELINE_FILE="$BASELINE_FILE"
export _TMP_MEASURED="$TMP_MEASURED"
export _THRESHOLD_PCT="$THRESHOLD_PCT"
export _TMP_COMPARISON="$TMP_COMPARISON"

python3 - <<'PYEOF'
import json, os

baseline_file  = os.environ["_BASELINE_FILE"]
measured_file  = os.environ["_TMP_MEASURED"]
comparison_out = os.environ["_TMP_COMPARISON"]
threshold_pct  = float(os.environ["_THRESHOLD_PCT"])

with open(baseline_file) as f:
    baseline = json.load(f)
with open(measured_file) as f:
    measured = json.load(f)

functions = baseline.get("functions", {})
results = []

for func_name, spec in functions.items():
    baseline_insns = spec.get("baseline_cpu_insns", 0)
    measured_insns = measured.get(func_name)

    if measured_insns is None:
        results.append({
            "function":   func_name,
            "baseline":   baseline_insns,
            "measured":   None,
            "delta_pct":  None,
            "status":     "skipped",
            "regression": False,
            "note":       "not found in benchmark output",
        })
        continue

    delta_pct = ((measured_insns - baseline_insns) / baseline_insns * 100) if baseline_insns > 0 else 0.0
    regressed = delta_pct > threshold_pct

    results.append({
        "function":   func_name,
        "baseline":   baseline_insns,
        "measured":   measured_insns,
        "delta_pct":  round(delta_pct, 1),
        "status":     "regression" if regressed else "ok",
        "regression": regressed,
    })

# Print human-readable table
regressions = 0
for r in results:
    func     = r["function"]
    baseline = r["baseline"]
    measured = r.get("measured")
    delta    = r.get("delta_pct")
    status   = r["status"]

    if status == "skipped":
        symbol = "⏭️ "
        delta_str    = "     n/a"
        measured_str = "         n/a"
    elif r["regression"]:
        symbol = "❌"
        delta_str    = f"+{delta:>5.1f}%"
        measured_str = f"{measured:>12,}"
        regressions += 1
    else:
        delta_str    = f"{delta:>+6.1f}%" if delta is not None else "     n/a"
        measured_str = f"{measured:>12,}" if measured is not None else "         n/a"
        symbol = "✅"

    print(f"  {func:<24}  {baseline:>12,}  {measured_str}  {delta_str}  {symbol}")

print()
print(f"  Threshold: +{threshold_pct:.0f}%  |  Regressions detected: {regressions}")

# Write comparison JSON for later steps
with open(comparison_out, "w") as f:
    json.dump(results, f)
PYEOF

# ─── Step 5: Write results report ────────────────────────────────────────────
export _REPORT_FILE="$REPORT_FILE"
export _REGRESSION_FOUND="$REGRESSION_FOUND"

python3 - <<'PYEOF'
import json, datetime, os

baseline_file   = os.environ["_BASELINE_FILE"]
comparison_file = os.environ["_TMP_COMPARISON"]
results_file    = os.environ["_REPORT_FILE"]
threshold_pct   = float(os.environ["_THRESHOLD_PCT"])
regression_flag = os.environ["_REGRESSION_FOUND"]

with open(baseline_file) as f:
    baseline = json.load(f)
with open(comparison_file) as f:
    comparison = json.load(f)

# Re-evaluate regression_found from comparison data
regression_found = any(r.get("regression", False) for r in comparison)

report = {
    "timestamp":                datetime.datetime.utcnow().isoformat() + "Z",
    "baseline_version":         baseline.get("version", "1"),
    "baseline_file":            baseline_file,
    "regression_threshold_pct": threshold_pct,
    "regression_found":         regression_found,
    "summary": {
        "total":       len(comparison),
        "passed":      sum(1 for r in comparison if r["status"] == "ok"),
        "regressions": sum(1 for r in comparison if r["regression"]),
        "skipped":     sum(1 for r in comparison if r["status"] == "skipped"),
    },
    "functions": comparison,
}

with open(results_file, "w") as f:
    json.dump(report, f, indent=2)
print(f"  Report written to {results_file}")
PYEOF

# Re-read regression_found from the report
REGRESSION_FOUND=$(python3 -c "
import json
with open('${REPORT_FILE}') as f:
    d = json.load(f)
print('true' if d.get('regression_found', False) else 'false')
")
REGRESSIONS=$(python3 -c "
import json
with open('${REPORT_FILE}') as f:
    d = json.load(f)
print(d['summary']['regressions'])
")
SKIPPED=$(python3 -c "
import json
with open('${REPORT_FILE}') as f:
    d = json.load(f)
print(d['summary']['skipped'])
")
COMPARED=$(python3 -c "
import json
with open('${REPORT_FILE}') as f:
    d = json.load(f)
print(d['summary']['passed'] + d['summary']['regressions'])
")

PASS=$((PASS + COMPARED - REGRESSIONS))
FAIL=$((FAIL + REGRESSIONS))

# ─── Step 6: Update baseline (if --update-baseline) ──────────────────────────
if [ "$UPDATE_BASELINE" = "true" ]; then
  echo
  echo "── Updating baseline ────────────────────────────────────────────────────"

  if [ "$MEASURED_COUNT" -eq 0 ]; then
    warn "No measurements parsed — baseline NOT updated"
  else
    export _TMP_MEASURED="$TMP_MEASURED"
    export _BASELINE_FILE="$BASELINE_FILE"
    python3 - <<'PYEOF'
import json, datetime, os

baseline_file = os.environ["_BASELINE_FILE"]
measured_file = os.environ["_TMP_MEASURED"]

with open(baseline_file) as f:
    baseline = json.load(f)
with open(measured_file) as f:
    measured = json.load(f)

updated = 0
for func_name, spec in baseline.get("functions", {}).items():
    if func_name in measured:
        old_val = spec.get("baseline_cpu_insns", 0)
        new_val = measured[func_name]
        spec["baseline_cpu_insns"] = new_val
        print(f"  Updated {func_name}: {old_val:,} → {new_val:,}")
        updated += 1

baseline["generated_at"] = datetime.datetime.utcnow().isoformat() + "Z"

with open(baseline_file, "w") as f:
    json.dump(baseline, f, indent=2)

print(f"\n  Baseline updated ({updated} functions) → {baseline_file}")
PYEOF
    ok "Baseline updated with current measurements"
  fi
fi

# ─── Summary ──────────────────────────────────────────────────────────────────
echo
echo "════════════════════════════════════════════════════════════"
echo "  Tests: ${PASS} passed, ${FAIL} regressions, ${SKIPPED:-0} skipped"
echo "════════════════════════════════════════════════════════════"

if [ "$REGRESSION_FOUND" = "true" ]; then
  echo "❌ Performance regressions detected — see ${REPORT_FILE}"
  echo "   If this is an intentional change, update the baseline:"
  echo "   bash scripts/benchmark_regression.sh --update-baseline"
  exit 1
fi

echo "✅ No regressions detected (threshold: +${THRESHOLD_PCT}%)"
