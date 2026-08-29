# Unused Exports Triage Report

## Date
_Updated on initial commit — re-run `./scripts/find-unused-exports.sh` to refresh._

## Triage Rules

1. **Confirmed unused** — remove the export and any dead code behind it
2. **Intentionally public API** — keep; add to `packages/sdk` or re-export from index
3. **Test-only export** — keep; annotate with `// @internal` or move to a test helper
4. **False positive** — module is consumed dynamically or via barrel; document why

## Common False Positives

- `index.ts` barrel files (re-exports are always flagged)
- SDK package entry points
- Event handler types imported by consumers at runtime
- Zod schema types inferred via `z.infer<>` (usage not tracked by ts-prune)

## Action Items

- [ ] Run `./scripts/find-unused-exports.sh` after installing ts-prune
- [ ] Triage each entry using the rules above
- [ ] Remove confirmed-unused exports
- [ ] Verify with `pnpm turbo build && pnpm turbo test`
