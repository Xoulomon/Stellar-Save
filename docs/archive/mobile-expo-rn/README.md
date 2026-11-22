# Stellar Save Mobile

Native iOS/Android mobile application for Stellar Save built with Expo (React Native + TypeScript).

## Setup & Development

### Prerequisites
- Node.js (v18+)
- pnpm (v8+)
- Expo CLI
- iOS Simulator (macOS + Xcode) or Android Emulator (Android Studio)

### Installation & Local Run
```bash
# Navigate to mobile directory
cd mobile

# Install dependencies
pnpm install

# Start Expo development server (opens Expo Dev Tools)
pnpm start

# Launch on iOS Simulator
pnpm ios

# Launch on Android Emulator
pnpm android
```

## Environment Configuration

Configure Expo environment variables in `.env` or `app.json`:
- `EXPO_PUBLIC_SENTRY_DSN`: Crash reporting and telemetry endpoint.
- `EXPO_PUBLIC_STELLAR_NETWORK`: Target network (`testnet`, `mainnet`, etc.).

## Project Structure

```
mobile/
├── App.tsx             # Main application entry point
├── src/
│   ├── navigation/     # React Navigation stack & tabs
│   └── screens/        # UI Screen components (Dashboard, JoinGroup, etc.)
├── app.json            # Expo project configuration
└── package.json        # Dependencies & scripts
```

## Code Conventions & Standards

- ESLint & Prettier configs extend root `eslint.config.base.js` and `.prettierrc`.
- Commit messages follow Conventional Commits enforced by Husky & commitlint.
