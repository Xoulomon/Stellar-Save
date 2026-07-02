import { test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility Tests', () => {
  test('Homepage should have no critical a11y violations', async ({ page }) => {
    await page.goto('/');
    const results = await new AxeBuilder({ page }).analyze();
    if (results.violations.length > 0) {
      const criticalViolations = results.violations.filter(v => 
        ['critical', 'serious'].includes(v.impact || '')
      );
      if (criticalViolations.length > 0) {
        throw new Error(`Found critical a11y violations: ${JSON.stringify(criticalViolations, null, 2)}`);
      }
    }
  });

  test('Dashboard should have no critical a11y violations', async ({ page }) => {
    await page.goto('/dashboard');
    const results = await new AxeBuilder({ page }).analyze();
    if (results.violations.length > 0) {
      const criticalViolations = results.violations.filter(v => 
        ['critical', 'serious'].includes(v.impact || '')
      );
      if (criticalViolations.length > 0) {
        throw new Error(`Found critical a11y violations: ${JSON.stringify(criticalViolations, null, 2)}`);
      }
    }
  });
});