#!/bin/bash
# Run the project tests and all shell-based checks in tests/.
set -u

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT" || exit 1

FAILED=0

run_section() {
    local title="$1"
    shift

    echo
    echo "$title"
    echo "----------------------------------------"
    if "$@"; then
        echo "✅ Passed: $title"
    else
        local result=$?
        echo "❌ Failed: $title (exit code $result)"
        FAILED=1
    fi
}

echo "🧪 Running Stellar-Save Test Suite"
echo "=================================="

run_section "Smart Contract Tests" cargo test --workspace --lib

if [ -d "$ROOT/frontend/node_modules" ]; then
    run_section "Frontend Tests" npm --prefix "$ROOT/frontend" test run
else
    echo
    echo "❌ Failed: Frontend Tests (frontend dependencies are not installed)"
    FAILED=1
fi

SHELL_TESTS=(
    tests/infra_test.sh
    tests/changelog_test.sh
    tests/size_check_test.sh
    tests/reproducible_build_test.sh
    tests/multi_region_failover_test.sh
    tests/canary_test.sh
    tests/blue_green_test.sh
)

for test_script in "${SHELL_TESTS[@]}"; do
    if [ "$test_script" = "tests/multi_region_failover_test.sh" ]; then
        results_dir="$(mktemp -d)"
        run_section "$test_script" env "RESULTS_DIR=$results_dir" bash "$ROOT/$test_script"
        rm -f "$results_dir/failover-results.json"
        rmdir "$results_dir"
    else
        run_section "$test_script" bash "$ROOT/$test_script"
    fi
done

echo
echo "=================================="
if [ "$FAILED" -eq 0 ]; then
    echo "✅ All test sections passed!"
    exit 0
fi

echo "❌ One or more test sections failed"
exit 1
