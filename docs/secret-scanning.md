# Secret Scanning

Stellar-Save runs secret detection at two layers:

| Layer | Tool | When | Config |
|-------|------|------|--------|
| Local pre-commit | [gitleaks](https://github.com/gitleaks/gitleaks) | Before every commit | `.gitleaks.toml` |
| CI (every push/PR) | gitleaks-action | Push to `main`/`develop`, all PRs | `.gitleaks.toml` (via `.github/workflows/secret-scan.yml`) |

The pre-commit hook scans only **staged** changes so it is fast and never blocks
unrelated work.

---

## Installing gitleaks

The pre-commit hook warns (but does not fail) when `gitleaks` is not on the
PATH. Install it once and all future commits on this machine are protected.

### macOS

```bash
brew install gitleaks
```

### Linux (binary from GitHub Releases)

```bash
# Replace X.Y.Z with the latest release from https://github.com/gitleaks/gitleaks/releases
VERSION=8.21.2
curl -sSL "https://github.com/gitleaks/gitleaks/releases/download/v${VERSION}/gitleaks_${VERSION}_linux_x64.tar.gz" \
  | tar -xz gitleaks
sudo mv gitleaks /usr/local/bin/
gitleaks version
```

### Windows (scoop)

```powershell
scoop install gitleaks
```

### Go install

```bash
go install github.com/gitleaks/gitleaks/v8@latest
```

Verify the installation:

```bash
gitleaks version
```

---

## How it works

The hook runs:

```bash
gitleaks protect --staged --config .gitleaks.toml --redact --no-banner
```

- `protect --staged` — only looks at the diff that is about to be committed.
- `--config .gitleaks.toml` — uses the project's rule set, which extends the
  default Gitleaks ruleset and adds project-specific allow-list entries for
  placeholder values in example files.
- `--redact` — prints `REDACTED` instead of the actual secret value in scan
  output, so the sensitive value is never echoed to the terminal.
- `--no-banner` — suppresses the ASCII art banner for cleaner output.

---

## Rule set

Rules are defined in `.gitleaks.toml` at the repository root. The file
`[extend] useDefault = true` directive pulls in the full upstream Gitleaks
built-in ruleset, so all common secret patterns (AWS keys, GitHub tokens, SSH
keys, etc.) are covered automatically. The project-level `[[allowlists]]`
section adds safe exceptions:

| Pattern | Allowed in |
|---------|-----------|
| `<your-contract-id>` | Any file (documentation placeholder) |
| `your_.*_here` | Any file (documentation placeholder) |
| `PLACEHOLDER` | Any file (documentation placeholder) |
| Any value | `.env.example`, `frontend/.env.testnet.example`, `docs/**`, `README.md` |

To propose a new allow-list entry, open a PR that adds the entry to
`.gitleaks.toml` and explains why the false positive cannot be removed.

---

## Bypassing the hook

> **Bypass is for emergencies only.** See [docs/bypass-policy.md](bypass-policy.md)
> for the full policy.

```bash
# Bypass all pre-commit hooks (lint + secret scan)
git commit --no-verify -m "fix: emergency hotfix"
```

### Acceptable reasons to bypass

- Production hotfix where every minute of delay costs users money.
- The `gitleaks` binary itself is broken or unavailable and the change is
  provably free of secrets.

### Not acceptable

- "It's just a test file" — test files have leaked production secrets before.
- "I'll clean it up later" — rotate first, commit second.

### After a bypass

1. **If a real secret was committed**: rotate the secret immediately, then
   remove it from git history using `git filter-repo` or BFG.
2. **If you bypassed for a different reason**: file a follow-up issue and
   resolve it within 24 hours.

---

## Frequently asked questions

**Q: My commit is blocked by a false positive. What do I do?**

Confirm it is actually a false positive by reading the matched rule in the
output. If it is, add an `[[allowlists]]` entry in `.gitleaks.toml` that is as
narrow as possible (prefer `paths` over `regexes`). Open a PR with the
change.

**Q: I see "gitleaks not found" every commit. Is that a problem?**

The hook prints a warning but still succeeds, so your commit goes through. The
CI gate (`secret-scan.yml`) still catches leaks before they merge to the main
branch. Install gitleaks locally to shift detection earlier.

**Q: Does this scan the whole repository history?**

The pre-commit hook only scans staged changes (`--staged`). If you want to scan
history, run:

```bash
gitleaks detect --config .gitleaks.toml --redact --source .
```
