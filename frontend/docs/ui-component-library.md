# UI Component Library Setup

This project uses **MUI** (`@mui/material`) as the UI component library.

## Installed packages

- `@mui/material`
- `@emotion/react`
- `@emotion/styled`

## Theme setup

- Theme provider: `src/ui/providers/AppThemeProvider.tsx`
- Theme object: `src/ui/theme/theme.ts`
- Custom tokens: `src/ui/theme/tokens.ts`

The app root is wrapped in `AppThemeProvider` from `src/main.tsx`.

## Theme tokens

The token file is the source of truth for:

- palette (brand colors, background, text, error, divider)
- shape (global border radius)
- spacing scale
- typography scale

Update `src/ui/theme/tokens.ts` first, then extend component overrides in `src/ui/theme/theme.ts`.

## Component wrappers

Wrappers provide a stable app-level API around MUI:

- `AppButton` in `src/ui/components/AppButton.tsx`
- `AppCard` in `src/ui/components/AppCard.tsx`
- `AppSelectField` in `src/ui/components/AppSelectField.tsx`
- `AppLayout` in `src/ui/layout/AppLayout.tsx` (header, footer, optional sidebar, mobile menu)
- Exports in `src/ui/components/index.ts`
- Re-exported from `src/ui/index.ts`

Use wrappers for app screens unless there is a specific reason to consume raw MUI components directly.

## Usage example

```tsx
import { AppButton, AppCard, AppLayout } from "./ui";

export function ExamplePanel() {
  return (
    <AppLayout title="Dashboard">
      <AppCard>
        <AppButton>Save</AppButton>
      </AppCard>
    </AppLayout>
  );
}
```

## Conventions

- Add new shared wrappers in `src/ui/components`.
- Keep wrapper names prefixed with `App`.
- Prefer token-based values over hardcoded colors in components.
