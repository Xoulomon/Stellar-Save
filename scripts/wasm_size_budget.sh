#!/usr/bin/env bash
# scripts/wasm_size_budget.sh
#
# Single source of truth for the Stellar-Save WASM size budget.
#
# All size-checking scripts (check_contract_size.sh, size_check_ci.sh) and
# the test suite (tests/size_check_test.sh) source this file so the budget
# value lives in exactly one place.
#
# Rationale for WASM_SIZE_BUDGET_KB=100
# ──────────────────────────────────────
# Soroban enforces a 100 KB hard limit on uploaded contract WASM.  Any
# contract that exceeds this limit cannot be deployed to any Stellar network
# (testnet or mainnet) and CI must block the merge immediately.
#
# The warn threshold is set at 80 KB (80% of the hard limit) to give
# developers early notice before reaching the network cap.  Optimisation
# techniques are documented in docs/size-optimization.md.
#
# Changing these values
# ─────────────────────
# 1. Update WASM_SIZE_BUDGET_KB and/or WASM_WARN_THRESHOLD_PCT below.
# 2. Update the "WASM size budget" section in contracts/stellar-save/README.md.
# 3. The three scripts that source this file pick up the new value automatically.
#
# Callers may still override these via environment variables — the env var
# takes precedence over the constant defined here, preserving backward
# compatibility with any CI matrix that sets its own values.

# Hard limit — Soroban on-chain maximum.
# Any WASM larger than this cannot be deployed.
WASM_SIZE_BUDGET_KB="${WASM_SIZE_BUDGET_KB:-100}"

# Soft warning threshold as a percentage of the hard limit.
# A WASM above this percentage triggers a warning but does not fail CI.
WASM_WARN_THRESHOLD_PCT="${WASM_WARN_THRESHOLD_PCT:-80}"
