# Shell Test Scripts

Run every project test section, including these shell checks, from the
repository root with:

```bash
bash run-tests.sh
```

The runner continues after a failure, reports each script's exit status, and
returns `0` only when every section succeeds. The runner passes each shell
script to Bash, so executable file permissions are not required.

## Scripts

| Script | Purpose | Prerequisites | Successful result |
|--------|---------|---------------|-------------------|
| [`infra_test.sh`](./infra_test.sh) | Checks Terraform formatting, initialization, validation, and required infrastructure configuration for the module, staging, production, and bootstrap. | Bash, Terraform 1.7 or newer, and provider downloads available if they are not cached. The script runs `terraform init -backend=false`; it does not run a plan or require AWS credentials. | Prints a results summary with no failures and exits `0`. |
| [`changelog_test.sh`](./changelog_test.sh) | Checks commit message rules, changelog tooling, and the Husky commit-msg hook. | Bash, Node.js, Python 3, and root `node_modules` containing `commitlint` and `conventional-changelog`. | Prints a test summary with no failures and exits `0`. |
| [`size_check_test.sh`](./size_check_test.sh) | Exercises contract WASM size reporting with generated sample WASM files. | Bash, `dd`, `grep`, `wc`, and Python 3. If no WASM artifact is supplied through `WASM_PATH`, Cargo and the `wasm32-unknown-unknown` target are also needed by the size checker. | Prints a test summary with no failures and exits `0`. Generated size history/report files are restored or removed when the script exits. |
| [`reproducible_build_test.sh`](./reproducible_build_test.sh) | Checks the reproducible WASM build pipeline and its checksum. | Bash, Docker with its daemon running, Python 3, `sha256sum`, and the repository checksum file. The default verification may build a Docker image; use `--skip-build` only when a current WASM artifact exists. Setting `CONTRACT_ID` additionally requires Stellar CLI and network access. | Prints a test summary with no failures and exits `0`; unavailable optional on-chain checks are reported as skipped. |
| [`multi_region_failover_test.sh`](./multi_region_failover_test.sh) | Verifies simulated or live Route 53 failover, health continuity, and recovery. | Bash, Python 3, `date`, and `sleep` for the default `DRY_RUN=1` mode. Live mode (`DRY_RUN=0`) additionally requires AWS CLI credentials/permissions, `dig`, `curl`, `PRIMARY_HEALTH_CHECK_ID`, and `API_ENDPOINT`. | Prints a failover summary and exits `0` when all assertions pass. Direct runs write `failover-results.json` under `RESULTS_DIR` (defaults to `tests/`); the root runner uses and removes a temporary results directory. |
| [`canary_test.sh`](./canary_test.sh) | Checks canary routing, rollback, metrics, threshold evaluation, and promotion using temporary data. | Bash and Python 3. No network or external service is used. | Prints its assertions and exits `0` when none fail. |
| [`blue_green_test.sh`](./blue_green_test.sh) | Checks blue-green deployment, switching, rollback, and health-check scripts using temporary data. | Bash, Python 3, `grep`, and `curl`. The health-check assertion expects the local test port to be unreachable. | Prints a results summary with no failures and exits `0`. |

## Exit-code convention

Every script uses exit code `0` for success and a non-zero exit code for a
failure or missing required prerequisite. Optional checks explicitly described
as skipped do not fail the script. `run-tests.sh` returns `1` if any test
section fails.
