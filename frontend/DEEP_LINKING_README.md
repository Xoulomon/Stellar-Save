# Deep Linking for Group Invites

This document explains the deep linking implementation for Stellar Save mobile apps.

## Features

✅ **Universal Links (iOS)** - Seamless app opening from HTTPS links  
✅ **App Links (Android)** - Verified HTTPS links open directly in app  
✅ **Custom Scheme** - Fallback for testing and SMS links  
✅ **Cold Start** - Handles links when app is not running  
✅ **Warm Start** - Handles links when app is in background  
✅ **Web Fallback** - Smart landing page with app store badges

## Quick Start

### For Developers

1. **Install dependencies** (already done if you ran `npm install`):
```bash
npm install @capacitor/core @capacitor/cli @capacitor/app @capacitor/ios @capacitor/android
```

2. **Build the web assets**:
```bash
npm run build
```

3. **Sync with native projects**:
```bash
npx cap sync
```

4. **Test on iOS Simulator**:
```bash
npx cap open ios
# In Terminal while simulator runs:
xcrun simctl openurl booted "stellarsave://join/TEST123"
```

5. **Test on Android Emulator**:
```bash
npx cap open android
# Via adb:
adb shell am start -W -a android.intent.action.VIEW -d "stellarsave://join/TEST123" com.stellarsave.app
```

## Architecture

### Files Added/Modified

```
frontend/
├── capacitor.config.ts              # Capacitor configuration
├── src/
│   ├── App.tsx                      # Added useDeepLink hook
│   ├── hooks/
│   │   └── useDeepLink.ts          # Deep link handler
│   ├── pages/
│   │   ├── JoinViaInvite.tsx       # Updated to use :inviteCode param
│   │   └── AppDownloadPage.tsx     # New web fallback page
│   └── routing/
│       ├── routes.tsx               # Added AppDownloadPage route
│       └── constants.ts             # Added APP_DOWNLOAD route
├── ios/
│   └── App/
│       ├── App/
│       │   ├── Info.plist           # Custom scheme configuration
│       │   └── App.entitlements     # Universal links configuration
│       └── fastlane/                # (from previous PR)
└── android/
    └── app/src/main/
        └── AndroidManifest.xml      # (needs manual update, see docs/)

docs/
├── deep-linking-setup.md            # Complete setup guide
├── android-manifest-deep-link-config.xml  # Android config snippet
├── apple-app-site-association.json  # iOS universal links config
└── assetlinks.json                  # Android app links config
```

### Flow Diagram

```
┌─────────────────────────────────────┐
│ User receives invite link           │
│ https://stellarsave.app/join/ABC123 │
└──────────────┬──────────────────────┘
               │
               ▼
       ┌───────────────┐
       │ Is app        │
       │ installed?    │
       └───┬───────┬───┘
           │       │
     Yes   │       │   No
           │       │
           ▼       ▼
    ┌──────────┐  ┌────────────────┐
    │ Open app │  │ Web fallback   │
    │ directly │  │ AppDownloadPage│
    └─────┬────┘  └────────┬───────┘
          │                 │
          ▼                 ▼
    ┌──────────┐     ┌─────────────┐
    │useDeepLink│    │Try to open  │
    │ hook      │    │app (2s wait)│
    └─────┬─────┘    └──────┬──────┘
          │                  │
          ▼                  ▼
    ┌──────────┐      ┌────────────┐
    │Navigate  │      │Show app    │
    │to /join/ │      │store badges│
    │:inviteCode      │or continue │
    └──────┬───┘      │in browser  │
           │          └────────────┘
           ▼
    ┌──────────────┐
    │JoinViaInvite │
    │  component   │
    └──────────────┘
```

## URL Schemes

The app supports three types of deep links:

### 1. Universal/App Links (Production)
```
https://stellarsave.app/join/ABC123
https://app.stellarsave.app/join/ABC123
```

**Requirements:**
- Hosted `.well-known/apple-app-site-association` (iOS)
- Hosted `.well-known/assetlinks.json` (Android)
- Valid SSL certificate
- Domain verification

### 2. Custom Scheme (Testing & SMS)
```
stellarsave://join/ABC123
```

**Advantages:**
- Works immediately, no domain verification needed
- Ideal for local development and testing
- Works in SMS messages

### 3. App Download Fallback
```
https://stellarsave.app/app/ABC123
```

Used when generating shareable links to ensure non-users get prompted to download the app.

## Components

### useDeepLink Hook

Location: `frontend/src/hooks/useDeepLink.ts`

Automatically handles deep link events:
- Listens to `appUrlOpen` event (warm start)
- Checks launch URL (cold start)
- Parses URL and extracts route
- Navigates using React Router

```typescript
// Automatically initialized in App.tsx
export default function App() {
  useDeepLink(); // ← Handles all deep links
  return <AppRouter />;
}
```

### JoinViaInvite Component

Location: `frontend/src/pages/JoinViaInvite.tsx`

Updated to accept invite code as URL parameter:
- Route: `/join/:inviteCode`
- Displays invite information
- Handles wallet connection
- Joins group on confirmation

### AppDownloadPage Component

Location: `frontend/src/pages/AppDownloadPage.tsx`

Web fallback for users without the app:
- Route: `/app/:inviteCode`
- Attempts to open app via custom scheme
- Shows App Store / Play Store badges
- Provides "Continue in browser" option

## Production Deployment

### Step 1: Host Verification Files

**iOS - Apple App Site Association**

Host at: `https://stellarsave.app/.well-known/apple-app-site-association`

```json
{
  "applinks": {
    "apps": [],
    "details": [{
      "appID": "YOUR_TEAM_ID.com.stellarsave.app",
      "paths": ["/join/*", "/app/*"]
    }]
  }
}
```

**Android - Digital Asset Links**

Host at: `https://stellarsave.app/.well-known/assetlinks.json`

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.stellarsave.app",
    "sha256_cert_fingerprints": ["YOUR_SHA256_FINGERPRINT"]
  }
}]
```

### Step 2: Update Configuration

1. Replace `YOUR_TEAM_ID` in AASA file
2. Get production SHA256 fingerprint:
```bash
keytool -list -v -keystore your-release-key.keystore
```
3. Update `assetlinks.json` with production fingerprint

### Step 3: Update Android Manifest

Copy configuration from `docs/android-manifest-deep-link-config.xml` into your `MainActivity` in `frontend/android/app/src/main/AndroidManifest.xml`.

### Step 4: Verify

**iOS:**
```bash
# Verify AASA file
curl https://stellarsave.app/.well-known/apple-app-site-association

# Test on device
Send test link via Messages app
```

**Android:**
```bash
# Verify assetlinks
curl https://stellarsave.app/.well-known/assetlinks.json

# Check verification status
adb shell pm get-app-links com.stellarsave.app
```

## Generating Invite Links

In your share functionality:

```typescript
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { buildRoute } from './routing/constants';

async function shareInvite(groupId: string) {
  // Generate unique invite code (implement your logic)
  const inviteCode = generateInviteCode(groupId);
  
  // Use app download route for better conversion
  const inviteLink = `https://stellarsave.app/app/${inviteCode}`;
  
  if (Capacitor.isNativePlatform()) {
    // Use native sharing
    await Share.share({
      title: 'Join my Stellar Save group',
      text: `I'm saving with Stellar Save. Join my group!`,
      url: inviteLink,
      dialogTitle: 'Share group invite',
    });
  } else {
    // Web fallback - copy to clipboard
    await navigator.clipboard.writeText(inviteLink);
    alert('Link copied to clipboard!');
  }
}
```

## Testing Checklist

- [ ] Custom scheme works in iOS Simulator
- [ ] Custom scheme works in Android Emulator
- [ ] Universal links work on physical iOS device
- [ ] App links work on physical Android device
- [ ] Cold start (app not running) works
- [ ] Warm start (app in background) works
- [ ] Web fallback displays correctly
- [ ] Web fallback opens app when installed
- [ ] App store badges link correctly
- [ ] "Continue in browser" works

## Troubleshooting

### Links Open in Browser Instead of App

**iOS:**
- Universal links don't work from Safari address bar
- Must be tapped in context (Messages, Mail, etc.)
- Verify AASA file is accessible without redirects
- Check Team ID is correct

**Android:**
- Run: `adb logcat | grep -i intentfilter`
- Check for verification errors
- Ensure `android:autoVerify="true"` is set
- Verify SHA256 fingerprint matches

### App Doesn't Navigate to Correct Screen

- Check useDeepLink hook is initialized in App.tsx
- Verify route exists in routes.tsx
- Check console for navigation errors
- Ensure Capacitor plugins are installed

### Web Fallback Not Working

- Check route is registered: `/app/:inviteCode`
- Verify AppDownloadPage component renders
- Check browser console for errors
- Test app store links are valid

## References

- [Capacitor Deep Links Guide](https://capacitorjs.com/docs/guides/deep-links)
- [iOS Universal Links](https://developer.apple.com/documentation/xcode/supporting-universal-links-in-your-app)
- [Android App Links](https://developer.android.com/training/app-links)
- [Complete Setup Guide](../docs/deep-linking-setup.md)

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review logs: iOS (Xcode console) / Android (`adb logcat`)
3. Consult the complete setup guide in `docs/deep-linking-setup.md`
