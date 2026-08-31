# Visual Regression Testing

Stellar-Save uses two complementary Playwright visual suites:

| Suite                     | What it covers                                                          | Where baselines live       | Approval                                      |
| ------------------------- | ----------------------------------------------------------------------- | -------------------------- | --------------------------------------------- |
| **Percy (pages)**         | Full-page snapshots of key routes, including the 6-device mobile matrix | Percy cloud                | Approve in the Percy dashboard                |
| **Component screenshots** | Isolated core UI primitives on the visual gallery                       | PNG files committed in git | Review and commit updated PNGs in the same PR |

Percy catches layout drift in assembled pages. Component screenshots catch CSS/token drift in `frontend/src/components` and `frontend/src/ui` without a Percy token, so they also run on forks.

## How Percy works

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

| Command                                 | Description                                                       |
| --------------------------------------- | ----------------------------------------------------------------- |
| `npm run test:visual`                   | Percy page snapshots locally (list reporter; needs `PERCY_TOKEN`) |
| `npm run test:visual:ci`                | Percy page snapshots in CI (GitHub reporter)                      |
| `npm run test:visual:components`        | Build the visual gallery and compare committed PNG baselines      |
| `npm run test:visual:components:update` | Rebuild baselines after an intentional visual change              |

Component tests use `vite preview` on port 4173. `test:visual:components` runs `build:visual` first so `visual-gallery.html` is in `dist/`.

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

## Approving Percy baseline changes

When intentional **page-level** UI changes are made:

1. Open the Percy build from the PR checks.
2. Review each changed snapshot.
3. Click **Approve** for expected changes.
4. The PR check turns green and the new screenshots become the baseline.

## Component screenshot baselines

Core primitives (Button, Input, Card, Dialog, Tabs, Badge, SearchBar, Empty/Loading/Error states, Skeleton, GroupCard, Toast, and the MUI `AppButton`/`AppCard` wrappers) are rendered on a standalone gallery page compiled by `npm run build:visual` (`frontend/visual-gallery.html`).

Playwright opens `/visual-gallery.html?theme=light|dark` and clips each `data-testid` section against PNGs in:

`frontend/src/test/visual/components/core-components.spec.ts-snapshots/`

The same fixtures are also registered on the SPA route `/__visual__/components` when `VITE_VISUAL_GALLERY=true`, so a full-app build with that flag can preview them in-router. A production `npm run build` (flag off) omits both the HTML entry and the SPA route.

Each section is captured in **light** and **dark** (`?theme=light|dark`). Diff tolerance is `maxDiffPixelRatio: 0.001` (0.1%) to absorb antialiasing without missing layout or radius drift.

### Approving intentional component visual changes

1. Review the Playwright HTML report (`frontend/playwright-report/`) or the `-diff.png` files from the CI artifact `component-visual-test-results`.
2. Confirm diffs are limited to the components you changed. Unrelated section failures mean the change leaked into shared tokens.
3. From `frontend/`:

   ```bash
   npm run test:visual:components:update
   ```

4. Commit the updated PNGs **in the same PR** as the CSS/component change.
5. Reviewers treat snapshot PNG diffs as part of the review (same bar as code).

When a visual change is **unintentional**, do not update snapshots — fix the CSS or component instead.

### Linux-only baselines

PNG baselines are generated on Linux (local Linux machines and `ubuntu-latest` CI). Font and subpixel rendering differ on macOS and Windows, so do **not** regenerate snapshots from those hosts. Update them via:

- CI artifacts after a Linux run, or
- Playwright’s Docker image: `mcr.microsoft.com/playwright`

### Adding a new component snapshot

1. Add a fixture section with a stable `data-testid` on `frontend/src/pages/VisualGalleryPage.tsx`.
2. Register it in the `SECTIONS` array in `frontend/src/test/visual/components/core-components.spec.ts`.
3. Run `npm run test:visual:components:update` and commit the new PNGs.

## Member badge gallery baseline

The member badge gallery is covered by three snapshot pairs (light + dark):

| Snapshot                                   | Route               | Spec             |
| ------------------------------------------ | ------------------- | ---------------- |
| `Member badge gallery - directory`         | `/groups/1/members` | `visual.spec.ts` |
| `Member badge gallery - profile badges`    | `/members/:address` | `visual.spec.ts` |
| `Mobile: Member badge gallery - directory` | `/groups/1/members` | `mobile.spec.ts` |

Both routes render from fixture data, so the snapshots are deterministic across
runs. `freezeAnimations()` is applied before every capture because badge chips
animate on mount.

### Updating the badge gallery baseline

Follow this when a badge style change is intentional:

1. Push the branch and wait for the Percy check to report **needs review**.
2. Open the Percy build and confirm every diff is limited to the badge surfaces
   you touched. Diffs on unrelated snapshots mean the change leaked into shared
   theme tokens and should be narrowed first.
3. Check both the light and dark variant of each pair. Approving only one leaves
   the other pair member as a stale baseline.
4. Click **Approve** on the build. The approved screenshots become the new
   baseline for `main`.
5. If a diff appears without any intended change, re-run
   `npm run test:visual` twice before approving; a diff that does not reproduce
   is flake, not drift, and should be reported rather than approved.

## Mobile visual regression

Mobile baselines are captured in `frontend/src/test/visual/mobile.spec.ts`.
Each screen is snapshotted in both light and dark mode across six device profiles:

| Project name              | Device                      |
| ------------------------- | --------------------------- |
| `desktop-1280`            | Desktop Chrome 1280x720     |
| `mobile-pixel5`           | Pixel 5 (393x851)           |
| `mobile-pixel7`           | Pixel 7 (412x915)           |
| `mobile-iphone14`         | iPhone 14 (390x844)         |
| `mobile-iphone14-pro-max` | iPhone 14 Pro Max (430x932) |
| `tablet-ipad-pro`         | iPad Pro 11 (834x1194)      |

Percy groups all device snapshots under the same snapshot name so you can
compare layouts side by side in the review UI.

### Updating mobile baselines

1. Make your intentional UI change and open a PR.
2. The Percy check will show diffs for every affected device/mode combination.
3. Open the Percy build link from the PR checks.
4. Review each diff image - Percy shows a before/after overlay.
5. Click **Approve** for each expected change. The check turns green and the
   new screenshots become the baseline.

Only reviewers with write access to the Percy project can approve baselines.
Approvals are tracked per-build in the Percy audit log.

### Adding new mobile snapshots

Add a `test()` block in `frontend/src/test/visual/mobile.spec.ts` and use
`snapshotBothModes(page, 'Unique snapshot name')` to capture light and dark
variants automatically. The name must be globally unique across both spec files.

## Configuration

| File                                                          | Purpose                                                  |
| ------------------------------------------------------------- | -------------------------------------------------------- |
| `frontend/playwright.visual.config.ts`                        | Percy Playwright config; device project matrix           |
| `frontend/playwright.component-visual.config.ts`              | Component screenshot config (Chromium, committed PNGs)   |
| `frontend/src/test/visual/visual.spec.ts`                     | Desktop Percy snapshot suite                             |
| `frontend/src/test/visual/mobile.spec.ts`                     | Mobile/tablet Percy snapshot suite                       |
| `frontend/src/test/visual/components/core-components.spec.ts` | Component PNG screenshot suite                           |
| `frontend/src/test/visual/helpers.ts`                         | Shared `freezeAnimations` / wallet mock helpers          |
| `frontend/src/pages/VisualGalleryPage.tsx`                    | Env-gated fixture gallery (SPA route + standalone entry) |
| `frontend/visual-gallery.html`                                | Standalone Vite entry used by `build:visual`             |
| `frontend/src/visual-gallery-main.tsx`                        | Mounts the gallery without the rest of the app           |
| `.github/workflows/visual-regression.yml`                     | Percy job + always-on component screenshot job           |

## Diff thresholds

Percy's default diff threshold is **0%** (any pixel change triggers a review). To adjust sensitivity, configure it in the Percy dashboard under **Project → Settings → Diff sensitivity**.

## Troubleshooting

**Percy check is skipped in CI**  
The workflow only runs when `PERCY_TOKEN` is set. Forks without the secret will skip the job gracefully.

**Flaky snapshots due to animations**  
The test helper `freezeAnimations()` in `frontend/src/test/visual/helpers.ts` disables CSS transitions and animations. Apply it before taking snapshots on pages with motion.

**`npm run test:visual` fails locally**  
Make sure you ran `npm run build` first — the Percy visual tests use `vite preview` (the production build), not the dev server.

**`npm run test:visual:components` 404s on the gallery**  
The gallery is a separate Vite entry (`visual-gallery.html`) produced only by `npm run build:visual`. If `vite preview` was already running against an older `dist/`, stop it so Playwright can start a fresh preview server.

**Component screenshot job vs Percy**  
The component job always runs and does not need `PERCY_TOKEN`. It never passes `--update-snapshots`; baseline updates happen in the PR as committed PNGs.
