# Contract Verification

Stellar-Save uses automated post-deployment verification to confirm that the on-chain contract matches the expected build artifact and is callable.

## How It Works

Verification runs in two places:

1. **Automatically** — as a step inside `deploy.yml` immediately after every deployment.
2. **On-demand** — via the dedicated `contract-verification.yml` workflow, which can be triggered manually or called from other workflows.

### What Gets Checked

| Check | Description |
|---|---|
| Contract existence | Confirms the contract ID is live on the target network |
| WASM hash integrity | Compares the on-chain WASM hash against the local build artifact |
| Read-only invocation | Calls `get_group(0)` to confirm the contract is executable |

## Running Verification Manually

Go to **Actions → Contract Verification → Run workflow** and provide:

- **network** — `testnet` or `mainnet`
- **contract_id** — the deployed contract address
- **expected_wasm_hash** — (optional) SHA-256 of the WASM; if omitted, the workflow builds from source and computes it

## Calling from Another Workflow

```yaml
jobs:
  verify:
    uses: ./.github/workflows/contract-verification.yml
    with:
      network: testnet
      contract_id: ${{ steps.deploy.outputs.contract_id }}
      expected_wasm_hash: ${{ needs.build.outputs.wasm_hash }}
    secrets: inherit
```

## Verification Script

The core logic lives in [`scripts/verify_contract.sh`](../scripts/verify_contract.sh).

Required environment variables:

| Variable | Description |
|---|---|
| `CONTRACT_ID` | Deployed contract address |
| `STELLAR_NETWORK` | `testnet` or `mainnet` |
| `STELLAR_RPC_URL` | Soroban RPC endpoint |
| `EXPECTED_WASM_HASH` | SHA-256 of the local WASM artifact |

Run locally:

```bash
export CONTRACT_ID=<your-contract-id>
export STELLAR_NETWORK=testnet
export STELLAR_RPC_URL=https://soroban-testnet.stellar.org
export EXPECTED_WASM_HASH=$(sha256sum target/wasm32-unknown-unknown/release/stellar_save.wasm | awk '{print $1}')

bash scripts/verify_contract.sh
```

## Verification Reports

Each run uploads a JSON report as a workflow artifact (retained 90 days):

```json
{
  "network": "testnet",
  "contract_id": "C...",
  "wasm_hash": "abc123...",
  "commit": "deadbeef...",
  "verified_at": "2026-04-27T08:00:00Z",
  "triggered_by": "github-actions[bot]",
  "status": "success"
}
```

## Handling Failures

If verification fails:

1. A commit status is posted to the triggering SHA with state `failure`.
2. The workflow exits non-zero, blocking any downstream jobs.
3. Check the uploaded verification report artifact for details.

Common causes:

- **WASM hash mismatch** — the deployed WASM does not match the build artifact; possible supply-chain issue or wrong artifact used.
- **Contract not found** — deployment may have failed silently; check the deploy job logs.
- **Network/RPC error** — transient; re-run the verification workflow.
