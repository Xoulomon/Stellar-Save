# Stellar Save Frontend

Frontend for Stellar Save built with React, TypeScript, and Vite.

## Scripts

- `npm run dev` start local dev server
- `npm run build` type-check and build
- `npm run lint` run ESLint
- `npm run test` run tests

## UI Component Library

This project is configured with **MUI** and a centralized theme/wrapper layer.

- Setup and usage guide: `docs/ui-component-library.md`
- Theme tokens: `src/ui/theme/tokens.ts`
- Theme creation: `src/ui/theme/theme.ts`
- Theme provider: `src/ui/providers/AppThemeProvider.tsx`
- Wrappers: `src/ui/components/index.ts`
- Layout: `src/ui/layout/AppLayout.tsx`

## Wallet Integration

Wallet integration state and adapters live in:

- `src/wallet/WalletProvider.tsx`
- `src/wallet/freighterAdapter.ts`
- `src/wallet/types.ts`
