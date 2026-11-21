# Maestro E2E Flow Stability Testing

## Acceptance Criteria

Each flow must pass **10 consecutive runs** without a single failure before it is
considered stable. This guards against timing-related flakiness introduced by
asynchronous blockchain operations (transaction confirmation, key derivation,
data reload after modal dismiss).

---

## How to Run the 10x Stability Check

Maestro CLI must be installed and an emulator/device must be attached.

```bash
# Install Maestro CLI (once)
curl -Ls "https://get.maestro.mobile.dev" | bash

# Start an Android emulator or connect a device, then:
cd mobile
./scripts/run-tests.sh --repeat 10
```

The `--repeat N` flag runs every non-quarantined flow N times in succession.
The first failure of any run in the sequence stops that flow and marks it
failed. All N runs of all flows must pass for exit code 0.

### Run a single flow 10 times

```bash
for i in $(seq 1 10); do
  echo "=== Run $i ==="
  maestro test .maestro/create_group.yaml || { echo "FAILED on run $i"; exit 1; }
done
echo "All 10 runs passed."
```

---

## CI Strategy

The standard CI pass (single run per flow) runs on every PR via the existing
`run-tests.sh` with no `--repeat` flag. This keeps CI fast.

The 10x stability check is a **pre-merge local gate** for any PR that:

- Modifies a `.maestro/*.yaml` flow, **or**
- Changes a screen component that a flow exercises

Add the following to your PR description when you've completed it:

```
- [ ] Ran `./scripts/run-tests.sh --repeat 10` — all flows passed 10/10
```

If Maestro CLI is not available in your environment (e.g., cloud-only
codespace), annotate the PR with the flows changed and request a reviewer with
a local device to run the stability check before merge.

---

## Condition-Based Wait Reference

All waits in Maestro flows **must** use condition-based polling. Never use
fixed sleeps (`sleep` or `waitForAnimationToEnd` without a condition).

| Scenario | Correct Maestro command |
|---|---|
| Async tx confirm (blockchain) | `extendedWaitUntil: visible: id: "..." timeout: 30000` |
| Navigation/screen transition | `extendedWaitUntil: visible: id: "..." timeout: 10000` |
| Modal dismiss + data reload | `extendedWaitUntil: visible: id: "..." timeout: 10000` |
| Key derivation / crypto ops | `extendedWaitUntil: visible: id: "..." timeout: 15000` |

### Timeout guidelines

| Operation type | Recommended timeout |
|---|---|
| Pure UI navigation | 5 000 ms |
| Screen transition with data fetch | 10 000 ms |
| Crypto / key derivation | 15 000 ms |
| Blockchain transaction round-trip | 30 000 ms |

These values are set conservatively for testnet latency. Tighten them only if
10 consecutive runs all complete well inside the limit.

---

## Flow Status (post-fix audit)

| Flow | Fixed waits added | Seed fix | Status |
|---|---|---|---|
| `setup.yaml` | Clears app data before each suite | `MAESTRO_TESTING`, PIN, and pending KYC fixture | ✅ shared setup |
| `onboarding.yaml` | Dashboard and balance testIDs | Dev-only auth bypass and balance fixture | ✅ aligned to current app |
| `onboarding_full.yaml` | Group create form and native success alert | In-memory group fixture service | ✅ aligned to current app |
| `onboarding_wallet_setup.yaml` | Wallet tab testID | No network dependency | ✅ aligned to current app |
| `onboarding_kyc_form.yaml` | Group form validation messages | No network dependency | ✅ aligned to current app |
| `onboarding_kyc_status.yaml` | Group list and fixture names | In-memory group fixtures | ✅ aligned to current app |
| `onboarding_biometric_auth.yaml` | Dashboard and group list testIDs | Dev-only auth bypass | ✅ aligned to current app |
| `smoke.yaml` | Dashboard, balance, and fixture group testIDs | In-memory fixtures | ✅ updated |
| `create_group.yaml` | Group form and native success alert | In-memory group fixture service | ✅ updated |
| `contribute.yaml` | Active group fixture; contribution UI is not implemented | In-memory group fixtures | ⚠️ contribution action unavailable |
| `join_group.yaml` | Fixture lookup, preview, and native success alert | In-memory group fixture service | ✅ updated |
| `wallet_creation.yaml` | Wallet tab testID; wallet creation is not implemented | No network dependency | ✅ aligned to current app |

Every runnable flow starts by invoking `setup.yaml`; the runner excludes that
shared setup flow from its standalone suite list. Maestro flows use the mobile
application ID from `mobile/app.json`. Some flow filenames remain for continuity
but now target current screens: the app does not yet implement onboarding, KYC,
wallet creation, or contribution journeys.

---

## Duplicate Flow Audit

No unit test files exist under `mobile/src/` (`.test.ts` / `.spec.tsx`). There
is therefore no Maestro flow that duplicates unit test coverage — no flows were
deleted.

`smoke.yaml` intentionally overlaps with `onboarding.yaml` and
`create_group.yaml` as a fast sanity check. This is by design for smoke suites
and is not considered a duplicate.
