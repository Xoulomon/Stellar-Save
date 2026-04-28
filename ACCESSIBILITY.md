# Accessibility Testing — Stellar Save

This document describes the automated accessibility testing suite for Stellar Save, how to run it, and known issues.

> **Note:** Automated tools catch roughly 30–40% of WCAG issues. Full compliance requires manual testing with assistive technologies (screen readers, keyboard-only navigation, high-contrast mode). See [Manual Testing](#manual-testing) below.

---

## Tools

| Tool | Purpose | Standard |
|------|---------|----------|
| [jest-axe](https://github.com/nickcolley/jest-axe) | axe-core violations in Vitest component tests | WCAG 2.1 AA |
| [Pa11y CI](https://github.com/pa11y/pa11y-ci) | Full-page scans against the built app | WCAG 2.1 AA |
| [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci) | Accessibility score audit per build | Lighthouse accessibility rules |
| [@axe-core/react](https://github.com/dequelabs/axe-core-npm/tree/develop/packages/react) | Runtime dev-mode warnings in the browser | WCAG 2.1 AA |

---

## Running Tests Locally

### 1. axe-core component tests (fast, no server needed)

```bash
cd frontend
npm run test:a11y          # run once
npm run test:a11y:ci       # verbose output for CI
```

These tests live in `frontend/src/test/a11y.test.tsx` and cover:

- **UI primitives:** `Input`, `Button`, `Tabs`, `Pagination`, `SearchBar`, `Spinner`
- **Feature components:** `WalletButton`, `CreateGroupForm`, `JoinGroupButton`, `ContributeButton`
- **Pages:** `LandingPage`, `NotFoundPage`, `ErrorPage`, `SettingsPage`
- **Keyboard navigation:** Tab order, arrow-key navigation in Tabs, Enter/Space on buttons, Escape to close modals
- **Screen reader attributes:** `role`, `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-live`, `aria-invalid`, `aria-selected`, `aria-current`

### 2. Pa11y full-page scan (requires built app)

```bash
cd frontend
npm run build
npm run preview &          # starts on http://localhost:4173
npm run test:a11y:pa11y    # scans all pages defined in .pa11yrc.json
```

Screenshots are saved to `frontend/pa11y-screenshots/`.

### 3. Lighthouse accessibility audit

```bash
cd frontend
npm run build
npm run lhci               # runs Lighthouse CI including accessibility audit
```

---

## CI Pipeline

The `accessibility.yml` workflow runs on every push and pull request to `main` and `develop`:

```
axe-unit  ──┐
             ├──► a11y-gate (blocks merge on failure)
pa11y     ──┤
             │
lighthouse ──┘
```

- **axe-unit** — Vitest + jest-axe component tests. Blocks the gate on failure.
- **pa11y** — Full-page WCAG 2.1 AA scan. Blocks the gate on failure.
- **lighthouse-a11y** — Lighthouse accessibility score ≥ 90. Posts a comment on PRs. Does not block the gate (score is a warning signal).

---

## What Is Tested

### WCAG 2.1 AA Criteria Covered (Automated)

| Criterion | Description | How Tested |
|-----------|-------------|------------|
| 1.1.1 Non-text Content | Images have alt text | axe, Pa11y |
| 1.3.1 Info and Relationships | Semantic HTML, labels, roles | axe, Pa11y |
| 1.3.3 Sensory Characteristics | Instructions don't rely on shape/color alone | axe |
| 1.4.3 Contrast (Minimum) | Text contrast ≥ 4.5:1 | axe, Pa11y, Lighthouse |
| 2.1.1 Keyboard | All functionality via keyboard | Vitest keyboard tests |
| 2.1.2 No Keyboard Trap | Focus can always move away | Vitest keyboard tests |
| 2.4.3 Focus Order | Logical tab order | Vitest tab tests |
| 2.4.6 Headings and Labels | Descriptive headings and labels | axe, Pa11y |
| 2.4.7 Focus Visible | Keyboard focus is visible | axe |
| 3.3.1 Error Identification | Errors identified in text | axe (aria-invalid, role=alert) |
| 3.3.2 Labels or Instructions | Form inputs have labels | axe, Pa11y |
| 4.1.2 Name, Role, Value | ARIA attributes correct | axe, Pa11y |
| 4.1.3 Status Messages | Live regions for dynamic content | axe (aria-live) |

### Components with Dedicated Tests

- `Input` — label association, `aria-invalid`, `aria-describedby`, `role="alert"` on errors
- `Button` — keyboard focus, disabled state, loading spinner `aria-hidden`
- `Tabs` — `role="tablist"`, `role="tab"`, `role="tabpanel"`, arrow-key navigation, `aria-selected`
- `Pagination` — `aria-label` on prev/next, `aria-current="page"`, labelled page-size select
- `SearchBar` — `role="searchbox"`, `aria-label`, `role="listbox"` for suggestions, `aria-hidden` on decorative icon
- `Spinner` — `role="status"`, `aria-label`, `FullPageLoader` `role="alert"`
- `WalletButton` — keyboard open/close, accessible text when connected
- `CreateGroupForm` — multi-step form, `role="progressbar"` with `aria-valuenow/min/max`, validation `role="alert"`, Tab order
- `JoinGroupButton` — all states (eligible, confirmation, disabled)
- `ContributeButton` — modal heading, keyboard dismiss with Escape
- `LandingPage` — skip link, `role="banner"`, `role="contentinfo"`, `role="navigation"` with labels, section headings
- `NotFoundPage` — `h1` heading, image alt text, keyboard-focusable buttons
- `ErrorPage` — heading, image alt text, keyboard-focusable buttons
- `SettingsPage` — radio group, shared `name` attribute, keyboard navigation

---

## Manual Testing

Automated tools cannot catch everything. The following should be tested manually before each release:

### Screen Reader Testing

| Screen Reader | Browser | Platform |
|---------------|---------|----------|
| NVDA | Firefox, Chrome | Windows |
| JAWS | Chrome, Edge | Windows |
| VoiceOver | Safari | macOS / iOS |
| TalkBack | Chrome | Android |

**Key flows to test:**
1. Landing page — read all sections in order, navigate by headings
2. Connect wallet — announce connection state changes
3. Browse groups — filter and search results announced
4. Create group — multi-step form, step progress announced, validation errors announced
5. Join group — confirmation dialog announced, focus managed
6. Contribute — modal focus trap, success/error announced
7. Settings — theme and language changes announced
8. Dashboard — loading states announced, data updates announced

### Keyboard-Only Navigation

1. Tab through every interactive element on each page
2. Verify focus indicator is always visible
3. Verify no keyboard traps (can always Tab away)
4. Verify modals trap focus correctly and restore focus on close
5. Verify dropdowns open/close with Enter/Space/Escape
6. Verify data tables are navigable with arrow keys

### High Contrast Mode

Test all pages in Windows High Contrast Mode and macOS Increase Contrast mode:
- All text remains readable
- Focus indicators remain visible
- Icons are not the sole means of conveying information

### Zoom / Text Resize

- Test at 200% browser zoom — no content clipped or overlapping
- Test with browser font size set to 200% — layout remains usable

---

## Known Issues

| Issue | Component | WCAG Criterion | Status |
|-------|-----------|----------------|--------|
| Profile page tab list missing `role="tablist"` wrapper | `ProfilePage` | 4.1.2 | Open — tabs use `role="tab"` but no `tablist` container |
| Transaction table missing column headers | `TransactionTables` | 1.3.1 | Open — `<th>` elements needed |
| Color-only status indicators in GroupCard | `GroupCard` | 1.4.1 | Open — status badges rely on color alone |
| Missing `lang` attribute on `<html>` | `index.html` | 3.1.1 | Open — add `lang="en"` |

---

## Adding New Tests

When adding a new component or page:

1. Add an axe scan to `frontend/src/test/a11y.test.tsx`:

```tsx
describe('MyComponent – accessibility', () => {
  it('has no axe violations', async () => {
    const { container } = render(<MyComponent />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
```

2. Add keyboard navigation tests for any interactive elements.

3. Add the page URL to `frontend/.pa11yrc.json` if it's a new route.

4. Run `npm run test:a11y` locally before opening a PR.

---

## Resources

- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [axe-core Rules](https://dequeuniversity.com/rules/axe/)
- [Pa11y Documentation](https://pa11y.org/)
- [Inclusive Components](https://inclusive-components.design/)
- [A11y Project Checklist](https://www.a11yproject.com/checklist/)
