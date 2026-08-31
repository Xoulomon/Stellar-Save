# Reproducible Build Verification

Stellar-Save publishes a deterministic WASM build whose SHA-256 hash is committed to the repository. Every CI run and every deployment can be independently verified to confirm that:

1. The WASM produced from source is bit-for-bit identical across machines.
2. The deployed on-chain contract matches that locally-built artifact.

---

## Table of Contents

- [How It Works](#how-it-works)
- [Running Verification](#running-verification)
  - [Quick start](#quick-start)
  - [Full pipeline reference](#full-pipeline-reference)
  - [Test suite](#test-suite)
- [What the Checksum File Is](#what-the-checksum-file-is)
- [Regenerating the Baseline Checksum](#regenerating-the-baseline-checksum)
- [Failure Triage](#failure-triage)
  - [F1 – Hash mismatch (local build vs baseline)](#f1--hash-mismatch-local-build-vs-baseline)
  - [F2 – Hash mismatch (on-chain vs local)](#f2--hash-mismatch-on-chain-vs-local)
  - [F3 – Build produces different hash on every run](#f3--build-produces-different-hash-on-every-run)
  - [F4 – Docker image pull failure](#f4--docker-image-pull-failure)
  - [F5 – Stellar CLI cannot fetch on-chain hash](#f5--stellar-cli-cannot-fetch-on-chain-hash)
  - [F6 – Checksum file missing or malformed](#f6--checksum-file-missing-or-malformed)
- [CI Integration](#ci-integration)
- [Security Implications](#security-implications)
- [Reference: Key Files](#reference-key-files)

---

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│  Source code  (contracts/stellar-save/src/)                     │
│  + rust-toolchain.toml  (channel: stable, pinned)               │
└────────────────────┬────────────────────────────────────────────┘
                     │  Docker: rust:<channel>
                     │  SOURCE_DATE_EPOCH=0
                     │  CARGO_INCREMENTAL=0
                     │  RUSTFLAGS="-C metadata=00000000 ..."
                     ▼
          stellar_save.wasm  (WASM artifact)
                     │
          ┌──────────┴──────────┐
          │                     │
    sha256sum              sha256sum
          │                     │
          ▼                     ▼
  Baseline checksum    On-chain WASM hash
  (committed to repo)  (from stellar contract info)
          │                     │
          └──────────┬──────────┘
                     │
                  MATCH?
                Yes ✅ / No ❌
```

Reproducibility is achieved by:

| Factor | Control |
|---|---|
| Compiler version | `rust-toolchain.toml` pinned channel; Docker image `rust:<channel>` |
| Timestamps in binary | `SOURCE_DATE_EPOCH=0` |
| Incremental caches | `CARGO_INCREMENTAL=0` |
| Metadata hashes in symbol names | `RUSTFLAGS="-C metadata=00000000 -C extra-filename="` |
| Link-time optimisation | `lto = true` in `[profile.release]` (workspace Cargo.toml) |
| `wasm-opt` version | Controlled by the Docker image (same Soroban tooling) |

---

## Running Verification

### Quick start

```bash
# Build + verify hash matches committed baseline (no network needed)
./scripts/verify_reproducible_build.sh --local-only

# Build + verify + compare against deployed testnet contract
export CONTRACT_ID=CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
./scripts/verify_reproducible_build.sh
```

### Full pipeline reference

```
./scripts/verify_reproducible_build.sh [OPTIONS]

Options:
  --local-only        Skip on-chain hash comparison
  --skip-build        Reuse existing WASM artifact (must be already built)
  --regen-checksum    Rebuild and overwrite contracts/stellar-save/stellar_save.wasm.sha256
  --help              Show usage
```

Environment variables (only needed without `--local-only`):

| Variable | Default | Description |
|---|---|---|
| `CONTRACT_ID` | (none) | Deployed contract address |
| `STELLAR_NETWORK` | `testnet` | `testnet` or `mainnet` |
| `STELLAR_RPC_URL` | (network default) | Custom Soroban RPC URL |

### Test suite

The automated test suite in `tests/reproducible_build_test.sh` wraps the verification script with structured assertions and exit-code checks:

```bash
# Run all tests (local only, no Stellar CLI required)
./tests/reproducible_build_test.sh --local-only

# Run all tests including on-chain check
export CONTRACT_ID=C...
./tests/reproducible_build_test.sh

# Re-use existing WASM artifact (faster iteration)
./tests/reproducible_build_test.sh --local-only --skip-build
```

Exit code `0` = all tests passed. Non-zero = at least one failure; details printed to stderr.

---

## What the Checksum File Is

`contracts/stellar-save/stellar_save.wasm.sha256` contains a single 64-character lowercase hexadecimal SHA-256 hash, e.g.:

```
a3f2b9e1c042d5f76ab89ed1234567890abcdef1234567890abcdef1234567890
```

This file is committed to git and serves as the "golden" expected hash. Any build, on any machine, using the pinned Docker image and toolchain must produce this exact hash. If it does not, verification fails and CI blocks the merge.

---

## Regenerating the Baseline Checksum

Run this when you intentionally change the contract source, update the Rust toolchain, or update Cargo dependencies:

```bash
./scripts/verify_reproducible_build.sh --regen-checksum
git add contracts/stellar-save/stellar_save.wasm.sha256
git commit -m "chore(contracts): update WASM baseline checksum"
```

After regenerating, re-run verification to confirm the new hash is stable:

```bash
./scripts/verify_reproducible_build.sh --skip-build --local-only
```

If the second run produces a different hash, the build is not yet reproducible. See [F3](#f3--build-produces-different-hash-on-every-run).

---

## Failure Triage

### F1 – Hash mismatch (local build vs baseline)

**Symptom:** `❌  WASM hash MISMATCH — build is NOT reproducible`

**Meaning:** The WASM built from the current source does not match `stellar_save.wasm.sha256`.

**Triage steps:**

1. **Was the contract source intentionally changed?**
   - If yes: regenerate the checksum (see [Regenerating the Baseline Checksum](#regenerating-the-baseline-checksum)).
   - If no: check `git diff contracts/stellar-save/` for unexpected changes.

2. **Were Cargo dependencies updated?**
   - Run `git diff Cargo.lock` to see if lock file changed.
   - Any bump in a transitive dependency can change the WASM binary.
   - If an unintended bump occurred: revert `Cargo.lock` or pin the offending dependency.

3. **Was the Rust toolchain channel changed?**
   - Check `git diff rust-toolchain.toml`.
   - `stable` advances over time. If you recently updated the toolchain, the binary changes.
   - Pin to a specific `stable-YYYY-MM-DD` or nightly date in `rust-toolchain.toml` for full stability.

4. **Was the build run outside Docker?**
   - Native builds do not guarantee reproducibility (different host LLVM, wasm-opt).
   - Always use `./scripts/verify_reproducible_build.sh` which builds inside Docker.

5. **Was `CARGO_INCREMENTAL` accidentally set to `1`?**
   - Incremental compilation can embed host-specific paths. Ensure `CARGO_INCREMENTAL=0`.

---

### F2 – Hash mismatch (on-chain vs local)

**Symptom:** `❌  On-chain WASM hash MISMATCH — deployed contract differs from local build`

**Meaning:** The contract currently live on-chain was built or deployed from a different source or artifact than what's in the repo.

**Triage steps:**

1. **Was the contract recently upgraded?**
   - Check the deployment history in the `deploy.yml` workflow runs.
   - Compare the on-chain hash with the hash recorded in the workflow artifacts.

2. **Was a manual deployment made outside CI?**
   - Any `stellar contract install` or `stellar contract update` outside of the CI pipeline will cause a mismatch.
   - Check with the team whether anyone deployed manually.

3. **Was the correct deployment artifact used?**
   - CI uploads the WASM as a workflow artifact. Confirm the deployment job used that same artifact, not a stale one.

4. **Possible supply-chain issue?**
   - If neither of the above explains the mismatch, treat this as a security incident.
   - Freeze the contract (call `pause_group` for active groups) and escalate to the security team.
   - Follow the incident response plan in `docs/incident-response-plan.md`.

5. **Re-deploy from a verified build:**
   - Build with `./scripts/verify_reproducible_build.sh --local-only`.
   - Deploy the `target/wasm32-unknown-unknown/release/stellar_save.wasm` produced by this run.
   - Re-run verification to confirm the on-chain hash now matches.

---

### F3 – Build produces different hash on every run

**Symptom:** Two consecutive runs of `./scripts/verify_reproducible_build.sh` produce different hashes.

**Meaning:** A non-deterministic input is contaminating the build.

**Triage steps:**

1. **Check `SOURCE_DATE_EPOCH`** — must be set to `0` (epoch). The Docker run in `build_reproducible.sh` sets this; if you are building natively, export it explicitly.

2. **Check `CARGO_INCREMENTAL`** — must be `0`. Incremental builds embed timestamps and host paths.

3. **Check `RUSTFLAGS`** — must include `-C metadata=00000000 -C extra-filename=`. Missing these allows cargo to embed hash-salted filenames.

4. **Check for `build.rs` scripts** — custom build scripts that embed `env!("CARGO_PKG_VERSION")` or system timestamps will break reproducibility. Audit any `build.rs` in the dependency tree.

5. **Check `wasm-opt` version** — if `wasm-opt` is invoked and its version differs between runs, it can change the binary. The Docker image pins the wasm-opt version; do not call wasm-opt outside the container.

6. **Compare binaries:**
   ```bash
   # Build twice, saving each output
   ./scripts/verify_reproducible_build.sh --regen-checksum
   cp target/wasm32-unknown-unknown/release/stellar_save.wasm /tmp/build1.wasm

   ./scripts/verify_reproducible_build.sh --regen-checksum
   cp target/wasm32-unknown-unknown/release/stellar_save.wasm /tmp/build2.wasm

   # Diff the raw bytes
   cmp /tmp/build1.wasm /tmp/build2.wasm || echo "DIFFERS"

   # For deeper analysis, use diffoscope:
   diffoscope /tmp/build1.wasm /tmp/build2.wasm
   ```

7. **Check for randomised symbol ordering** — older Rust versions could randomise symbol ordering. `stable` ≥ 1.77 is deterministic. Check `rust-toolchain.toml`.

---

### F4 – Docker image pull failure

**Symptom:** `docker: Error response from daemon: pull access denied` or similar.

**Triage steps:**

1. Check internet connectivity from the runner: `docker pull hello-world`.
2. If in an air-gapped environment, pre-load the image: `docker load < rust-<version>.tar`.
3. If the `stable` tag has moved (updated), pin to a date-stamped tag in `build_reproducible.sh`:
   ```bash
   # Instead of rust:stable, use:
   rust:1.81.0   # or whatever rust-toolchain.toml specifies
   ```

---

### F5 – Stellar CLI cannot fetch on-chain hash

**Symptom:** `❌  Could not retrieve on-chain WASM hash`

**Triage steps:**

1. **Verify `CONTRACT_ID`** — run `stellar contract info --id "$CONTRACT_ID" --network testnet` directly.
2. **Check network access** — `curl https://soroban-testnet.stellar.org` (or your `STELLAR_RPC_URL`).
3. **Check Stellar CLI version** — `stellar --version`. Older versions may not support `--output json`.
4. **Verify contract is deployed** — check Stellar Expert or Horizon for the contract account.
5. **Try a custom RPC URL**:
   ```bash
   export STELLAR_RPC_URL=https://soroban-testnet.stellar.org
   ./scripts/verify_reproducible_build.sh
   ```

---

### F6 – Checksum file missing or malformed

**Symptom:** `❌  Checksum file not found` or `Checksum file content does not look like a valid SHA-256`

**Triage steps:**

1. **File missing** — this is expected on a fresh clone before the first build. Generate it:
   ```bash
   ./scripts/verify_reproducible_build.sh --regen-checksum
   git add contracts/stellar-save/stellar_save.wasm.sha256
   git commit -m "chore(contracts): add WASM baseline checksum"
   ```

2. **File malformed** — the file must contain exactly one 64-character lowercase hex string with no trailing newline issues. Recreate it:
   ```bash
   sha256sum target/wasm32-unknown-unknown/release/stellar_save.wasm | awk '{print $1}' \
     > contracts/stellar-save/stellar_save.wasm.sha256
   ```

3. **File was committed with a Windows line ending** — use `dos2unix contracts/stellar-save/stellar_save.wasm.sha256`.

---

## CI Integration

The `.github/workflows/reproducible-build.yml` workflow runs on every push and pull request touching `contracts/`, `rust-toolchain.toml`, or the build scripts. It:

1. Builds the WASM inside Docker using the pinned Rust toolchain.
2. Runs `./tests/reproducible_build_test.sh --local-only` to assert the hash matches the committed baseline.
3. Uploads the WASM and checksum as a workflow artifact (retained 90 days).
4. Posts the SHA-256 to the GitHub step summary.

To trigger manually: **Actions → Reproducible WASM Verification → Run workflow**.

A second build run (to confirm two independent builds produce the same hash) is also performed in CI. Both must match the baseline checksum for the workflow to pass.

---

## Security Implications

Reproducible builds are a supply-chain security control. They make it possible for any third party — auditors, users, other developers — to independently verify that the deployed contract corresponds exactly to the open-source code in this repository.

A hash mismatch between the local build and the on-chain contract should be treated as a potential security incident until proven otherwise. Proceed as follows:

1. Immediately involve the security team (see `SECURITY.md`).
2. Do not dismiss the mismatch as "probably a toolchain bump" without proof.
3. Freeze affected groups via `pause_group` while the investigation is ongoing.
4. Document findings and remediation steps in an incident report.

---

## Reference: Key Files

| File | Purpose |
|---|---|
| `contracts/stellar-save/stellar_save.wasm.sha256` | Committed baseline SHA-256 of the canonical WASM |
| `scripts/build_reproducible.sh` | Low-level Docker build script |
| `scripts/verify_reproducible_build.sh` | Full verification pipeline (build → hash → on-chain) |
| `tests/reproducible_build_test.sh` | Automated test suite for CI |
| `.github/workflows/reproducible-build.yml` | CI workflow that runs the above |
| `rust-toolchain.toml` | Rust channel pin |
| `Cargo.lock` | Dependency version lock |
