# Visual Regression Testing

Stellar-Save uses [Percy](https://percy.io) + [Playwright](https://playwright.dev) to catch unintended UI changes before they reach production.

## How it works

1. Playwright navigates to key UI surfaces and calls `percySnapshot()`.
2. Percy uploads the screenshots to its cloud service and diffs them against the approved baseline.
3. If visual changes are detected, the Percy check on the PR is marked as **needs review**.
4. A team member reviews the diff in the Percy dashboard and either **approves** (new baseline) or **rejects** (fix the regression).

## Setup

### Local development

1. Get a Percy token from [percy.io](https://percy.io) (project → Settings → Token).
2. Export it in your shell:
   ```bash
   export PERCY_TOKEN=<your-token>
   ```
3. Build the frontend and run the visual tests:
   ```bash
   cd frontend
   npm run build
   npm run test:visual
   ```

### CI (GitHub Actions)

Add `PERCY_TOKEN` as a repository secret:  
**Settings → Secrets and variables → Actions → New repository secret**

The workflow (`.github/workflows/visual-regression.yml`) runs automatically on every PR targeting `main` or `develop`.

## Running tests

| Command | Description |
|---|---|
| `npm run test:visual` | Run visual snapshots locally (list reporter) |
| `npm run test:visual:ci` | Run visual snapshots in CI (GitHub reporter) |

## Adding new snapshots

Edit `frontend/src/test/visual/visual.spec.ts`:

```ts
import { test } from '@playwright/test';
import percySnapshot from '@percy/playwright';

test('My new component', async ({ page }) => {
  await page.goto('/my-route');
  await page.waitForLoadState('networkidle');
  await percySnapshot(page, 'My new component');
});
```

## Approving baseline changes

When intentional UI changes are made:

1. Open the Percy build from the PR checks.
2. Review each changed snapshot.
3. Click **Approve** for expected changes.
4. The PR check turns green and the new screenshots become the baseline.

## Configuration

| File | Purpose |
|---|---|
| `frontend/playwright.visual.config.ts` | Playwright config for visual tests (uses `vite preview` on port 4173) |
| `frontend/src/test/visual/visual.spec.ts` | Percy snapshot test suite |
| `.github/workflows/visual-regression.yml` | CI workflow |

## Diff thresholds

Percy's default diff threshold is **0%** (any pixel change triggers a review). To adjust sensitivity, configure it in the Percy dashboard under **Project → Settings → Diff sensitivity**.

## Troubleshooting

**Percy check is skipped in CI**  
The workflow only runs when `PERCY_TOKEN` is set. Forks without the secret will skip the job gracefully.

**Flaky snapshots due to animations**  
The test helper `freezeAnimations()` in `visual.spec.ts` disables CSS transitions and animations. Apply it before taking snapshots on pages with motion.

**`npm run test:visual` fails locally**  
Make sure you ran `npm run build` first — the visual tests use `vite preview` (the production build), not the dev server.
