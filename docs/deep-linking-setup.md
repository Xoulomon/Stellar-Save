# Deep Linking Setup Guide

This document explains how deep linking is configured for Stellar Save mobile apps and how to test it.

## Overview

Deep linking allows users to open the Stellar Save mobile app directly from invite links shared via SMS, email, or the web. The implementation supports:

- **Universal Links (iOS)** - Opens the app when users tap `https://stellarsave.app/join/ABC123`
- **App Links (Android)** - Opens the app when users tap `https://stellarsave.app/join/ABC123`
- **Custom Scheme** - Falls back to `stellarsave://join/ABC123` for testing

## How It Works

### 1. URL Schemes Supported

The app recognizes these URL patterns:

```
stellarsave://join/:inviteCode          (Custom scheme)
https://stellarsave.app/join/:inviteCode (Universal/App Link)
https://app.stellarsave.app/join/:inviteCode (Subdomain)
```

### 2. Flow

```
User clicks invite link
    ↓
Is app installed?
    ├─ Yes → Opens app directly to join flow
    └─ No → Shows web fallback with app store badges
```

## iOS Configuration

### Info.plist

Located at `frontend/ios/App/App/Info.plist`:

```xml
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLName</key>
        <string>com.stellarsave.app</string>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>stellarsave</string>
        </array>
    </dict>
</array>
```

### Entitlements

Located at `frontend/ios/App/App/App.entitlements`:

```xml
<key>com.apple.developer.associated-domains</key>
<array>
    <string>applinks:stellarsave.app</string>
    <string>applinks:app.stellarsave.app</string>
</array>
```

### Apple App Site Association (AASA)

You need to host this file at `https://stellarsave.app/.well-known/apple-app-site-association`:

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAM_ID.com.stellarsave.app",
        "paths": ["/join/*", "/app/*"]
      }
    ]
  }
}
```

Replace `TEAM_ID` with your Apple Developer Team ID.

## Android Configuration

### AndroidManifest.xml

Add to `frontend/android/app/src/main/AndroidManifest.xml` inside the MainActivity:

```xml
<activity android:name=".MainActivity">
    <!-- Deep link intent filters -->
    <intent-filter android:autoVerify="true">
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data 
            android:scheme="https"
            android:host="stellarsave.app"
            android:pathPrefix="/join" />
        <data 
            android:scheme="https"
            android:host="app.stellarsave.app"
            android:pathPrefix="/join" />
    </intent-filter>
    
    <!-- Custom scheme fallback -->
    <intent-filter>
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data android:scheme="stellarsave" />
    </intent-filter>
</activity>
```

### Digital Asset Links

Host this file at `https://stellarsave.app/.well-known/assetlinks.json`:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.stellarsave.app",
      "sha256_cert_fingerprints": [
        "YOUR_APP_SHA256_FINGERPRINT"
      ]
    }
  }
]
```

Get your SHA256 fingerprint:
```bash
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
```

## Implementation

### Deep Link Handler

The `useDeepLink` hook (located at `frontend/src/hooks/useDeepLink.ts`) handles both:

- **Cold start** - App not running, opened via link
- **Warm start** - App in background, brought to foreground via link

It listens to Capacitor's `appUrlOpen` event and navigates to the appropriate route.

### Routes

- `/join/:inviteCode` - Join group flow (JoinViaInvite component)
- `/app/:inviteCode` - App download fallback page (AppDownloadPage component)

## Web Fallback

When the app isn't installed, users land on `AppDownloadPage` which:

1. Attempts to open the app via custom scheme with a 2-second timeout
2. Shows app store badges for iOS and Android
3. Provides a "Continue in browser" option to use the web app

## Testing

### iOS Simulator

```bash
# Build and sync
cd frontend
npm run build
npx cap sync ios
npx cap open ios

# Test deep link (in Terminal while simulator is running)
xcrun simctl openurl booted "stellarsave://join/ABC123"
xcrun simctl openurl booted "https://stellarsave.app/join/ABC123"
```

### Android Emulator

```bash
# Build and sync
cd frontend
npm run build
npx cap sync android
npx cap open android

# Test deep link (via adb)
adb shell am start -W -a android.intent.action.VIEW -d "stellarsave://join/ABC123" com.stellarsave.app
adb shell am start -W -a android.intent.action.VIEW -d "https://stellarsave.app/join/ABC123" com.stellarsave.app
```

### Physical Devices

1. Build and install the app on your device
2. Send yourself a test link via SMS or email
3. Tap the link to verify it opens the app

**Note:** Universal/App Links require the AASA/assetlinks files to be hosted on your production domain. For local testing, use custom schemes.

## Generating Invite Links

In your group detail page or share functionality, generate links like:

```typescript
const inviteCode = generateInviteCode(groupId); // Your implementation
const inviteLink = `https://stellarsave.app/join/${inviteCode}`;

// Share via native sharing
if (Capacitor.isNativePlatform()) {
  await Share.share({
    title: 'Join my Stellar Save group',
    text: `Join my savings group on Stellar Save!`,
    url: inviteLink,
    dialogTitle: 'Share invite link',
  });
}
```

## Production Checklist

- [ ] Host `.well-known/apple-app-site-association` on your domain
- [ ] Host `.well-known/assetlinks.json` on your domain
- [ ] Configure your Apple Developer Team ID in AASA file
- [ ] Get SHA256 fingerprint of production signing key
- [ ] Update entitlements with production domain
- [ ] Test on physical devices before release
- [ ] Verify links open app correctly from SMS, email, and browsers
- [ ] Ensure web fallback works for users without the app

## Troubleshooting

### iOS Universal Links Not Working

1. Verify AASA file is accessible (no redirects)
2. Check Team ID matches your Developer account
3. Ensure entitlements are properly configured
4. Universal links don't work in Safari address bar - must be clicked in context
5. Try deleting and reinstalling the app

### Android App Links Not Working

1. Verify assetlinks.json is accessible
2. Check SHA256 fingerprint matches your signing key
3. Ensure `android:autoVerify="true"` is set
4. Check logcat for verification errors: `adb logcat | grep IntentFilter`
5. Manually verify: Settings → Apps → Your App → Open by default

### General Issues

- Custom schemes always work for testing
- Web fallback should always be functional
- Check browser console for navigation errors
- Ensure routes are properly registered in React Router

## References

- [iOS Universal Links](https://developer.apple.com/documentation/xcode/supporting-universal-links-in-your-app)
- [Android App Links](https://developer.android.com/training/app-links)
- [Capacitor Deep Links](https://capacitorjs.com/docs/guides/deep-links)
