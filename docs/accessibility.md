# Accessibility Guide

This guide documents accessibility features, best practices, and compliance information for Stellar-Save.

---

## Keyboard Navigation

All interactive elements in the Stellar-Save frontend are reachable and operable via keyboard.

| Action | Shortcut |
|---|---|
| Navigate forward through elements | `Tab` |
| Navigate backward through elements | `Shift + Tab` |
| Activate button / link | `Enter` or `Space` |
| Close modal / dialog | `Escape` |
| Navigate list items | `Arrow Up` / `Arrow Down` |
| Select item in dropdown | `Enter` |

**Focus management**: When a modal opens, focus moves to the first interactive element inside it. When closed, focus returns to the triggering element.

---

## Screen Reader Compatibility

Stellar-Save is tested with the following screen readers:

- **NVDA** (Windows) with Firefox or Chrome
- **JAWS** (Windows) with Chrome
- **VoiceOver** (macOS / iOS) with Safari
- **TalkBack** (Android) with Chrome

### Implementation notes

- All images include descriptive `alt` text. Decorative images use `alt=""`.
- Form inputs are associated with labels via `htmlFor` / `id` pairing or `aria-label`.
- Dynamic content updates (e.g., contribution confirmed, payout executed) are announced via `aria-live="polite"` regions.
- Icon-only buttons include `aria-label` describing their action.
- Page titles update on route change so screen reader users know which view is active.
- Modals use `role="dialog"` with `aria-modal="true"` and `aria-labelledby` pointing to the dialog title.

---

## High Contrast Mode

Stellar-Save respects the operating system / browser high contrast preference via the CSS media query `prefers-contrast: more`.

### Enabling high contrast

**Windows**: Settings → Accessibility → Contrast themes → select a theme.  
**macOS**: System Settings → Accessibility → Display → Increase contrast.  
**Browser override**: Most browsers expose a high-contrast or forced-colors mode in DevTools for testing.

### What changes in high contrast mode

- Border outlines are reinforced on interactive elements.
- Background images and decorative gradients are suppressed.
- Focus indicators use `Highlight` / `ButtonText` system colors to remain visible.
- Status badges (active, paused, complete) rely on text labels in addition to color.

---

## WCAG Compliance

Stellar-Save targets **WCAG 2.1 Level AA** conformance.

| Criterion | Level | Status |
|---|---|---|
| 1.1.1 Non-text Content | A | ✅ alt text on all images |
| 1.3.1 Info and Relationships | A | ✅ semantic HTML, ARIA landmarks |
| 1.3.3 Sensory Characteristics | A | ✅ instructions do not rely on shape/color alone |
| 1.4.1 Use of Color | A | ✅ color is not the sole means of conveying information |
| 1.4.3 Contrast (Minimum) | AA | ✅ 4.5:1 for normal text, 3:1 for large text |
| 1.4.4 Resize Text | AA | ✅ layout functional at 200% zoom |
| 1.4.10 Reflow | AA | ✅ no horizontal scroll at 320 px width |
| 1.4.11 Non-text Contrast | AA | ✅ UI components meet 3:1 ratio |
| 2.1.1 Keyboard | A | ✅ all functionality keyboard accessible |
| 2.1.2 No Keyboard Trap | A | ✅ focus never trapped outside modals |
| 2.4.3 Focus Order | A | ✅ logical DOM order |
| 2.4.7 Focus Visible | AA | ✅ visible focus ring on all interactive elements |
| 3.1.1 Language of Page | A | ✅ `lang` attribute set on `<html>` |
| 3.3.1 Error Identification | A | ✅ inline validation with descriptive messages |
| 3.3.2 Labels or Instructions | A | ✅ all form fields labelled |
| 4.1.2 Name, Role, Value | A | ✅ ARIA roles and states on custom components |
| 4.1.3 Status Messages | AA | ✅ `aria-live` regions for async feedback |

Known gaps and planned improvements are tracked in GitHub Issues with the `accessibility` label.

---

## Accessibility Testing Checklist

Use this checklist before merging any UI change.

### Automated

- [ ] Run [axe-core](https://github.com/dequelabs/axe-core) (or the axe DevTools browser extension) — zero critical / serious violations
- [ ] Run [Lighthouse](https://developer.chrome.com/docs/lighthouse/) accessibility audit — score ≥ 90
- [ ] Validate color contrast with [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)

### Manual — keyboard

- [ ] Tab through the entire page; every interactive element receives focus in a logical order
- [ ] No focus traps outside intentional modal dialogs
- [ ] All actions completable without a mouse

### Manual — screen reader

- [ ] Page title announced on load and on route change
- [ ] Form labels read correctly; error messages associated with inputs
- [ ] Dynamic status updates (toasts, confirmations) announced without interrupting the user
- [ ] Modal open/close focus management works correctly

### Manual — visual

- [ ] Enable high contrast mode; all text and controls remain legible
- [ ] Zoom to 200%; no content is clipped or overlapping
- [ ] Zoom to 400% (reflow); content linearises without horizontal scroll

### Review

- [ ] Changes reviewed by at least one team member familiar with accessibility
- [ ] New ARIA patterns cross-checked against [APG patterns](https://www.w3.org/WAI/ARIA/apg/patterns/)

---

## Review Process

Accessibility review is part of the standard PR process for any frontend change:

1. Author runs the automated checklist items locally.
2. PR description includes a note on accessibility impact (or "no UI changes").
3. A reviewer performs a quick keyboard and screen reader smoke test for changes touching interactive components.
4. Issues found are either fixed before merge or tracked as follow-up issues with the `accessibility` label.

For significant UI changes or new component patterns, request a review from a team member with accessibility expertise or consult the [W3C ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/).

---

## Resources

- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [axe-core](https://github.com/dequelabs/axe-core)
- [WebAIM](https://webaim.org/)
- [Inclusive Components](https://inclusive-components.design/)
