# Bundle size performance budget

The frontend enforces a **performance budget** on its production build so that
bundle size does not creep upwards unnoticed as dependencies are added.

## What is checked

`npm run size` runs `scripts/check-bundle-size.mjs`, which:

1. Scans the Vite build output in `dist/`.
2. Computes the **gzipped** size of every `.js` and `.css` asset.
3. Compares three aggregates against the limits in
   [`bundle-budget.json`](../bundle-budget.json):

   | Metric                | Meaning                                    |
   | --------------------- | ------------------------------------------ |
   | `totalJsGzipKib`      | Sum of all JavaScript chunks (gzip)        |
   | `totalCssGzipKib`     | Sum of all CSS files (gzip)                |
   | `largestChunkGzipKib` | The single biggest JavaScript chunk (gzip) |

The command exits non-zero when any limit is exceeded, which fails CI
(`.github/workflows/bundle-size.yml`).

## Running it locally

```bash
npm run build      # produce dist/
npm run size       # check the budget
```

`npm run size -- --json` prints a machine-readable report including the per-file
breakdown.

## Adjusting the budget

The budget is intentionally version-controlled so every change is reviewed.

- **Legitimate growth** (a new feature genuinely needs a larger dependency):
  raise the relevant limit in `bundle-budget.json` in the same PR that adds the
  dependency, and explain why in the PR description. Prefer the smallest bump
  that accommodates the change plus a little head-room.
- **Recording a new baseline** after a build-tooling change: run

  ```bash
  npm run size:update
  ```

  This writes the current measurements into the `measured` block of
  `bundle-budget.json` for reference. It does **not** change the enforced
  `budgets` — tighten those manually once the new baseline is stable.

- **Unexpected growth**: investigate before raising the limit. `dist/stats.html`
  (produced by `npm run build:analyze`) shows what landed in each chunk. Common
  causes are a dependency that is no longer tree-shakeable or a large module
  pulled into the initial load path instead of a lazy route chunk.
