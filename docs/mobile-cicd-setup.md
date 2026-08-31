# Mobile CI/CD Pipeline Setup Guide

This guide explains how to set up and use the mobile CI/CD pipeline for Stellar Save's iOS and Android applications.

## Overview

The mobile CI/CD pipeline automates:
- **Continuous Integration**: Lint, type-check, and test on every PR
- **Build Automation**: Automated builds for iOS and Android
- **Distribution**: Automatic uploads to TestFlight (iOS) and Play Console Internal Track (Android)
- **Release Management**: Manual-trigger workflow for cutting beta releases

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Web Frontend                           │
│                   (React + TypeScript)                      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ├─ npm run build
                         │
                         v
┌─────────────────────────────────────────────────────────────┐
│                    Capacitor Build                          │
│            (Wraps web app in native shell)                  │
└────────────┬────────────────────────┬───────────────────────┘
             │                        │
             v                        v
┌────────────────────────┐  ┌────────────────────────┐
│      iOS Build         │  │    Android Build       │
│   (Xcode + Fastlane)   │  │  (Gradle + Fastlane)   │
└──────────┬─────────────┘  └──────────┬─────────────┘
           │                           │
           v                           v
┌────────────────────────┐  ┌────────────────────────┐
│      TestFlight        │  │  Play Console Internal │
│   (Beta Testing)       │  │       (Beta Track)     │
└────────────────────────┘  └────────────────────────┘
```

## Prerequisites

### Development Environment

1. **Node.js**: v20 or higher
2. **iOS Development** (macOS only):
   - Xcode 15.0+
   - CocoaPods
   - Apple Developer Account
3. **Android Development**:
   - JDK 17
   - Android Studio
   - Android SDK
4. **Fastlane**:
   - Ruby 3.2+
   - Bundler

### Accounts & Access

1. **Apple Developer**:
   - Apple ID with App Store Connect access
   - Team membership
   - App-specific password

2. **Google Play Console**:
   - Play Console account
   - API access configured
   - Service account JSON key

3. **Code Signing**:
   - iOS certificates and provisioning profiles
   - Android keystore

## Initial Setup

### 1. Install Capacitor Dependencies

```bash
cd frontend
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
```

### 2. Initialize Capacitor

```bash
npx cap init "Stellar Save" "com.stellarsave.app" --web-dir=dist
npx cap add ios
npx cap add android
```

### 3. Build Web Assets

```bash
npm run build
npx cap sync
```

### 4. Install Fastlane

**iOS:**
```bash
cd ios
bundle install
```

**Android:**
```bash
cd android
bundle install
```

## GitHub Secrets Configuration

Configure the following secrets in your GitHub repository settings (`Settings` → `Secrets and variables` → `Actions`):

### iOS Secrets

| Secret Name | Description | How to Get |
|-------------|-------------|------------|
| `APPLE_ID` | Your Apple ID email | Apple Developer account |
| `APPLE_TEAM_ID` | Team ID | Apple Developer → Membership |
| `APP_STORE_CONNECT_TEAM_ID` | Team ID for App Store Connect | App Store Connect → Users and Access |
| `FASTLANE_APPLE_APPLICATION_SPECIFIC_PASSWORD` | App-specific password | appleid.apple.com → Security |
| `IOS_DISTRIBUTION_CERTIFICATE_P12` | Base64-encoded P12 certificate | Export from Keychain, encode: `base64 cert.p12` |
| `IOS_DISTRIBUTION_CERTIFICATE_PASSWORD` | P12 password | Password used when exporting |
| `MATCH_GIT_URL` | Git repo for certificates | e.g., `https://github.com/yourorg/certificates.git` |
| `MATCH_GIT_BASIC_AUTHORIZATION` | Git token for match repo | GitHub personal access token (base64 encoded: `echo -n "username:token" \| base64`) |
| `MATCH_PASSWORD` | Encryption password | Choose a strong password |

### Android Secrets

| Secret Name | Description | How to Get |
|-------------|-------------|------------|
| `ANDROID_KEYSTORE_BASE64` | Base64-encoded keystore | Generate keystore, encode: `base64 release.keystore` |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password | Password used when creating keystore |
| `ANDROID_KEY_ALIAS` | Key alias | Alias from keystore |
| `ANDROID_KEY_PASSWORD` | Key password | Password for the key |
| `PLAY_STORE_JSON_KEY` | Service account JSON | Play Console → API Access → Service Account |

### Step-by-Step: iOS Certificates Setup

```bash
# 1. Create certificates repo (private)
git init certificates
cd certificates
echo "# Certificates" > README.md
git add README.md
git commit -m "Initial commit"
git remote add origin https://github.com/yourorg/certificates.git
git push -u origin main

# 2. Initialize match
cd ../frontend/ios
bundle exec fastlane match init

# 3. Generate certificates
bundle exec fastlane match appstore

# 4. Export certificate from Keychain
# - Open Keychain Access
# - Find your distribution certificate
# - Right-click → Export
# - Save as .p12 with password

# 5. Base64 encode for GitHub
base64 -i certificate.p12 -o certificate.txt
# Copy contents of certificate.txt to IOS_DISTRIBUTION_CERTIFICATE_P12
```

### Step-by-Step: Android Keystore Setup

```bash
# 1. Generate keystore
keytool -genkey -v \
  -keystore release.keystore \
  -alias stellarsave \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000

# 2. Base64 encode for GitHub
base64 -i release.keystore -o keystore.txt
# Copy contents of keystore.txt to ANDROID_KEYSTORE_BASE64

# 3. Remember your passwords!
# ANDROID_KEYSTORE_PASSWORD: password you entered for keystore
# ANDROID_KEY_ALIAS: stellarsave (or what you used)
# ANDROID_KEY_PASSWORD: password you entered for key
```

### Step-by-Step: Play Console Service Account

1. Go to [Google Play Console](https://play.google.com/console/)
2. Select your app (or create one)
3. Navigate to **Setup** → **API Access**
4. Click **Create new service account**
5. Follow the link to Google Cloud Console
6. Create service account with these roles:
   - Service Account User
7. Create and download JSON key
8. Grant access in Play Console:
   - Admin (View app information and download bulk reports)
   - Release manager (Release apps to testing tracks)
9. Copy JSON contents to `PLAY_STORE_JSON_KEY` secret

## Workflows

### 1. Mobile CI (`mobile.yml`)

**Triggers:**
- Pull requests affecting `frontend/**`
- Pushes to `main` affecting `frontend/**`

**Jobs:**
1. **Lint & Type Check**: ESLint + TypeScript validation
2. **Unit Tests**: Run test suite with coverage
3. **Build Web**: Build frontend assets
4. **Android Build**: Compile Android debug APK
5. **iOS Build**: Compile iOS app (simulator)

**Usage:**
```bash
# Automatically runs on PR creation/update
git checkout -b feature/my-feature
git push origin feature/my-feature
# Opens PR → CI runs automatically
```

### 2. Mobile Beta Release (`mobile-release.yml`)

**Triggers:**
- Manual workflow dispatch

**Jobs:**
1. **Build Web**: Build production frontend
2. **iOS Release**: Upload to TestFlight
3. **Android Release**: Upload to Play Console Internal Track
4. **Create Release**: Tag and create GitHub release

**Usage:**

Via GitHub UI:
1. Go to **Actions** → **Mobile Beta Release**
2. Click **Run workflow**
3. Select:
   - Platform: `both`, `ios`, or `android`
   - Version: e.g., `1.0.0`
4. Click **Run workflow**

Via GitHub CLI:
```bash
gh workflow run mobile-release.yml \
  -f platform=both \
  -f version=1.0.0
```

## Testing

### Local Testing

**iOS:**
```bash
cd frontend
npm run build
npx cap sync ios
npx cap open ios
# Xcode opens → Select simulator → Run
```

**Android:**
```bash
cd frontend
npm run build
npx cap sync android
npx cap open android
# Android Studio opens → Select emulator → Run
```

### CI Testing

Create a test PR:
```bash
git checkout -b test/ci-pipeline
# Make a trivial change
echo "// test" >> frontend/src/App.tsx
git add .
git commit -m "test: verify CI pipeline"
git push origin test/ci-pipeline
# Open PR → CI runs
```

## Troubleshooting

### iOS Build Failures

**Certificate Issues:**
```bash
# Verify certificates
cd frontend/ios
bundle exec fastlane match appstore --readonly

# Re-generate if needed
bundle exec fastlane match appstore --force
```

**CocoaPods Issues:**
```bash
cd frontend/ios/App
pod deintegrate
pod install
```

**Xcode Version:**
```bash
# Check Xcode version
xcodebuild -version

# Select correct Xcode
sudo xcode-select --switch /Applications/Xcode.app
```

### Android Build Failures

**Gradle Issues:**
```bash
cd frontend/android
./gradlew clean
./gradlew build
```

**Keystore Issues:**
```bash
# Verify keystore
keytool -list -v -keystore release.keystore

# Check alias
keytool -list -keystore release.keystore
```

**SDK Issues:**
```bash
# Update SDK
sdkmanager --update

# Install required packages
sdkmanager "platforms;android-33" "build-tools;33.0.0"
```

### Common Errors

**"No dist directory"**
```bash
# Solution: Build frontend first
cd frontend
npm run build
npx cap sync
```

**"Provisioning profile not found"**
```bash
# Solution: Download profiles with match
cd frontend/ios
bundle exec fastlane match appstore --readonly
```

**"Signing credentials not found"**
- Verify all iOS secrets are set in GitHub
- Check MATCH_PASSWORD is correct
- Ensure certificates repo is accessible

**"Play Console API error"**
- Verify service account has correct permissions
- Check PLAY_STORE_JSON_KEY is valid JSON
- Ensure app is created in Play Console

## Security Best Practices

### ✅ DO

- ✅ Store ALL credentials in GitHub Secrets
- ✅ Use separate keystores for debug/release
- ✅ Enable 2FA on Apple ID
- ✅ Rotate credentials regularly
- ✅ Use match for iOS code signing
- ✅ Review workflow logs after each run

### ❌ DON'T

- ❌ Commit keystores or certificates
- ❌ Log sensitive values in workflows
- ❌ Share credentials via email/Slack
- ❌ Use personal accounts for CI
- ❌ Reuse passwords across services
- ❌ Skip secret validation

### Secret Validation

Before committing, verify no secrets leaked:
```bash
# Check for common secret patterns
git grep -i "password"
git grep -i "secret"
git grep -i "key"
git grep -E "[A-Za-z0-9+/]{40,}" # Base64 patterns

# Use git-secrets
git secrets --scan
```

## Maintenance

### Regular Tasks

**Weekly:**
- Review CI run times
- Check artifact storage usage
- Monitor TestFlight/Play Console feedback

**Monthly:**
- Update dependencies (`npm outdated`)
- Rotate service account keys
- Review workflow efficiency

**Quarterly:**
- Update Fastlane (`bundle update fastlane`)
- Update Capacitor (`npm update @capacitor/*)
- Renew certificates (iOS)
- Review and optimize workflows

### Updating Dependencies

```bash
# Update Capacitor
cd frontend
npm install @capacitor/core@latest @capacitor/cli@latest
npm install @capacitor/ios@latest @capacitor/android@latest
npx cap sync

# Update Fastlane
cd ios  # or android
bundle update fastlane

# Update Ruby gems
bundle update
```

## Cost Optimization

### GitHub Actions Minutes

- iOS builds on macOS runners cost 10x Linux minutes
- Use caching to reduce build times
- Only run iOS builds when necessary

**Current usage estimate:**
- Mobile CI (per PR): ~20 minutes (iOS on macOS)
- Mobile Release: ~30 minutes per platform
- Monthly (20 PRs + 4 releases): ~500 minutes macOS

**Optimization tips:**
- Cache node_modules
- Cache CocoaPods
- Cache Gradle dependencies
- Skip iOS builds for frontend-only changes

### Storage

- Artifacts retained for 7-30 days
- Clean up old artifacts regularly
- Use selective artifact uploads

## Monitoring

### Key Metrics

1. **CI Success Rate**: Target >95%
2. **Build Duration**: 
   - Lint/Test: <5 minutes
   - Android Build: <10 minutes
   - iOS Build: <15 minutes
3. **Release Frequency**: Weekly recommended
4. **Crash Rate**: Target <1%

### Alerts

Set up notifications for:
- Failed releases
- Certificate expiration (90 days)
- Provisioning profile expiration
- Service account key expiration

## Resources

### Documentation

- [Capacitor Docs](https://capacitorjs.com/docs)
- [Fastlane Docs](https://docs.fastlane.tools)
- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [App Store Connect](https://developer.apple.com/app-store-connect/)
- [Google Play Console](https://play.google.com/console/)

### Tools

- [Fastlane Match](https://docs.fastlane.tools/actions/match/)
- [Capacitor CLI](https://capacitorjs.com/docs/cli)
- [GitHub CLI](https://cli.github.com/)

### Support

- GitHub Issues: Report CI/CD issues
- Team Slack: #mobile-releases channel
- On-call: Check rotation schedule

## Appendix

### A. Environment Variables Reference

**CI Environment Variables:**
- `NODE_VERSION`: Node.js version (20)
- `JAVA_VERSION`: Java version (17)
- `XCODE_VERSION`: Xcode version (15.0)
- `RUBY_VERSION`: Ruby version (3.2)

**Build Environment Variables:**
- `VITE_APP_VERSION`: App version (from workflow input)

### B. File Structure

```
frontend/
├── android/              # Android native project
│   ├── app/
│   ├── fastlane/        # Fastlane configuration
│   │   ├── Fastfile
│   │   └── Appfile
│   └── Gemfile
├── ios/                 # iOS native project
│   ├── App/
│   ├── fastlane/       # Fastlane configuration
│   │   ├── Fastfile
│   │   ├── Appfile
│   │   └── Matchfile
│   └── Gemfile
├── capacitor.config.ts  # Capacitor configuration
└── package.json

.github/workflows/
├── mobile.yml           # CI workflow
└── mobile-release.yml   # Release workflow
```

### C. Versioning Strategy

**Semantic Versioning:** `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes
- **MINOR**: New features
- **PATCH**: Bug fixes

**Build Numbers:**
- iOS: Auto-incremented by Fastlane
- Android: Auto-incremented by Fastlane

**Example:**
- Version: `1.2.3`
- iOS Build: `42`
- Android versionCode: `10203042`

### D. Checklist: First Release

- [ ] Apple Developer account set up
- [ ] Google Play Console account set up
- [ ] App created in App Store Connect
- [ ] App created in Play Console
- [ ] All GitHub secrets configured
- [ ] Certificates generated (iOS)
- [ ] Keystore generated (Android)
- [ ] Test CI workflow runs successfully
- [ ] Test release workflow (staging)
- [ ] Internal testers added
- [ ] Privacy policy URL configured
- [ ] App icons and splash screens added

## License

This CI/CD setup is part of Stellar Save and follows the project's MIT License.
