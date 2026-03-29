# Visual Regression Testing

Stellar-Save uses **Percy** (by BrowserStack) with **Playwright** to catch unintended UI changes via automated snapshot comparison.

## How it works

On every PR, Percy takes screenshots of key UI surfaces and compares them against the approved baseline. If pixels differ beyond the threshold, the Percy check on the PR fails and a reviewer must approve or reject the visual diff in the Percy dashboard before merging.

On merge to `main`, the new snapshots automatically become the new baseline.

## Required CI secret

Add the following secret to your GitHub repository (**Settings → Secrets and variables → Actions**):

| Secret name | Where to get it |
|---|---|
| `PERCY_TOKEN` | [Percy dashboard](https://percy.io) → your project → **Project settings → Token** |

The CI workflow (`visual-regression.yml`) skips silently if `PERCY_TOKEN` is not set, so forks without the secret won't fail.

## Snapshots captured

| Snapshot name | Route |
|---|---|
| Landing page | `/` |
| Wallet button - disconnected | `/` |
| Browse Groups - empty state | `/groups/browse` |
| Create Group form - step 1 empty | `/groups/create` |
| Create Group form - step 1 validation errors | `/groups/create` |
| Create Group form - step 2 financial settings | `/groups/create` |
| Create Group form - step 4 review | `/groups/create` |
| 404 Not Found page | `/this-route-does-not-exist` |

## Running locally

```bash
# Set your Percy token
export PERCY_TOKEN=your_token_here

cd frontend
npm run test:visual
```

This starts the Vite dev server, runs Playwright, and uploads snapshots to Percy.

## Updating baselines intentionally

When you make a deliberate UI change:

1. Open the Percy build for your PR at [percy.io](https://percy.io)
2. Review each changed snapshot
3. Click **Approve** on the diffs that are intentional
4. The PR check turns green and the new snapshots become the baseline on merge

## Adding new snapshots

Add a new `test()` block in `frontend/src/test/visual/visual.spec.ts`:

```ts
test('My new component — some state', async ({ page }) => {
  await page.goto('/my-route');
  await freezeAnimations(page);
  await page.waitForLoadState('networkidle');
  await percySnapshot(page, 'My new component - some state');
});
```

Snapshot names must be unique across the project.
