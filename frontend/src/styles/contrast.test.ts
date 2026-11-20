/**
 * WCAG AA colour-contrast regression tests (issue #2035).
 *
 * Verifies that the design tokens defined in src/index.css meet
 * WCAG 2.1 AA contrast thresholds:
 *   - 4.5 : 1 for normal text
 *   - 3.0 : 1 for large text and UI components (icons, borders, etc.)
 *
 * We test the raw hex values used in the token definitions — this is
 * simpler and more reliable than querying CSS custom properties from jsdom,
 * which would require injecting the stylesheet into the document.
 *
 * Add a new pair here whenever a new colour token is introduced.
 */
import { describe, it, expect } from 'vitest';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** sRGB relative luminance per WCAG 2.1 §1.4.3 */
function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(fg: string, bg: string): number {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Assert that fg : bg ≥ minRatio and report a readable failure message. */
function expectContrast(fg: string, bg: string, minRatio: number, label: string): void {
  const ratio = contrastRatio(fg, bg);
  expect(
    ratio,
    `${label}: expected ≥ ${minRatio}:1 but got ${ratio.toFixed(2)}:1 (${fg} on ${bg})`
  ).toBeGreaterThanOrEqual(minRatio);
}

// ── Light-theme token values ──────────────────────────────────────────────────

const LIGHT = {
  bg: '#edf4ff',
  bgPaper: '#ffffff',
  bgSecondary: '#f3f4f6',
  textPrimary: '#152247',
  textSecondary: '#4e5b82',
  primary: '#1f4fd4',
  headerBg: '#1a2a5e',
  headerText: '#ffffff',
  headerNav: '#b0bde8',
  success: '#047857',       // fixed from #10b981
  successBg: '#f0f9f4',
  successText: '#166534',
  warning: '#b45309',       // fixed from #f59e0b
  warningBg: '#fffbeb',
  warningText: '#92400e',
  danger: '#dc2626',
  dangerBg: '#fff5f5',
  dangerText: '#991b1b',
};

// ── Dark-theme token values ───────────────────────────────────────────────────

const DARK = {
  bg: '#0f1623',
  bgPaper: '#1a2236',
  textPrimary: '#e8edf8',
  textSecondary: '#9aaac8',
  primary: '#5d8cf2',
  headerBg: '#0d1420',
  headerText: '#e8edf8',
  headerNav: '#7a8fb8',
  success: '#34d399',
  successBg: '#0d2b21',
  successText: '#86efac',
  warning: '#fbbf24',
  warningBg: '#3a2e0d',
  warningText: '#fde68a',
  danger: '#f87171',
  dangerBg: '#3a1414',
  dangerText: '#fca5a5',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('WCAG AA colour contrast — light theme (issue #2035)', () => {
  const AA = 4.5;
  const AA_UI = 3.0;

  it('text-primary on bg ≥ 4.5:1', () =>
    expectContrast(LIGHT.textPrimary, LIGHT.bg, AA, 'text-primary/bg'));

  it('text-primary on bg-paper ≥ 4.5:1', () =>
    expectContrast(LIGHT.textPrimary, LIGHT.bgPaper, AA, 'text-primary/bg-paper'));

  it('text-secondary on bg ≥ 4.5:1', () =>
    expectContrast(LIGHT.textSecondary, LIGHT.bg, AA, 'text-secondary/bg'));

  it('text-secondary on bg-paper ≥ 4.5:1', () =>
    expectContrast(LIGHT.textSecondary, LIGHT.bgPaper, AA, 'text-secondary/bg-paper'));

  it('primary on bg-paper ≥ 4.5:1', () =>
    expectContrast(LIGHT.primary, LIGHT.bgPaper, AA, 'primary/bg-paper'));

  it('primary on bg ≥ 4.5:1', () =>
    expectContrast(LIGHT.primary, LIGHT.bg, AA, 'primary/bg'));

  it('header-text on header-bg ≥ 4.5:1', () =>
    expectContrast(LIGHT.headerText, LIGHT.headerBg, AA, 'header-text/header-bg'));

  it('header-nav on header-bg ≥ 3:1 (large/UI)', () =>
    expectContrast(LIGHT.headerNav, LIGHT.headerBg, AA_UI, 'header-nav/header-bg'));

  // Status — fixed tokens (issue #2035)
  it('success on bg ≥ 4.5:1 (was #10b981 = 2.36:1 — fixed to #047857)', () =>
    expectContrast(LIGHT.success, LIGHT.bg, AA, 'success/bg'));

  it('success on bg-paper ≥ 4.5:1', () =>
    expectContrast(LIGHT.success, LIGHT.bgPaper, AA, 'success/bg-paper'));

  it('success on success-bg ≥ 4.5:1', () =>
    expectContrast(LIGHT.success, LIGHT.successBg, AA, 'success/success-bg'));

  it('success-text on success-bg ≥ 4.5:1', () =>
    expectContrast(LIGHT.successText, LIGHT.successBg, AA, 'success-text/success-bg'));

  it('warning on bg ≥ 4.5:1 (was #f59e0b = 2.07:1 — fixed to #b45309)', () =>
    expectContrast(LIGHT.warning, LIGHT.bg, AA, 'warning/bg'));

  it('warning on bg-paper ≥ 4.5:1', () =>
    expectContrast(LIGHT.warning, LIGHT.bgPaper, AA, 'warning/bg-paper'));

  it('warning on warning-bg ≥ 4.5:1', () =>
    expectContrast(LIGHT.warning, LIGHT.warningBg, AA, 'warning/warning-bg'));

  it('warning-text on warning-bg ≥ 4.5:1', () =>
    expectContrast(LIGHT.warningText, LIGHT.warningBg, AA, 'warning-text/warning-bg'));

  it('danger on danger-bg ≥ 4.5:1', () =>
    expectContrast(LIGHT.danger, LIGHT.dangerBg, AA, 'danger/danger-bg'));

  it('danger-text on danger-bg ≥ 4.5:1', () =>
    expectContrast(LIGHT.dangerText, LIGHT.dangerBg, AA, 'danger-text/danger-bg'));
});

describe('WCAG AA colour contrast — dark theme (issue #2035)', () => {
  const AA = 4.5;
  const AA_UI = 3.0;

  it('text-primary on bg ≥ 4.5:1', () =>
    expectContrast(DARK.textPrimary, DARK.bg, AA, 'text-primary/bg'));

  it('text-primary on bg-paper ≥ 4.5:1', () =>
    expectContrast(DARK.textPrimary, DARK.bgPaper, AA, 'text-primary/bg-paper'));

  it('text-secondary on bg ≥ 4.5:1', () =>
    expectContrast(DARK.textSecondary, DARK.bg, AA, 'text-secondary/bg'));

  it('primary on bg-paper ≥ 4.5:1', () =>
    expectContrast(DARK.primary, DARK.bgPaper, AA, 'primary/bg-paper'));

  it('header-text on header-bg ≥ 4.5:1', () =>
    expectContrast(DARK.headerText, DARK.headerBg, AA, 'header-text/header-bg'));

  it('header-nav on header-bg ≥ 3:1 (large/UI)', () =>
    expectContrast(DARK.headerNav, DARK.headerBg, AA_UI, 'header-nav/header-bg'));

  it('success on bg ≥ 4.5:1', () =>
    expectContrast(DARK.success, DARK.bg, AA, 'success/bg'));

  it('success on success-bg ≥ 4.5:1', () =>
    expectContrast(DARK.success, DARK.successBg, AA, 'success/success-bg'));

  it('success-text on success-bg ≥ 4.5:1', () =>
    expectContrast(DARK.successText, DARK.successBg, AA, 'success-text/success-bg'));

  it('warning on bg ≥ 4.5:1', () =>
    expectContrast(DARK.warning, DARK.bg, AA, 'warning/bg'));

  it('warning on warning-bg ≥ 4.5:1', () =>
    expectContrast(DARK.warning, DARK.warningBg, AA, 'warning/warning-bg'));

  it('warning-text on warning-bg ≥ 4.5:1', () =>
    expectContrast(DARK.warningText, DARK.warningBg, AA, 'warning-text/warning-bg'));

  it('danger on danger-bg ≥ 4.5:1', () =>
    expectContrast(DARK.danger, DARK.dangerBg, AA, 'danger/danger-bg'));

  it('danger-text on danger-bg ≥ 4.5:1', () =>
    expectContrast(DARK.dangerText, DARK.dangerBg, AA, 'danger-text/danger-bg'));
});
