# Stellar Save Mobile Apps

Native iOS and Android applications built with Capacitor, wrapping the Stellar Save web application.

## Quick Start

### Prerequisites

- Node.js 20+
- For iOS: macOS with Xcode 15+
- For Android: JDK 17+

### Development

```bash
# Install dependencies
npm install

# Build web assets
npm run build

# Sync with native projects
npx cap sync

# Open in IDE
npx cap open ios     # Opens Xcode
npx cap open android # Opens Android Studio
```

### Running

**iOS Simulator:**
```bash
npm run build
npx cap run ios
```

**Android Emulator:**
```bash
npm run build
npx cap run android
```

## Project Structure

```
frontend/
├── src/              # Web application source
├── dist/             # Built web assets (copied to native)
├── ios/              # iOS native project
│   ├── App/          # Xcode project
│   └── fastlane/     # iOS automation
├── android/          # Android native project
│   ├── app/          # Android Studio project
│   └── fastlane/     # Android automation
└── capacitor.config.ts # Capacitor configuration
```

## Building for Release

### iOS (TestFlight)

```bash
cd ios
bundle install
bundle exec fastlane beta
```

### Android (Play Console)

```bash
cd android
bundle install
bundle exec fastlane beta
```

## CI/CD

Automated builds and distribution are handled by GitHub Actions:

- **mobile.yml**: CI on every PR (lint, test, build)
- **mobile-release.yml**: Manual release to TestFlight and Play Console

See [docs/mobile-cicd-setup.md](../docs/mobile-cicd-setup.md) for complete setup guide.

## Configuration

### App ID

- **iOS**: `com.stellarsave.app`
- **Android**: `com.stellarsave.app`

### Capacitor Config

Edit `capacitor.config.ts` to modify:
- App name and ID
- Server configuration
- Plugin settings
- Platform-specific options

### Native Code

- **iOS**: `ios/App/App/` - Swift/Objective-C code
- **Android**: `android/app/src/main/java/` - Java/Kotlin code

## Plugins

Currently using:
- `@capacitor/core` - Core runtime
- `@capacitor/splash-screen` - Splash screen

To add more plugins:
```bash
npm install @capacitor/plugin-name
npx cap sync
```

Popular plugins:
- `@capacitor/camera` - Camera access
- `@capacitor/geolocation` - Location
- `@capacitor/push-notifications` - Push notifications
- `@capacitor/share` - Native sharing

## Debugging

### iOS

```bash
# View logs
npx cap open ios
# In Xcode: Product → Run
# View logs in Console.app
```

### Android

```bash
# View logs
npx cap open android
# In Android Studio: Run → Debug
# View logs in Logcat
```

### Web Inspector

**iOS:**
1. Enable Web Inspector in Safari → Develop
2. Run app on simulator
3. Safari → Develop → Simulator → Inspect

**Android:**
1. Enable USB debugging
2. Chrome → `chrome://inspect`
3. Select your device

## Common Issues

### "No such module" (iOS)

```bash
cd ios/App
pod install
```

### "SDK location not found" (Android)

Create `android/local.properties`:
```properties
sdk.dir=/Users/YOUR_USERNAME/Library/Android/sdk
```

### Web assets not updating

```bash
npm run build
npx cap sync
```

## Accessibility

Stellar Save is designed to be fully accessible with screen readers from the start. This section documents the accessibility conventions for the mobile apps.

### Screen Reader Support

The mobile apps use VoiceOver (iOS) and TalkBack (Android) to provide accessible navigation. All interactive elements must have accessible labels.

### Web Components (Capacitor WebView)

Since the mobile apps wrap the web application in a Capacitor WebView, web accessibility standards apply:

- **Buttons**: All `<button>` elements must have an `aria-label` or visible text content
- **Links**: All `<a>` elements must have descriptive text or `aria-label`
- **Images**: All `<img>` elements must have an `alt` attribute
- **Form inputs**: All inputs must have an associated `<label>` or `aria-label`
- **Modals**: Must have `role="dialog"`, `aria-modal="true"`, and `aria-labelledby`
- **Interactive divs**: Any `<div>` with `onClick` must have `role="button"`, `tabIndex={0}`, and `aria-label`

### React Component Conventions

When creating new React components:

1. **Use semantic HTML**: `<button>` for actions, `<a>` for navigation, `<input>` with `<label>` for forms
2. **ARIA labels**: Always provide `aria-label` for icon-only buttons
3. **Keyboard navigation**: Ensure all interactive elements are focusable and respond to Enter/Space
4. **Focus management**: Modals should trap focus and return focus on close
5. **Live regions**: Use `aria-live="polite"` for status updates and `aria-live="assertive"` for errors
6. **Roles**: Use appropriate ARIA roles (`tablist`, `tab`, `tabpanel`, `dialog`, `alert`, etc.)

### Testing

Before submitting a PR:

1. Run `npm run test:a11y` to run automated accessibility tests
2. Test on a real device with VoiceOver (iOS) or TalkBack (Android)
3. Verify all interactive elements are announced correctly
4. Verify logical focus order when swiping through screens

### Known Issues

See `ACCESSIBILITY.md` in the project root for the full list of known accessibility issues and their status.

### Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [iOS Development Guide](https://developer.apple.com/documentation/)
- [Android Development Guide](https://developer.android.com/guide)
- [Fastlane Documentation](https://docs.fastlane.tools)
- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)

## Support

- Report issues: GitHub Issues
- Discuss: GitHub Discussions
- Mobile CI/CD: See `docs/mobile-cicd-setup.md`
