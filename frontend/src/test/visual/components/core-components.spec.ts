/**
 * Component visual regression tests using Playwright toHaveScreenshot().
 *
 * Captures light and dark PNG baselines of core UI primitives rendered on
 * the standalone visual-gallery.html entry (built by `npm run build:visual`).
 * The same fixtures also live on the env-gated `/__visual__/components` SPA
 * route. Baselines are committed next to this spec. See
 * docs/visual-regression.md for the approval process.
 *
 *   npm run test:visual:components
 *   npm run test:visual:components:update
 */
import { expect, test, type Page } from '@playwright/test';
import { freezeAnimations } from '../helpers';

const SECTIONS = [
  { testId: 'visual-button', snapshot: 'button-matrix' },
  { testId: 'visual-app-button', snapshot: 'app-button-matrix' },
  { testId: 'visual-input', snapshot: 'input-matrix' },
  { testId: 'visual-card', snapshot: 'card-matrix' },
  { testId: 'visual-dialog', snapshot: 'dialog-open' },
  { testId: 'visual-tabs', snapshot: 'tabs-matrix' },
  { testId: 'visual-badge', snapshot: 'badge-matrix' },
  { testId: 'visual-search', snapshot: 'search-bar' },
  { testId: 'visual-states', snapshot: 'page-states' },
  { testId: 'visual-skeleton', snapshot: 'skeleton-matrix' },
  { testId: 'visual-group-card', snapshot: 'group-card' },
  { testId: 'visual-toast', snapshot: 'toast-matrix' },
] as const;

async function openGallery(page: Page, theme: 'light' | 'dark') {
  await page.goto(`/visual-gallery.html?theme=${theme}`);
  await freezeAnimations(page);
  await page.addStyleTag({
    content: `*, *::before, *::after { animation: none !important; }`,
  });
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(
    (expected) => document.documentElement.getAttribute('data-theme') === expected,
    theme
  );
  await page.getByTestId('visual-gallery').waitFor();
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(`core components — ${theme}`, () => {
    test.beforeEach(async ({ page }) => {
      await openGallery(page, theme);
    });

    for (const section of SECTIONS) {
      test(`${section.snapshot}`, async ({ page }) => {
        const locator = page.getByTestId(section.testId);
        await expect(locator).toBeVisible();
        await expect(locator).toHaveScreenshot(`${section.snapshot}-${theme}.png`);
      });
    }
  });
}
