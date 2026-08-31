## Summary

<!-- What does this PR do? One or two sentences. -->

## Motivation

<!-- Why is this change needed? Link to the issue it resolves. -->

Closes #

## Type of change

<!-- Check all that apply -->

- [ ] `feat` — new feature
- [ ] `fix` — bug fix
- [ ] `docs` — documentation only
- [ ] `refactor` — code restructuring, no behaviour change
- [ ] `test` — tests only
- [ ] `chore` — build, deps, tooling
- [ ] `perf` — performance improvement
- [ ] Breaking change (existing behaviour changes)

## Changes

<!-- List the key changes made. Be specific enough that a reviewer knows where to look. -->

-
-

## Testing

<!-- Describe how you tested this. Include commands a reviewer can run to verify. -->

**Smart contract:**
```bash
cargo test -p stellar-save
```

**Frontend:**
```bash
cd frontend && npm test run
```

**Manual steps (if applicable):**

1.
2.

## Checklist

- [ ] `cargo fmt` run (Rust changes)
- [ ] `cargo clippy -- -D warnings` passes (Rust changes)
- [ ] `npm run lint` passes (frontend changes)
- [ ] Tests added or updated for new/changed behaviour
- [ ] CI is green
- [ ] Documentation updated (if behaviour changed)
- [ ] No secrets or `.env` files staged

## Screenshots / recordings

<!-- For UI changes, include before/after screenshots or a short screen recording. Delete this section if not applicable. -->
